const { contextBridge, ipcRenderer } = require('electron');

// ─── Expose safe API to renderer ──────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

  // ── Tab management ──────────────────────────────────────────────────────
  newTab:    (url) => ipcRenderer.invoke('new-tab', url),
  closeTab:  (id)  => ipcRenderer.invoke('close-tab', id),
  switchTab: (id)  => ipcRenderer.invoke('switch-tab', id),

  // ── Navigation ──────────────────────────────────────────────────────────
  navigate:     (url) => ipcRenderer.invoke('navigate', url),
  goBack:       ()    => ipcRenderer.invoke('go-back'),
  goForward:    ()    => ipcRenderer.invoke('go-forward'),
  reload:       ()    => ipcRenderer.invoke('reload'),
  getActiveUrl: ()    => ipcRenderer.invoke('get-active-url'),

  // ── View visibility ──────────────────────────────────────────────────────
  setViewVisible: (visible) => ipcRenderer.invoke('set-view-visible', visible),

  // ── Window controls ──────────────────────────────────────────────────────
  minimize:        () => ipcRenderer.invoke('minimize-window'),
  maximize:        () => ipcRenderer.invoke('maximize-window'),
  closeWindow:     () => ipcRenderer.invoke('close-window'),
  toggleFullscreen:() => ipcRenderer.invoke('toggle-fullscreen'),

  // ── Gaming features ──────────────────────────────────────────────────────
  setGamingMode:     (level)  => ipcRenderer.invoke('set-gaming-mode', level),
  clearCache:        ()       => ipcRenderer.invoke('clear-cache'),
  openDevTools:      ()       => ipcRenderer.invoke('open-devtools'),
  injectPointerLock: ()       => ipcRenderer.invoke('inject-pointer-lock'),
  setZoom:           (factor) => ipcRenderer.invoke('set-zoom', factor),
  launchGamingWindow:()       => ipcRenderer.invoke('launch-gaming-window'),
  isGamingInstance:  ()       => ipcRenderer.invoke('is-gaming-instance'),
  getPageContext:    ()       => ipcRenderer.invoke('get-page-context'),

  // ── New: Find in Page ────────────────────────────────────────────────────
  findInPage: (text, options) => ipcRenderer.invoke('find-in-page', text, options),
  stopFind:   ()              => ipcRenderer.invoke('stop-find'),

  // ── Mute Tab ─────────────────────────────────────────────────────────────
  muteTab: (muted) => ipcRenderer.invoke('mute-tab', muted),
  muteTabById: (id, muted) => ipcRenderer.invoke('mute-tab-by-id', { id, muted }),

  // ── Screenshot ───────────────────────────────────────────────────────────
  screenshot: () => ipcRenderer.invoke('screenshot'),

  // ── Bookmarks & Settings (persistent) ───────────────────────────────────
  getBookmarks:  ()          => ipcRenderer.invoke('get-bookmarks'),
  saveBookmarks: (bookmarks) => ipcRenderer.invoke('save-bookmarks', bookmarks),
  getSettings:   ()          => ipcRenderer.invoke('get-settings'),
  saveSettings:  (settings)  => ipcRenderer.invoke('save-settings', settings),

  // ── WFH Continuous Activity Logger & Records (Days, Weeks, Months, Years)
  logActivity:          (item) => ipcRenderer.invoke('log-activity', item),
  getActivityRecords:   (timeframe) => ipcRenderer.invoke('get-activity-records', timeframe),
  clearActivityRecords: () => ipcRenderer.invoke('clear-activity-records'),

  // ── WFH Pending Tasks Checklist ──────────────────────────────────────────
  getPendingTasks:  () => ipcRenderer.invoke('get-pending-tasks'),
  savePendingTasks: (tasks) => ipcRenderer.invoke('save-pending-tasks', tasks),

  // ── Invicta AI Integration ───────────────────────────────────────────────
  askInvictaAI: (prompt, context) => ipcRenderer.invoke('ask-invicta-ai', { prompt, context }),

  // ── Version & Auto-Update with Release Notes Modal ────────────────────────
  getVersion:      () => ipcRenderer.invoke('get-version'),
  getReleaseNotes: () => ipcRenderer.invoke('get-release-notes'),
  checkUpdates:    () => ipcRenderer.invoke('check-updates'),
  installUpdate:   () => ipcRenderer.invoke('install-update'),

  // ── System info ──────────────────────────────────────────────────────────
  getSystemInfo:    () => ipcRenderer.invoke('get-system-info'),
  getGpuInfo:       () => ipcRenderer.invoke('get-gpu-info'),
  boostGpuPriority: () => ipcRenderer.invoke('boost-gpu-priority'),

  // ── Event listeners ──────────────────────────────────────────────────────
  on: (channel, callback) => {
    const allowed = [
      'tab-created', 'tab-closed', 'tab-switched', 'tab-update',
      'tab-navigated', 'tab-audio-state', 'fullscreen-change',
      // Find in page
      'found-in-page-result', 'show-find-bar',
      // Bookmarks
      'bookmark-current',
      // Auto-update
      'update-available', 'update-progress', 'update-downloaded',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
