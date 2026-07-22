'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const allowedEvents = new Set([
  'tab-created',
  'tab-closed',
  'tab-switched',
  'tab-update',
  'tab-navigated',
  'tab-audio-state',
  'open-url-in-new-tab',
  'found-in-page-result',
  'download-updated',
  'download-created',
  'fullscreen-change',
  'update-available',
  'update-progress',
  'update-downloaded',
  'update-error',
  'focus-address-bar',
  'show-find-bar',
  'bookmark-current',
]);

const eventWrappers = new Map();

function subscribe(channel, callback) {
  if (!allowedEvents.has(channel)) {
    throw new TypeError('Unsupported event channel');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Event callback must be a function');
  }

  const wrapper = (event, ...args) => callback(...args);
  let callbacks = eventWrappers.get(channel);
  if (!callbacks) {
    callbacks = new Map();
    eventWrappers.set(channel, callbacks);
  }
  let wrappers = callbacks.get(callback);
  if (!wrappers) {
    wrappers = new Set();
    callbacks.set(callback, wrappers);
  }
  wrappers.add(wrapper);
  ipcRenderer.on(channel, wrapper);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    ipcRenderer.removeListener(channel, wrapper);
    wrappers.delete(wrapper);
    if (wrappers.size === 0) callbacks.delete(callback);
    if (callbacks.size === 0) eventWrappers.delete(channel);
  };
}

function unsubscribe(channel, callback) {
  if (!allowedEvents.has(channel) || typeof callback !== 'function') return;
  const callbacks = eventWrappers.get(channel);
  const wrappers = callbacks && callbacks.get(callback);
  if (!wrappers) return;
  for (const wrapper of wrappers) {
    ipcRenderer.removeListener(channel, wrapper);
  }
  callbacks.delete(callback);
  if (callbacks.size === 0) eventWrappers.delete(channel);
}

const api = {
  // Browser/tab core.
  getBrowserState: () => ipcRenderer.invoke('get-browser-state'),
  newTab: (url) => ipcRenderer.invoke('new-tab', url),
  closeTab: (id) => ipcRenderer.invoke('close-tab', id),
  switchTab: (id) => ipcRenderer.invoke('switch-tab', id),
  duplicateTab: (id) => ipcRenderer.invoke('duplicate-tab', id),
  reopenClosedTab: () => ipcRenderer.invoke('reopen-closed-tab'),
  navigate: (url) => ipcRenderer.invoke('navigate', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  reload: (ignoreCache) => ipcRenderer.invoke('reload', Boolean(ignoreCache)),
  stop: () => ipcRenderer.invoke('stop'),
  getActiveUrl: () => ipcRenderer.invoke('get-active-url'),
  setViewVisible: (visible) => ipcRenderer.invoke('set-view-visible', visible),
  setViewLayout: (layout) => ipcRenderer.invoke('set-view-layout', layout),
  setSplitScreen: (options) => ipcRenderer.invoke('set-split-screen', options),

  // Active-page operations.
  findInPage: (text, options) => ipcRenderer.invoke('find-in-page', text, options),
  stopFind: () => ipcRenderer.invoke('stop-find'),
  muteTab: (muted) => ipcRenderer.invoke('mute-tab', muted),
  muteTabById: (id, muted) => ipcRenderer.invoke('mute-tab-by-id', { id, muted }),
  setZoom: (factor) => ipcRenderer.invoke('set-zoom', factor),
  screenshot: () => ipcRenderer.invoke('screenshot'),
  printPage: () => ipcRenderer.invoke('print-page'),
  savePagePdf: () => ipcRenderer.invoke('save-page-pdf'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  getPageContext: (options) => ipcRenderer.invoke('get-page-context', options),

  // Profiles, privacy, history, and downloads.
  launchPrivateWindow: () => ipcRenderer.invoke('launch-private-window'),
  isPrivateInstance: () => ipcRenderer.invoke('is-private-instance'),
  getHistory: (query) => ipcRenderer.invoke('get-history', query),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  downloadAction: (id, action) =>
    ipcRenderer.invoke('download-action', { id, action }),
  showDownload: (id) => ipcRenderer.invoke('show-download', id),
  clearBrowsingData: (options) =>
    ipcRenderer.invoke('clear-browsing-data', options),
  getSitePermissions: (url) => ipcRenderer.invoke('get-site-permissions', url),
  setSitePermission: (url, permission, state) =>
    ipcRenderer.invoke('set-site-permission', { originUrl: url, permission, state }),
  get24HReport: () => ipcRenderer.invoke('get-24h-report'),
  extractEmailTasks: () => ipcRenderer.invoke('extract-email-tasks'),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  setActiveWorkspace: (workspaceId) => ipcRenderer.invoke('set-active-workspace', workspaceId),
  addWorkspace: (details) => ipcRenderer.invoke('add-workspace', details),
  deleteWorkspace: (workspaceId) => ipcRenderer.invoke('delete-workspace', workspaceId),
  renameWorkspace: (id, name) => ipcRenderer.invoke('rename-workspace', { id, name }),
  reorderWorkspaces: (workspaceIds) => ipcRenderer.invoke('reorder-workspaces', workspaceIds),
  reorderTabs: (tabIds) => ipcRenderer.invoke('reorder-tabs', tabIds),
  getSavedPasswords: () => ipcRenderer.invoke('get-saved-passwords'),
  savePassword: (credentials) => ipcRenderer.invoke('save-password', credentials),
  deletePassword: (id) => ipcRenderer.invoke('delete-password', id),
  autofillCredentials: (credentials) => ipcRenderer.invoke('autofill-credentials', credentials),
  onShowScreenPicker: (callback) => {
    ipcRenderer.on('show-screen-picker', (event, data) => callback(data));
  },
  selectScreenShareSource: (selection) => ipcRenderer.invoke('select-screen-share-source', selection),
  cancelScreenShare: () => ipcRenderer.invoke('cancel-screen-share'),
  zoomIn: () => ipcRenderer.invoke('zoom-in'),
  zoomOut: () => ipcRenderer.invoke('zoom-out'),
  resetZoom: () => ipcRenderer.invoke('reset-zoom'),

  // Compatible download aliases used by older/newer renderer surfaces.
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  openDownload: (id) => ipcRenderer.invoke('open-download', id),
  showDownloadInFolder: (id) => ipcRenderer.invoke('show-download', id),
  cancelDownload: (id) =>
    ipcRenderer.invoke('download-action', { id, action: 'cancel' }),

  // Window controls.
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  // Safe compatibility layer for existing gaming UI.
  setGamingMode: (level) => ipcRenderer.invoke('set-gaming-mode', level),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  injectPointerLock: () => ipcRenderer.invoke('inject-pointer-lock'),
  launchGamingWindow: () => ipcRenderer.invoke('launch-gaming-window'),
  isGamingInstance: () => ipcRenderer.invoke('is-gaming-instance'),

  // Bookmarks/settings and workspace records.
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  saveBookmarks: (bookmarks) => ipcRenderer.invoke('save-bookmarks', bookmarks),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  logActivity: (item) => ipcRenderer.invoke('log-activity', item),
  getActivityRecords: (timeframe) =>
    ipcRenderer.invoke('get-activity-records', timeframe),
  clearActivityRecords: () =>
    ipcRenderer.invoke('clear-activity-records'),
  getPendingTasks: () => ipcRenderer.invoke('get-pending-tasks'),
  savePendingTasks: (tasks) =>
    ipcRenderer.invoke('save-pending-tasks', tasks),

  // Invicta AI. API secrets are accepted only as save input and are never read back.
  getAiConfig: () => ipcRenderer.invoke('get-ai-config'),
  saveAiConfig: (config) => ipcRenderer.invoke('save-ai-config', config),
  testAiConfig: (config) => ipcRenderer.invoke('test-ai-config', config),
  askInvictaAI: (prompt, options) =>
    ipcRenderer.invoke('ask-invicta-ai', { prompt, options }),
  cancelAiRequest: (requestId) =>
    ipcRenderer.invoke('cancel-ai-request', requestId),

  // Version/update and safe diagnostics.
  getVersion: () => ipcRenderer.invoke('get-version'),
  getReleaseNotes: () => ipcRenderer.invoke('get-release-notes'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
  boostGpuPriority: () => ipcRenderer.invoke('boost-gpu-priority'),

  // Generic event API with allowlisting and a real disposer.
  on: subscribe,
  off: unsubscribe,
};

contextBridge.exposeInMainWorld('electronAPI', api);
