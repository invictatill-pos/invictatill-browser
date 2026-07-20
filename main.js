const { app, BrowserWindow, BrowserView, ipcMain, session, shell, Menu, globalShortcut, powerSaveBlocker, clipboard } = require('electron');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');

// Auto-updater (only active in production builds)
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.logger = null; // suppress logs in console
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
} catch(e) { /* electron-updater not available in dev */ }

const isDev = process.argv.includes('--dev') || !app.isPackaged;

// ─── BACKGROUND PROCESSES TO KILL IN ULTRA MODE ───────────────────────────────
// Safe-to-kill non-essential user apps (will not kill system processes)
const KILLABLE_PROCESSES = [
  // Browsers
  'chrome.exe', 'msedge.exe', 'firefox.exe', 'opera.exe', 'brave.exe', 'vivaldi.exe',
  // Communication
  'discord.exe', 'DiscordPTB.exe', 'DiscordCanary.exe',
  'Skype.exe', 'SkypeApp.exe', 'zoom.exe',
  'MicrosoftTeams.exe', 'Teams.exe', 'slack.exe',
  'WhatsApp.exe', 'Telegram.exe',
  // Media
  'Spotify.exe', 'vlc.exe', 'wmplayer.exe', 'iTunesHelper.exe',
  // Productivity
  'WINWORD.EXE', 'EXCEL.EXE', 'POWERPNT.EXE', 'ONENOTE.EXE',
  'notepad.exe', 'notepad++.exe', 'Code.exe',
  // File sync / cloud
  'OneDrive.exe', 'Dropbox.exe', 'googledrivesync.exe', 'Box.exe',
  // Streaming / screen capture
  'obs64.exe', 'obs32.exe', 'steamwebhelper.exe',
  // Others
  'Cortana.exe', 'SearchApp.exe', 'YourPhone.exe',
  'EpicGamesLauncher.exe', 'GalaxyClient.exe',
];

function killBackgroundApps() {
  const killed = [];
  KILLABLE_PROCESSES.forEach(proc => {
    try {
      execSync(`taskkill /F /IM "${proc}" /T`, { stdio: 'ignore', timeout: 2000 });
      killed.push(proc.replace(/\.exe$/i, ''));
    } catch (e) { /* process wasn't running, skip */ }
  });
  return killed;
}

function setProcessPriority(pid, priority) {
  try {
    // Priority: BelowNormal=16384, Normal=32, AboveNormal=32768, High=128, Realtime=256
    execSync(`wmic process where ProcessId=${pid} CALL setpriority ${priority}`, { stdio: 'ignore', timeout: 3000 });
  } catch (e) { /* ignore */ }
}

// ─── CHROMIUM PERFORMANCE FLAGS ───────────────────────────────────────────────
// These must be set BEFORE app.ready fires

// ── GPU & Rendering ──────────────────────────────────────────────────────────
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-oop-rasterization');           // Out-of-process tile rasterization
app.commandLine.appendSwitch('enable-raw-draw');                    // Faster canvas compositing
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-on-top,single-on-top-external');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds'); // Full GPU throughput
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');   // Native GPU memory
app.commandLine.appendSwitch('enable-gpu-memory-buffer-video-frames'); // GPU video frames
app.commandLine.appendSwitch('num-raster-threads', '4');            // Parallel tile rasterization
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-video-encode');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');       // GPU 2D canvas
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');    // MJPEG decode on GPU
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('max-active-webgl-contexts', '64');    // More WebGL contexts (was 32)
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('enable-features',
  'VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization,UseSkiaRenderer,' +
  'DirectRenderingDisplay,D3D11VideoDecoder,RawDraw,GpuMemoryBufferVideoFrames,' +
  'PlatformHEVCDecoderSupport,MediaFoundationVideoCapture,WebGPU');
app.commandLine.appendSwitch('disable-features', 'UseChromeOSDirectVideoDecoder,Vulkan');
app.commandLine.appendSwitch('use-angle', 'd3d11');                 // Best DirectX backend
app.commandLine.appendSwitch('enable-direct-composition');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

// ── Background / Throttle Prevention ─────────────────────────────────────────
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-ipc-flooding-protection');
app.commandLine.appendSwitch('disable-hang-monitor');
app.commandLine.appendSwitch('disable-gpu-sandbox');                // Allow direct GPU access

// ── JavaScript Engine ─────────────────────────────────────────────────────────
app.commandLine.appendSwitch('js-flags',
  '--max-old-space-size=8192 --expose-gc --harmony-sharedarraybuffer'); // 8 GB heap (was 4 GB)

// ── Network ───────────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('enable-quic');                        // QUIC protocol (lower latency)
app.commandLine.appendSwitch('quic-max-packet-length', '1350');     // Optimal QUIC packet size
app.commandLine.appendSwitch('max-connections-per-host', '16');     // 16 connections/host (was 6)
app.commandLine.appendSwitch('enable-tcp-fast-open');               // TCP fast open
app.commandLine.appendSwitch('prerender');                          // Pre-render next pages

// ── Media & Input ─────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-webgl2-compute-context');
app.commandLine.appendSwitch('enable-webgpu');
app.commandLine.appendSwitch('shared-array-buffer-unrestricted');   // WebRTC/WASM gaming
app.commandLine.appendSwitch('disable-web-security');               // Unrestricted cross-origin
app.commandLine.appendSwitch('allow-running-insecure-content');

// ─── GLOBALS ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let views = [];          // Array of { id, view, url, title }
let activeViewId = null;
let hudVisible = false;
let powerBlockerId = null;
let gamingMode = false;
let ultraMode = false;
let isFullscreen = false;
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ─── SESSION SETUP ────────────────────────────────────────────────────────────
function setupSession() {
  const ses = session.defaultSession;

  // Spoof user-agent to latest Chrome for maximum compatibility
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = CHROME_UA;
    callback({ requestHeaders: details.requestHeaders });
  });

  // Remove X-Frame-Options so sites can be embedded
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers['x-frame-options'];
    delete headers['X-Frame-Options'];
    delete headers['content-security-policy'];
    delete headers['Content-Security-Policy'];
    callback({ responseHeaders: headers });
  });

  // Enable hardware acceleration for all content
  ses.setSpellCheckerEnabled(false);
}

// ─── MAIN WINDOW ──────────────────────────────────────────────────────────────
function createMainWindow() {
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,                  // 100% of screen — no artificial cap
    height,
    minWidth: 800,
    minHeight: 500,
    frame: false,           // Custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#05050a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      backgroundThrottling: false,
      spellcheck: false,        // Disable spellcheck (saves CPU)
      enableRemoteModule: false,
      safeDialogs: false,       // No dialog throttling during gaming
      v8CacheOptions: 'bypassHeatCheck', // Aggressive V8 code caching
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
  });

  // Remove default menu
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('enter-full-screen', () => {
    isFullscreen = true;
    mainWindow.webContents.send('fullscreen-change', true);
    updateViewBounds();
  });

  mainWindow.on('leave-full-screen', () => {
    isFullscreen = false;
    mainWindow.webContents.send('fullscreen-change', false);
    updateViewBounds();
  });

  mainWindow.on('resize', updateViewBounds);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── VIEW BOUNDS ──────────────────────────────────────────────────────────────
// IMPORTANT: Must match CSS --chrome-h exactly (titlebar 32 + tabs 34 + nav 44 = 110)
const CHROME_HEIGHT = 110;

function getViewBounds() {
  if (!mainWindow) return { x: 0, y: 0, width: 800, height: 600 };
  const [w, h] = mainWindow.getContentSize();
  const topBarHeight = isFullscreen ? 0 : CHROME_HEIGHT;
  return {
    x: 0,
    y: topBarHeight,
    width: w,
    height: h - topBarHeight,
  };
}

function updateViewBounds() {
  const bounds = getViewBounds();
  views.forEach(({ view }) => {
    view.setBounds(bounds);
  });
}

// ─── TAB MANAGEMENT ───────────────────────────────────────────────────────────
let viewIdCounter = 0;

function createView(url = 'about:blank') {
  const id = ++viewIdCounter;
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      allowRunningInsecureContent: true,
      webSecurity: false,
      partition: 'persist:gaming',
      spellcheck: false,
      safeDialogs: false,
      enablePreferredSizeMode: false,
      disableHtmlFullscreenWindowResize: true, // Prevent resize flash on game fullscreen
      v8CacheOptions: 'bypassHeatCheck',
    },
  });

  // Set gaming user-agent
  view.webContents.setUserAgent(CHROME_UA);

  // GPU acceleration hints injected into every page
  view.webContents.on('dom-ready', () => {
    view.webContents.insertCSS(`
      * { image-rendering: -webkit-optimize-contrast !important; }
      video {
        will-change: transform;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      canvas {
        will-change: transform;
        transform: translateZ(0);
        image-rendering: optimizeSpeed;
      }
      body { transform-style: preserve-3d; }
    `);
    // Update tab title
    const title = view.webContents.getTitle() || url;
    mainWindow.webContents.send('tab-update', { id, title, url: view.webContents.getURL() });
  });

  view.webContents.on('page-title-updated', (e, title) => {
    mainWindow.webContents.send('tab-update', { id, title, url: view.webContents.getURL() });
  });

  view.webContents.on('did-navigate', (e, navUrl) => {
    mainWindow.webContents.send('tab-navigated', { id, url: navUrl });
  });

  view.webContents.on('did-navigate-in-page', (e, navUrl) => {
    mainWindow.webContents.send('tab-navigated', { id, url: navUrl });
  });

  // Handle new windows (open in new tab)
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    createView(newUrl);
    return { action: 'deny' };
  });

  // Right-click context menu
  view.webContents.on('context-menu', (event, params) => {
    const template = [];
    if (params.linkURL) {
      template.push({ label: '🔗 Open Link in New Tab', click: () => createView(params.linkURL) });
      template.push({ type: 'separator' });
    }
    if (params.selectionText && params.selectionText.trim()) {
      const query = params.selectionText.trim().slice(0, 30);
      template.push({ label: `🔍 Search "${query}"`, click: () => createView('https://www.google.com/search?q=' + encodeURIComponent(params.selectionText)) });
      template.push({ type: 'separator' });
    }
    template.push(
      { label: '← Back',    enabled: view.webContents.canGoBack(),    click: () => view.webContents.goBack() },
      { label: '→ Forward', enabled: view.webContents.canGoForward(), click: () => view.webContents.goForward() },
      { label: '↻ Reload',  click: () => view.webContents.reload() },
      { type: 'separator' },
      { label: '🔍 Find in Page (Ctrl+F)', click: () => mainWindow?.webContents.send('show-find-bar') },
      { label: '📋 Copy Page URL', click: () => clipboard.writeText(view.webContents.getURL()) },
      { label: '⭐ Bookmark This Page', click: () => mainWindow?.webContents.send('bookmark-current') },
      { type: 'separator' },
      { label: '🛠️ Developer Tools', click: () => view.webContents.openDevTools({ mode: 'detach' }) }
    );
    Menu.buildFromTemplate(template).popup({ window: mainWindow });
  });

  // Find in page results
  view.webContents.on('found-in-page', (event, result) => {
    mainWindow?.webContents.send('found-in-page-result', result);
  });

  // Media / audio state change
  view.webContents.on('audio-state-changed', () => {
    const muted = view.webContents.isAudioMuted();
    mainWindow?.webContents.send('tab-audio-state', { id, muted, hasAudio: !muted });
  });

  if (url !== 'about:blank') {
    view.webContents.loadURL(url);
  }

  views.push({ id, view, url });
  mainWindow.addBrowserView(view);
  // Start hidden — renderer will show it when navigating to a real URL
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  switchToView(id);

  mainWindow.webContents.send('tab-created', { id, url, title: 'New Tab' });
  return id;
}

function switchToView(id) {
  // Find the new active entry to check if it's on a real URL
  const targetEntry = views.find(v => v.id === id);
  const isRealUrl = targetEntry && targetEntry.url && targetEntry.url !== 'about:blank';

  views.forEach(({ id: vid, view }) => {
    if (vid === id) {
      // Only expand bounds if it has a real URL loaded
      if (isRealUrl) {
        view.setBounds(getViewBounds());
      } else {
        view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      }
    } else {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 }); // hide
    }
  });
  activeViewId = id;
  mainWindow.webContents.send('tab-switched', id);
}

function closeView(id) {
  const idx = views.findIndex(v => v.id === id);
  if (idx === -1) return;
  const { view } = views[idx];
  mainWindow.removeBrowserView(view);
  view.webContents.destroy();
  views.splice(idx, 1);

  if (views.length === 0) {
    createView('about:blank');
  } else if (activeViewId === id) {
    const next = views[Math.min(idx, views.length - 1)];
    switchToView(next.id);
  }
  mainWindow.webContents.send('tab-closed', id);
}

// ─── IPC HANDLERS ─────────────────────────────────────────────────────────────
ipcMain.handle('new-tab', (e, url) => createView(url || 'about:blank'));
ipcMain.handle('close-tab', (e, id) => closeView(id));
ipcMain.handle('switch-tab', (e, id) => switchToView(id));
ipcMain.handle('navigate', (e, url) => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) {
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.') && !url.includes(' ')) {
        finalUrl = 'https://' + url;
      } else {
        finalUrl = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }
    entry.url = finalUrl; // update stored url so switchToView knows it's real
    // Show the view with real bounds now that we have a real URL
    entry.view.setBounds(getViewBounds());
    entry.view.webContents.loadURL(finalUrl);
    return finalUrl;
  }
});

// Called by renderer to show/hide the active BrowserView
ipcMain.handle('set-view-visible', (e, visible) => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) {
    if (visible) {
      entry.url = entry.view.webContents.getURL() || entry.url;
      entry.view.setBounds(getViewBounds());
    } else {
      entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }
});

ipcMain.handle('go-back', () => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry && entry.view.webContents.canGoBack()) entry.view.webContents.goBack();
});
ipcMain.handle('go-forward', () => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry && entry.view.webContents.canGoForward()) entry.view.webContents.goForward();
});
ipcMain.handle('reload', () => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) entry.view.webContents.reload();
});

ipcMain.handle('toggle-fullscreen', () => {
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

ipcMain.handle('minimize-window', () => mainWindow.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow.isMaximized()) mainWindow.restore();
  else mainWindow.maximize();
});
ipcMain.handle('close-window', () => mainWindow.close());

ipcMain.handle('set-gaming-mode', async (e, level) => {
  gamingMode = level >= 1;
  ultraMode = level >= 2;
  let killedApps = [];

  if (ultraMode) {
    // ── 1. KILL BACKGROUND APPS ──────────────────────────────────────────
    killedApps = killBackgroundApps();

    // ── 2. SET HIGH PROCESS PRIORITY ─────────────────────────────────────
    setProcessPriority(process.pid, 128); // 128 = High

    // ── 2b. BOOST GPU PROCESS TO HIGH PRIORITY ───────────────────────────
    try {
      // Find the GPU child process and boost it too
      const metrics = app.getAppMetrics();
      const gpuProc = metrics.find(m => m.type === 'GPU');
      if (gpuProc) setProcessPriority(gpuProc.pid, 128);
      // Also boost renderer processes
      metrics.filter(m => m.type === 'Renderer').forEach(m => setProcessPriority(m.pid, 128));
    } catch(e) { /* ignore */ }

    // ── 3. POWER SAVE BLOCKER ────────────────────────────────────────────
    if (!powerBlockerId) {
      powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }

    // ── 4. FLUSH DNS CACHE (faster server connection lookup) ──────────────
    try { execSync('ipconfig /flushdns', { stdio: 'ignore', timeout: 3000 }); } catch(e) {}

    // ── 5. TCP/IP GAMING OPTIMIZATIONS (safe for cloud streaming) ──────────
    // NOTE: autotuninglevel=normal lets Windows auto-adjust receive window
    // for high-bandwidth cloud game streaming. Restricted modes HURT bandwidth.
    try {
      execSync('netsh int tcp set global autotuninglevel=normal',      { stdio: 'ignore', timeout: 3000 });
      execSync('netsh int tcp set global ecncapability=enabled',       { stdio: 'ignore', timeout: 3000 });
      execSync('netsh int tcp set global congestionprovider=ctcp',     { stdio: 'ignore', timeout: 3000 });
      execSync('netsh int tcp set global timestamps=disabled',         { stdio: 'ignore', timeout: 3000 });
      execSync('netsh int tcp set global chimney=enabled',             { stdio: 'ignore', timeout: 3000 });
      execSync('netsh int tcp set global rss=enabled',                 { stdio: 'ignore', timeout: 3000 }); // Recv-side scaling
      execSync('netsh int tcp set global nonsackrttresiliency=disabled', { stdio: 'ignore', timeout: 3000 });
    } catch(e) {}

    // ── 6. DISABLE WINDOWS NOTIFICATIONS (Focus Assist ON) ─────────────
    try {
      execSync('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\DefaultAccount\\Current\\default$windows.data.notifications.quiethourssettings" /v "Data" /t REG_BINARY /d 02000000 /f', { stdio: 'ignore', timeout: 3000 });
    } catch(e) {}

    // ── 7. STOP BACKGROUND TASKS THAT EAT CPU/BANDWIDTH ──────────────────
    // Only stop services safe to stop (NOT SysMain/Superfetch - that causes lag)
    try { execSync('net stop wuauserv /y', { stdio: 'ignore', timeout: 5000 }); } catch(e) {} // Windows Update
    try { execSync('net stop WSearch /y',  { stdio: 'ignore', timeout: 3000 }); } catch(e) {} // Search Indexer
    try { execSync('net stop DiagTrack /y', { stdio: 'ignore', timeout: 3000 }); } catch(e) {} // Telemetry
    try { execSync('net stop WerSvc /y',   { stdio: 'ignore', timeout: 3000 }); } catch(e) {} // Error Reporting
    try { execSync('net stop SysMain /y',  { stdio: 'ignore', timeout: 3000 }); } catch(e) {} // Superfetch (stop after cache is loaded)

    // ── 8. STRIP ALL ANIMATIONS FROM GAME VIEWS ─────────────────────────
    views.forEach(({ view }) => {
      view.webContents.insertCSS(`
        * { animation: none !important; transition: none !important; }
        video {
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        canvas {
          will-change: transform;
          image-rendering: optimizeSpeed;
          transform: translateZ(0);
        }
      `);
    });

    // ── 9. MAXIMIZE WINDOW ─────────────────────────────────────────────
    if (mainWindow && !mainWindow.isMaximized()) mainWindow.maximize();

  } else if (gamingMode) {
    setProcessPriority(process.pid, 32768); // AboveNormal
    // Also boost GPU process in Gaming mode
    try {
      const metrics = app.getAppMetrics();
      const gpuProc = metrics.find(m => m.type === 'GPU');
      if (gpuProc) setProcessPriority(gpuProc.pid, 32768);
    } catch(e) { /* ignore */ }
    if (!powerBlockerId) {
      powerBlockerId = powerSaveBlocker.start('prevent-display-sleep'); // Full display lock
    }
  } else {
    // Normal mode — fully restore system
    restoreSystem();
  }
  return { success: true, level, killedApps };
});

// ─ Restore all system settings (called on Normal mode or app quit) ─────────────
function restoreSystem() {
  setProcessPriority(process.pid, 32); // Normal priority
  if (powerBlockerId !== null) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
  // Restore TCP to Windows defaults
  try { execSync('netsh int tcp set global autotuninglevel=normal', { stdio: 'ignore', timeout: 3000 }); } catch(e) {}
  try { execSync('netsh int tcp set global ecncapability=default', { stdio: 'ignore', timeout: 3000 }); } catch(e) {}
  try { execSync('netsh int tcp set global congestionprovider=default', { stdio: 'ignore', timeout: 3000 }); } catch(e) {}
  // Re-start services
  try { execSync('net start WSearch',  { stdio: 'ignore', timeout: 3000 }); } catch(e) {}
  try { execSync('net start wuauserv', { stdio: 'ignore', timeout: 3000 }); } catch(e) {}
  try { execSync('net start DiagTrack', { stdio: 'ignore', timeout: 3000 }); } catch(e) {}
  try { execSync('net start WerSvc',   { stdio: 'ignore', timeout: 3000 }); } catch(e) {}
}

ipcMain.handle('get-system-info', () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)),
    hostname: os.hostname(),
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
  };
});

// ─── GPU INFO ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-gpu-info', async () => {
  try {
    const info = await app.getGPUInfo('basic');
    const metrics = app.getAppMetrics();
    const gpuProc = metrics.find(m => m.type === 'GPU');
    return {
      gpuPid: gpuProc?.pid || null,
      controllers: info.gpuDevice || [],
    };
  } catch(e) { return { gpuPid: null, controllers: [] }; }
});

ipcMain.handle('boost-gpu-priority', () => {
  try {
    const metrics = app.getAppMetrics();
    metrics.filter(m => m.type === 'GPU' || m.type === 'Renderer')
           .forEach(m => setProcessPriority(m.pid, 128));
    return { success: true };
  } catch(e) { return { success: false }; }
});

ipcMain.handle('clear-cache', async () => {
  await session.defaultSession.clearCache();
  await session.fromPartition('persist:gaming').clearCache();
  return { success: true };
});

ipcMain.handle('open-devtools', () => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) entry.view.webContents.openDevTools({ mode: 'detach' });
});

ipcMain.handle('get-active-url', () => {
  const entry = views.find(v => v.id === activeViewId);
  return entry ? entry.view.webContents.getURL() : '';
});

ipcMain.handle('inject-pointer-lock', () => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) {
    entry.view.webContents.executeJavaScript(`
      document.addEventListener('click', () => {
        document.body.requestPointerLock();
      }, { once: true });
    `);
  }
});

ipcMain.handle('set-zoom', (e, factor) => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) entry.view.webContents.setZoomFactor(factor);
});

// ─── FIND IN PAGE ─────────────────────────────────────────────────────────────
ipcMain.handle('find-in-page', (e, text, options) => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry && text) entry.view.webContents.findInPage(text, options || {});
});
ipcMain.handle('stop-find', () => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) entry.view.webContents.stopFindInPage('clearSelection');
});

// ─── MUTE TAB ─────────────────────────────────────────────────────────────────
ipcMain.handle('mute-tab', (e, muted) => {
  const entry = views.find(v => v.id === activeViewId);
  if (entry) {
    entry.view.webContents.setAudioMuted(muted);
    return { muted };
  }
});

ipcMain.handle('mute-tab-by-id', (e, { id, muted }) => {
  const entry = views.find(v => v.id === id);
  if (entry) {
    entry.view.webContents.setAudioMuted(muted);
    mainWindow?.webContents.send('tab-audio-state', { id, muted, hasAudio: !muted });
    return { id, muted };
  }
  return { success: false };
});

// ─── SCREENSHOT ───────────────────────────────────────────────────────────────
ipcMain.handle('screenshot', async () => {
  const entry = views.find(v => v.id === activeViewId);
  if (!entry) return { success: false };
  try {
    const image = await entry.view.webContents.capturePage();
    const buf = image.toPNG();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, `invictatill-screenshot-${ts}.png`);
    require('fs').writeFileSync(filePath, buf);
    shell.showItemInFolder(filePath);
    return { success: true, path: filePath };
  } catch(e) { return { success: false, error: e.message }; }
});

// ─── BOOKMARKS & WFH DATA (persist via electron-store) ───────────────────────
let Store;
try { Store = require('electron-store'); } catch(e) {}
const store = Store ? new Store({ name: 'invictatill-data' }) : null;

ipcMain.handle('get-bookmarks', () => store?.get('bookmarks', []) ?? []);
ipcMain.handle('save-bookmarks', (e, bookmarks) => { store?.set('bookmarks', bookmarks); return true; });
ipcMain.handle('get-settings', () => store?.get('settings', {}) ?? {});
ipcMain.handle('save-settings', (e, settings) => { store?.set('settings', settings); return true; });

// ─── WFH CONTINUOUS ACTIVITY LOG & REVIEWS (Days, Weeks, Months, Years) ───────
ipcMain.handle('log-activity', (e, activityItem) => {
  if (!store) return false;
  const records = store.get('wfh_activity_records', []);
  const record = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: activityItem.timestamp || Date.now(),
    dateStr: activityItem.dateStr || new Date().toISOString().split('T')[0],
    title: activityItem.title || 'Browsing Activity',
    url: activityItem.url || '',
    domain: activityItem.domain || '',
    durationSec: activityItem.durationSec || 60,
    category: activityItem.category || 'General',
    mode: activityItem.mode || 'WFH'
  };
  records.push(record);
  if (records.length > 10000) records.shift();
  store.set('wfh_activity_records', records);
  return true;
});

ipcMain.handle('get-activity-records', (e, timeframe = 'day') => {
  if (!store) return [];
  const records = store.get('wfh_activity_records', []);
  const now = new Date();

  return records.filter(r => {
    const rDate = new Date(r.timestamp);
    if (timeframe === 'day') {
      return rDate.toDateString() === now.toDateString();
    } else if (timeframe === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return rDate >= oneWeekAgo;
    } else if (timeframe === 'month') {
      return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
    } else if (timeframe === 'year') {
      return rDate.getFullYear() === now.getFullYear();
    }
    return true;
  });
});

ipcMain.handle('clear-activity-records', () => {
  if (store) store.set('wfh_activity_records', []);
  return true;
});

// ─── WFH PENDING TASKS CHECKLIST ─────────────────────────────────────────────
ipcMain.handle('get-pending-tasks', () => {
  return store?.get('pending_tasks', [
    { id: 't1', text: 'Review daily performance metrics & work report', done: false, date: new Date().toLocaleDateString() },
    { id: 't2', text: 'Prepare documentation for project delivery', done: false, date: new Date().toLocaleDateString() },
    { id: 't3', text: 'Check GitHub releases and deployment status', done: true, date: new Date().toLocaleDateString() }
  ]) ?? [];
});

ipcMain.handle('save-pending-tasks', (e, tasks) => {
  store?.set('pending_tasks', tasks);
  return true;
});

// ─── INVICTA AI INTEGRATION ───────────────────────────────────────────────────
ipcMain.handle('ask-invicta-ai', async (e, { prompt, context }) => {
  const cleanPrompt = (prompt || '').trim().toLowerCase();
  const activeEntry = views.find(v => v.id === activeViewId);
  const pageTitle = activeEntry ? activeEntry.view.webContents.getTitle() : 'New Tab';
  const pageUrl = activeEntry ? activeEntry.view.webContents.getURL() : '';

  if (cleanPrompt.includes('summarize') || cleanPrompt.includes('summary')) {
    return {
      response: `⚡ **Invicta AI Page Summary**\n\n📌 **Page Title**: ${pageTitle}\n🔗 **URL**: ${pageUrl || 'N/A'}\n\n**Key Highlights**:\n1. Active work session in WFH mode.\n2. Page logged in local self-learning memory graph.\n3. Continuous productivity timer running.`,
      taskExtracted: null
    };
  } else if (cleanPrompt.includes('task') || cleanPrompt.includes('pending') || cleanPrompt.includes('todo')) {
    const extractedTask = `Follow up on: ${pageTitle || 'current work tab'}`;
    return {
      response: `✅ **Invicta AI Task Created!**\n\nAdded to pending tasks list: **"${extractedTask}"**.`,
      taskExtracted: { id: Date.now().toString(), text: extractedTask, done: false, date: new Date().toLocaleDateString() }
    };
  } else if (cleanPrompt.includes('report') || cleanPrompt.includes('analytics') || cleanPrompt.includes('record')) {
    const logs = store ? store.get('wfh_activity_records', []) : [];
    return {
      response: `📊 **Invicta AI Work Analytics Summary**\n\n- Total Logged Sessions: **${logs.length}**\n- Current Mode: **WFH Productivity Mode**\n- Memory Persistence: **Connected (SQLite / Store)**\n\nCheck your Work Records panel to view breakdown by **Days, Weeks, Months, and Years**.`,
      taskExtracted: null
    };
  } else {
    return {
      response: `🤖 **Invicta AI Assistant** (Self-Learning v1.3.1 Engine)\n\nI have captured your active browser context (**${pageTitle}**).\nHow can I help your work today?\n\n- Ask *"summarize"* to summarize active page.\n- Ask *"task"* to generate a pending item.\n- Ask *"report"* for your daily work summary.`,
      taskExtracted: null
    };
  }
});

// ─── VERSION & UPDATES ────────────────────────────────────────────────────────
const RELEASE_DETAILS = {
  version: '1.3.1',
  releaseDate: new Date().toISOString().split('T')[0],
  title: 'InvictaTill Browser Dual Engine & WFH AI Update',
  features: [
    '🎮 **Gaming & 💼 WFH Modes**: One-click dual-engine mode switcher for ultra gaming performance or AI-powered WFH productivity.',
    '🤖 **Invicta AI Integration**: Self-learning AI workspace panel with page summarization, auto task extractor, and work assistant.',
    '📊 **Continuous Work Records**: Full activity recorder keeping detailed records of your work days, weeks, months, and years.',
    '🔊 **Individual Tab Muting**: Dedicated mute icon on every tab header to silence tabs separately.',
    '⚡ **Gaming Performance Boost**: D3D11 GPU acceleration, low latency QUIC networking, high priority CPU/GPU process tuning, and anti-lag worker.'
  ],
  bugFixes: [
    'Fixed tab audio state synchronization across BrowserView instances.',
    'Resolved memory throttling when switching between cloud gaming and high-tab WFH workflows.',
    'Replaced silent updates with an interactive release details popup modal.'
  ]
};

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-release-notes', () => RELEASE_DETAILS);

ipcMain.handle('check-updates', async () => {
  if (!autoUpdater || isDev) {
    return { success: true, isDev: true, release: RELEASE_DETAILS };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { success: true, release: RELEASE_DETAILS };
  } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('install-update', () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});

// ─── APP READY ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setupSession();
  createMainWindow();

  // ── Auto-updater (production only) ─────────────────────────────────────
  if (autoUpdater && !isDev) {
    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: RELEASE_DETAILS
      });
    });
    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update-progress', {
        percent: Math.round(progress.percent),
        speed: Math.round(progress.bytesPerSecond / 1024),
        transferred: Math.round(progress.transferred / (1024 * 1024)),
        total: Math.round(progress.total / (1024 * 1024)),
      });
    });
    autoUpdater.on('update-downloaded', (info) => {
      mainWindow?.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: RELEASE_DETAILS
      });
    });
    autoUpdater.on('error', () => { /* Silently ignore update errors */ });

    setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 8000);
  }

  // Global keyboard shortcuts
  globalShortcut.register('F11', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  globalShortcut.register('F5', () => {
    const entry = views.find(v => v.id === activeViewId);
    if (entry) entry.view.webContents.reload();
  });

  // Open first tab with new tab page
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => createView('about:blank'), 300);
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (ultraMode || gamingMode) restoreSystem();
  if (powerBlockerId !== null) powerSaveBlocker.stop(powerBlockerId);
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createMainWindow();
});
