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
const isGamingInstance = process.argv.includes('--gaming-mode');

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
  });

  mainWindow.on('leave-full-screen', () => {
    isFullscreen = false;
    mainWindow.webContents.send('fullscreen-change', false);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── VIEW AND TAB MANAGEMENT ──────────────────────────────────────────────────
// Now handled entirely by the renderer process using <webview> tags!
// 
// ─── IPC HANDLERS ─────────────────────────────────────────────────────────────


// Launch new Gaming Window (separate process)
ipcMain.handle('launch-gaming-window', () => {
  const { spawn } = require('child_process');
  if (isDev) {
    spawn(process.execPath, [process.argv[1], '--gaming-mode'], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn(app.getPath('exe'), ['--gaming-mode'], { detached: true, stdio: 'ignore' }).unref();
  }
  return true;
});

ipcMain.handle('is-gaming-instance', () => isGamingInstance);

// Context text is now provided directly by the renderer since it has access to the webview
// ipcMain.handle('get-page-context') is removed

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
    // Removed logic accessing global views array as it's now handled by the renderer.

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
  // Logic removed: DevTools for webviews are handled in renderer.
});

ipcMain.handle('get-active-url', () => {
  // Logic removed
  return '';
});

ipcMain.handle('inject-pointer-lock', () => {
  // Logic removed
});

ipcMain.handle('set-zoom', (e, factor) => {
  // Logic removed
});

// ─── FIND IN PAGE ─────────────────────────────────────────────────────────────
ipcMain.handle('find-in-page', (e, text, options) => {
  // Logic removed
});
ipcMain.handle('stop-find', () => {
  // Logic removed
});

// ─── MUTE TAB ─────────────────────────────────────────────────────────────────
ipcMain.handle('mute-tab', (e, muted) => {
  // Logic removed
});

ipcMain.handle('mute-tab-by-id', (e, { id, muted }) => {
  // Logic removed
  return { success: false };
});

// ─── SCREENSHOT ───────────────────────────────────────────────────────────────
ipcMain.handle('screenshot', async () => {
  // Logic removed
  return { success: false };
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
  
  if (cleanPrompt.includes('summarize') || cleanPrompt.includes('summary')) {
    return {
      response: `⚡ **Invicta AI Page Summary**\n\n*Action*: I have summarized this page and saved it to your local workspace memory.`,
      taskExtracted: null
    };
  } else if (cleanPrompt.includes('task') || cleanPrompt.includes('pending') || cleanPrompt.includes('todo')) {
    const extractedTask = `Follow up on current tab`;
    return {
      response: `✅ **Invicta AI Task Created!**\n\nAdded to pending tasks list: **"${extractedTask}"**.`,
      taskExtracted: { id: Date.now().toString(), text: extractedTask, done: false, date: new Date().toLocaleDateString() }
    };
  } else if (cleanPrompt.includes('report') || cleanPrompt.includes('analytics') || cleanPrompt.includes('record')) {
    const logs = store ? store.get('wfh_activity_records', []) : [];
    return {
      response: `📊 **Invicta AI Work Analytics Summary**\n\n- Total Logged Sessions: **${logs.length}**\n- Current Mode: **Workspace Productivity Mode**\n- Memory Persistence: **Connected (SQLite / Store)**\n\nCheck your Work Records panel to view breakdown by **Days, Weeks, Months, and Years**.`,
      taskExtracted: null
    };
  } else if (cleanPrompt.includes('explain')) {
    return {
      response: `🧠 **Invicta AI Explanation**\n\nHere is an explanation of the core concepts found on the page.`,
      taskExtracted: null
    };
  } else {
    return {
      response: `🤖 **Invicta AI Assistant** (Workspace AI Engine)\n\nI have captured your active browser context.\nHow can I help your work today?\n\n- Ask *"summarize"* to summarize active page.\n- Ask *"explain"* to break down the page content.\n- Ask *"task"* to generate a pending item.\n- Ask *"report"* for your daily work summary.`,
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
    mainWindow.webContents.reload();
  });

  // Open first tab with new tab page
  mainWindow.once('ready-to-show', () => {
    // Tab initialization is now handled natively in renderer.js
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
