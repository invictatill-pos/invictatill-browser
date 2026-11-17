'use strict';

const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  Menu,
  powerSaveBlocker,
  safeStorage,
  dialog,
  shell,
  clipboard,
  desktopCapturer,
  Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL, fileURLToPath } = require('url');
const Store = require('electron-store');
const { createUpdateController } = require('./updater-controller');
const { createFocusController } = require('./focus-controller');
const {
  chooseRememberedTab,
  restoreWorkspaceMemory,
  serializeWorkspaceMemory,
} = require('./workspace-state');
const { createExtensionManager } = require('./extension-manager');

// Enforce Chromium's renderer sandbox before app.ready.
app.enableSandbox();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('allow-http-screen-capture');
app.commandLine.appendSwitch('enable-features', 'ScreenCapture,WebRTCPipeWireCapturer,OverlayScrollbar,CanvasOopRasterization,PartitionedCookies');
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns,TranslateUI,MediaRouter,OptimizationHints');
// Low-RAM Chromium flags
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256 --optimize-for-size');
app.commandLine.appendSwitch('renderer-process-limit', '5');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('memory-pressure-off');
app.commandLine.appendSwitch('aggressive-cache-discard');
app.commandLine.appendSwitch('purge-memory-button');

const isDev = process.argv.includes('--dev') || !app.isPackaged;
const privateInstance = process.argv.includes('--private-mode');
const gamingInstance = process.argv.includes('--gaming-mode');
const testMode = process.argv.includes('--test-mode') || process.env.INVICTA_TEST_MODE === '1';
const portableInstance = app.isPackaged && Boolean(
  process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR
);
const hasInstanceLock = privateInstance || app.requestSingleInstanceLock();

if (process.platform === 'win32') {
  app.setAppUserModelId('com.invictatill.browser');
}

if (testMode && process.env.INVICTA_TEST_DOWNLOAD_DIR) {
  const isolatedDownloadPath = path.resolve(process.env.INVICTA_TEST_DOWNLOAD_DIR);
  fs.mkdirSync(isolatedDownloadPath, { recursive: true });
  app.setPath('downloads', isolatedDownloadPath);
}

if (!hasInstanceLock) {
  app.quit();
}

const SHELL_FILE = path.resolve(__dirname, 'renderer', 'index.html');
const SHELL_URL = pathToFileURL(SHELL_FILE).toString();
const REMOTE_PRELOAD_FILE = path.resolve(__dirname, 'remote-preload.js');
const WHATSAPP_WEB_URL = testMode && /^https?:\/\//i.test(process.env.INVICTA_TEST_WHATSAPP_URL || '')
  ? process.env.INVICTA_TEST_WHATSAPP_URL
  : 'https://web.whatsapp.com/';
const CHATGPT_WEB_URL = testMode && /^https?:\/\//i.test(process.env.INVICTA_TEST_CHATGPT_URL || '')
  ? process.env.INVICTA_TEST_CHATGPT_URL
  : 'https://chatgpt.com/';
const sidebarPanels = new Map([
  ['whatsapp', { id: 'whatsapp', title: 'WhatsApp', url: WHATSAPP_WEB_URL, surfaces: new Map() }],
  ['chatgpt', { id: 'chatgpt', title: 'ChatGPT', url: CHATGPT_WEB_URL, surfaces: new Map() }],
]);
const NORMAL_PARTITION = 'persist:invictatill';
const PRIVATE_PARTITION = 'invictatill-private-' + process.pid;
const REMOTE_PARTITION = privateInstance ? PRIVATE_PARTITION : NORMAL_PARTITION;
const SHELL_PARTITION = privateInstance
  ? PRIVATE_PARTITION + '-shell'
  : 'persist:invictatill-shell';
const WHATSAPP_PARTITION = privateInstance
  ? PRIVATE_PARTITION + '-whatsapp'
  : 'persist:invictatill-whatsapp';

const MAX_TABS = 100;
const MAX_CLOSED_TABS = 25;
const MAX_HISTORY = 5000;
const MAX_DOWNLOADS = 500;
const MAX_BOOKMARKS = 1000;
const MAX_TASKS = 1000;
const MAX_ACTIVITY_RECORDS = 10000;
const MAX_URL_LENGTH = 8192;
const MAX_DATA_URL_LENGTH = 64 * 1024 * 1024;
const MAX_PAGE_CONTEXT = 50000;

function backgroundTabThrottlingEnabled() {
  return !store || store.get('backgroundTabThrottling', true) !== false;
}
const SCREEN_SHARE_REQUEST_TIMEOUT_MS = 120000;

let mainWindow = null;
let browserSession = null;
let whatsappSession = null;
let activeSidebarPanel = null;
let selectedSidebarSurface = null;
let shownSidebarSurface = null;
let sidebarPanelBounds = { x: 48, y: 176, width: 720, height: 640 };
let store = null;
let powerBlockerId = null;
let currentGamingLevel = 0;
let nextTabId = 1;
let activeTabId = null;
const DEFAULT_VIEW_LAYOUT = {
  top: 34 + 42 + 52,
  left: 48,
  right: 0,
  bottom: 0,
};
const FULLSCREEN_VIEW_LAYOUT = {
  top: 0,
  left: 0,
};
let tabsVisible = false;
let shellLayoutReady = false;
let viewLayout = { ...DEFAULT_VIEW_LAYOUT };
let splitScreen = { enabled: false, secondaryTabId: null };
let sessionSaveTimer = null;
let historySaveTimer = null;
let downloadsSaveTimer = null;
let privateLaunchPending = false;

const tabs = new Map();
const closedTabs = [];
const liveDownloads = new Map();
const configuredDownloadSessions = new WeakSet();
const pendingCredentialPrompts = new Map();
const recentCredentialUsernames = new Map();
const pendingHttpAuthCallbacks = new Map(); // requestId → { callback, timeout, tabId, contentsId }
const popupOwnerTabIds = new Map();
const configuredDeviceSessions = new WeakSet();
let historyRecords = [];
let downloadRecords = [];
let permissionGrants = {};
let extensionManager = null;

const DEFAULT_WORKSPACES = [
  { id: 'default', name: 'Default', icon: '🌐', color: '#6366f1' },
  { id: 'work', name: 'Work', icon: '🏢', color: '#3b82f6' },
  { id: 'personal', name: 'Personal', icon: '🏠', color: '#10b981' },
];

let workspaceList = [...DEFAULT_WORKSPACES];
let activeWorkspaceId = 'default';
const workspaceSessionsMap = new Map();
let lastActiveTabByWorkspace = new Map();

function getWorkspaceDetails(workspaceId) {
  const targetId = workspaceId || activeWorkspaceId || 'default';
  const found = workspaceList.find((w) => w.id === targetId);
  if (found) return found;
  return { id: targetId, name: targetId, icon: '📂', color: '#6366f1' };
}

function getWorkspaceTabs(workspaceId) {
  const targetId = workspaceId || activeWorkspaceId || 'default';
  return Array.from(tabs.values()).filter(
    (tab) => (tab.workspaceId || 'default') === targetId
  ).sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)));
}

function rememberWorkspaceTab(tab) {
  if (!tab) return;
  lastActiveTabByWorkspace.set(tab.workspaceId || 'default', tab.id);
}

function activateWorkspace(workspaceId) {
  const found = workspaceList.find((workspace) => workspace.id === workspaceId);
  if (!found) return getBrowserState();
  if (activeWorkspaceId !== found.id) {
    splitScreen = { enabled: false, secondaryTabId: null };
  }
  activeWorkspaceId = found.id;
  const workspaceTabs = getWorkspaceTabs(activeWorkspaceId);
  const target = chooseRememberedTab(
    activeWorkspaceId,
    workspaceTabs,
    lastActiveTabByWorkspace.get(activeWorkspaceId)
  );
  if (target) switchTab(target.id);
  else createTab('about:blank', { workspaceId: activeWorkspaceId, activate: true });
  return getBrowserState();
}

let pendingScreenShareRequest = null;
let nextScreenShareRequestId = 1;

function completeScreenShareRequest(streams, expectedRequestId) {
  const pending = pendingScreenShareRequest;
  if (!pending || (expectedRequestId && pending.id !== expectedRequestId)) return false;
  pendingScreenShareRequest = null;
  clearTimeout(pending.timeout);
  sendToShell('close-screen-picker', { requestId: pending.id });
  try {
    pending.callback(streams || {});
  } catch (error) {
    return false;
  }
  return true;
}

function screenShareTabs() {
  return Array.from(tabs.values())
    .filter((tab) => tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed())
    .map((tab) => ({
      id: 'tab:' + tab.id,
      title: tab.title || tab.url || 'Untitled tab',
      url: tab.url,
      workspaceId: tab.workspaceId || 'default',
      workspaceName: getWorkspaceDetails(tab.workspaceId).name,
      favicon: tab.favicon || null,
      active: tab.id === activeTabId,
    }));
}

function configureScreenSharePicker(targetSession) {
  if (!targetSession) return;

  try {
    if (typeof targetSession.setDisplayMediaRequestHandler === 'function') {
      targetSession.setDisplayMediaRequestHandler(async (request, callback) => {
        if (!request || !request.videoRequested || !request.frame || request.frame.isDestroyed()) {
          callback({});
          return;
        }

        completeScreenShareRequest({}, null);
        const requestId = 'share-' + nextScreenShareRequestId++;
        const pending = {
          id: requestId,
          callback,
          requestFrame: request.frame,
          origin: permissionOrigin(null, { securityOrigin: request.securityOrigin }, null) || '',
          audioRequested: Boolean(request.audioRequested),
          desktopSources: new Map(),
          timeout: null,
        };
        pending.timeout = setTimeout(() => {
          completeScreenShareRequest({}, requestId);
        }, SCREEN_SHARE_REQUEST_TIMEOUT_MS);
        pendingScreenShareRequest = pending;

        if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
          completeScreenShareRequest({}, requestId);
          return;
        }
        // Show tab choices immediately. Windows source enumeration can stall on
        // certain DXGI/GDI driver combinations and must not block the consent UI.
        sendToShell('show-screen-picker', {
          requestId,
          origin: pending.origin,
          audioRequested: pending.audioRequested,
          desktopSourcesLoading: true,
          screens: [],
          windows: [],
          tabs: screenShareTabs(),
        });

        let sources = [];
        try {
          sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            fetchWindowIcons: false,
            // Native thumbnail capture is unstable on some Windows/GDI drivers.
            thumbnailSize: { width: 0, height: 0 },
          });
        } catch (error) {
          sources = [];
        }
        if (!pendingScreenShareRequest || pendingScreenShareRequest.id !== requestId) return;

        const screens = [];
        const windows = [];
        sources.forEach((source, index) => {
          if (!source || !source.id) return;
          const pickerId = 'desktop:' + index;
          pending.desktopSources.set(pickerId, source);
          const item = {
            id: pickerId,
            name: source.name || (source.id.startsWith('screen:') ? 'Entire Screen' : 'Application Window'),
            thumbnail: null,
          };
          if (source.id.startsWith('screen:')) screens.push(item);
          else if (source.id.startsWith('window:')) windows.push(item);
        });
        sendToShell('update-screen-picker-sources', {
          requestId,
          desktopSourcesLoading: false,
          screens,
          windows,
        });
      });
    }
  } catch (error) {
    // Older Electron builds may not expose custom display-media handlers.
  }
}

function workspacePartitionName(workspaceId) {
  const targetId = workspaceId || activeWorkspaceId || 'default';
  const cleanId = String(targetId).replace(/[^a-zA-Z0-9_-]/g, '');
  return privateInstance ? 'workspace_priv_' + cleanId : 'persist:workspace_' + cleanId;
}

function getWorkspaceSession(workspaceId) {
  const targetId = workspaceId || activeWorkspaceId || 'default';
  const cleanId = String(targetId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (workspaceSessionsMap.has(cleanId)) {
    const cached = workspaceSessionsMap.get(cleanId);
    if (extensionManager && !privateInstance && !extensionManager.isSessionRegistered(cached)) {
      extensionManager.registerSession(cached);
    }
    return cached;
  }

  const partitionName = workspacePartitionName(targetId);
  const sess = privateInstance
    ? session.fromPartition(partitionName, { inMemory: true })
    : session.fromPartition(partitionName);

  sess.setUserAgent(chromeCompatibilityUserAgent(), 'en-US,en;q=0.9');
  sess.setSpellCheckerEnabled(true);
  sess.setSpellCheckerLanguages(['en-US', 'en-GB']);
  configurePermissions(sess);
  configureDeviceSelection(sess);
  configureScreenSharePicker(sess);
  configureDownloads(sess, { sessionKind: 'workspace', workspaceId: targetId });
  configureSessionClientHints(sess);
  if (extensionManager && !privateInstance) {
    extensionManager.registerSession(sess);
  }
  workspaceSessionsMap.set(cleanId, sess);
  return sess;
}

function loadWorkspaces() {
  if (store && !privateInstance) {
    const saved = store.get('browser_workspaces_v2');
    if (Array.isArray(saved) && saved.length > 0) {
      workspaceList = saved;
    }
  }
}

function saveWorkspaces() {
  if (store && !privateInstance) {
    store.set('browser_workspaces_v2', workspaceList);
  }
}

let autoUpdater = null;
let updateController = null;
let focusController = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
  autoUpdater = null;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, name) {
  if (!isPlainObject(value)) {
    throw new TypeError((name || 'value') + ' must be a plain object');
  }
  return value;
}

function boundedString(value, name, maxLength, allowEmpty) {
  if (typeof value !== 'string') {
    throw new TypeError((name || 'value') + ' must be a string');
  }
  const result = value.trim();
  if (!allowEmpty && !result) {
    throw new TypeError((name || 'value') + ' cannot be empty');
  }
  if (result.length > maxLength) {
    throw new RangeError((name || 'value') + ' is too long');
  }
  return result;
}

function boundedNumber(value, name, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError((name || 'value') + ' is outside the allowed range');
  }
  return value;
}

function boundedInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError((name || 'value') + ' must be an allowed integer');
  }
  return value;
}

function boundedJsonClone(value, name, maxBytes) {
  let json;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    throw new TypeError((name || 'value') + ' must be JSON serializable');
  }
  if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > maxBytes) {
    throw new RangeError((name || 'value') + ' is too large');
  }
  return JSON.parse(json);
}

function isShellUrl(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'file:') return false;
    const candidatePath = path.resolve(fileURLToPath(parsed)).toLowerCase();
    return candidatePath === SHELL_FILE.toLowerCase();
  } catch (error) {
    return false;
  }
}

function isAllowedRemoteUrl(candidate, allowBlank) {
  if (allowBlank && candidate === 'about:blank') return true;
  if (typeof candidate !== 'string' || candidate.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (error) {
    return false;
  }
}

function isAllowedExtensionUrl(candidate) {
  if (typeof candidate !== 'string') return false;
  return /^chrome-extension:\/\/[a-z]{32}\//i.test(candidate);
}

function isAllowedFileUrl(candidate) {
  if (typeof candidate !== 'string' || candidate.length > 32768) return false;
  try {
    return new URL(candidate).protocol === 'file:';
  } catch (error) {
    return false;
  }
}

function isAllowedBlobUrl(candidate) {
  if (typeof candidate !== 'string' || candidate.length > MAX_URL_LENGTH + 10) return false;
  if (!/^blob:(?:https?|file):/i.test(candidate)) return false;
  try {
    const inner = new URL(candidate.slice(5));
    return inner.protocol === 'https:' || inner.protocol === 'http:' || inner.protocol === 'file:';
  } catch (error) {
    return false;
  }
}

function isAllowedDataUrl(candidate) {
  if (typeof candidate !== 'string' || candidate.length > MAX_DATA_URL_LENGTH) return false;
  const commaIndex = candidate.indexOf(',');
  if (commaIndex < 5) return false;
  const metadata = candidate.slice(5, commaIndex);
  const mediaType = (metadata.split(';')[0] || 'text/plain').toLowerCase();
  return /^(?:text\/(?:plain|html|css|csv|xml)|image\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/(?:pdf|json|xml|octet-stream|zip|vnd\.[a-z0-9.+-]+))$/.test(mediaType);
}

const EXTERNAL_PROTOCOLS = new Set([
  'mailto:',
  'tel:',
  'sms:',
  'smsto:',
  'webcal:',
  'magnet:',
  'geo:',
  'spotify:',
  'zoommtg:',
  'msteams:',
  'slack:',
  'tg:',
  'discord:',
  'skype:',
  'whatsapp:',
  'vscode:',
  'vscode-insiders:',
  'steam:',
  'notion:',
  'figma:',
]);

function safeExternalProtocolUrl(candidate) {
  if (typeof candidate !== 'string' || candidate.length > MAX_URL_LENGTH) return null;
  try {
    const parsed = new URL(candidate);
    return EXTERNAL_PROTOCOLS.has(parsed.protocol.toLowerCase()) ? parsed.href : null;
  } catch (error) {
    return null;
  }
}

function isNewTabUrl(url) {
  const value = String(url || '').trim().toLowerCase();
  return !value || value === 'about:blank' || value === 'invicta://newtab' || value === 'invictatill://newtab' || value === 'chrome://newtab';
}

function normalizeNavigationUrl(input) {
  if (input === undefined || input === null || isNewTabUrl(input)) return 'about:blank';
  const inputText = String(input).trim();
  const maxLength = /^data:/i.test(inputText) ? MAX_DATA_URL_LENGTH : 32768;
  const raw = boundedString(inputText, 'url', maxLength, true);
  if (!raw || isNewTabUrl(raw)) return 'about:blank';

  // Local paths and file URLs are rendered in Chromium just as they are in Chrome.
  if (/^[a-zA-Z]:[\\/]/.test(raw) || /^\\\\/.test(raw)) {
    return pathToFileURL(path.resolve(raw)).toString();
  }
  if (isAllowedFileUrl(raw)) return new URL(raw).toString();
  // Allow view-source for normal web pages and local files.
  if (/^view-source:(?:https?|file):/i.test(raw)) return raw;
  // Allow blob: URLs from valid origins (report generators use these for downloads/previews).
  if (isAllowedBlobUrl(raw)) return raw;
  // Chromium safely isolates top-level data documents in an opaque origin.
  if (isAllowedDataUrl(raw)) return raw;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    if (isAllowedRemoteUrl(raw, true)) {
      return new URL(raw).toString();
    }
    return 'https://www.google.com/search?q=' + encodeURIComponent(raw);
  }

  if (/\s/.test(raw)) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(raw);
  }

  const localHost = /^(localhost|127(?:\.[0-9]+){3}|\[::1\])(?::[0-9]+)?(?:\/|$)/i.test(raw);
  const looksLikeHost = localHost || raw.includes('.');
  if (looksLikeHost) {
    const candidate = (localHost ? 'http://' : 'https://') + raw;
    if (isAllowedRemoteUrl(candidate, false)) {
      return new URL(candidate).toString();
    }
  }

  return 'https://www.google.com/search?q=' + encodeURIComponent(raw);
}

function safeRemoteUrl(candidate) {
  if (!isAllowedRemoteUrl(candidate, false)) return null;
  try {
    return new URL(candidate).toString();
  } catch (error) {
    return null;
  }
}

function safeBrowsableUrl(candidate, allowBlank) {
  if (isAllowedRemoteUrl(candidate, Boolean(allowBlank))) {
    return candidate === 'about:blank' ? candidate : new URL(candidate).toString();
  }
  if (isAllowedFileUrl(candidate)) return new URL(candidate).toString();
  if (isAllowedBlobUrl(candidate) || isAllowedDataUrl(candidate)) return candidate;
  if (isAllowedExtensionUrl(candidate)) return candidate;
  if (typeof candidate === 'string' && candidate.length <= 32768 &&
      /^view-source:(?:https?|file):/i.test(candidate)) {
    return candidate;
  }
  return null;
}

async function confirmOpenExternalUrl(candidate, sourceWindow) {
  const target = safeExternalProtocolUrl(candidate);
  if (!target) return false;
  const parsed = new URL(target);
  const options = {
    type: 'question',
    title: 'Open external application?',
    message: 'Allow this site to open a ' + parsed.protocol.slice(0, -1) + ' link?',
    detail: target.slice(0, 1000),
    buttons: ['Cancel', 'Open application'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  };
  const response = sourceWindow && !sourceWindow.isDestroyed()
    ? await dialog.showMessageBox(sourceWindow, options)
    : await dialog.showMessageBox(options);
  if (response.response !== 1) return false;
  await shell.openExternal(target, { activate: true });
  return true;
}

function isAllowedDownloadUrl(candidate) {
  if (typeof candidate !== 'string' || candidate.length > MAX_URL_LENGTH + 10) return false;
  // Allow standard http/https URLs.
  if (isAllowedRemoteUrl(candidate, false)) return candidate;
  // Allow blob: URLs whose embedded origin is http/https (used by report
  // generators like Skolaro to create Excel, CSV, and PDF downloads).
  if (/^blob:https?:\/\//i.test(candidate)) {
    try {
      const inner = candidate.slice(5);
      const parsed = new URL(inner);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return candidate;
    } catch (error) {
      // Malformed blob: URL, fall through.
    }
  }
  // Allow data: URIs for dynamically generated file downloads.
  if (/^data:[a-z0-9/+.-]+;/i.test(candidate)) return candidate;
  return null;
}

function trustedIpcSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (event.sender !== mainWindow.webContents) return false;
  const senderUrl = event.senderFrame && event.senderFrame.url
    ? event.senderFrame.url
    : event.sender.getURL();
  return isShellUrl(senderUrl);
}

function tabForRemoteContents(contents) {
  if (!contents) return null;
  for (const tab of tabs.values()) {
    if (tab.view && tab.view.webContents === contents) return tab;
  }
  const ownerTabId = popupOwnerTabIds.get(contents.id);
  if (ownerTabId && tabs.has(ownerTabId)) return tabs.get(ownerTabId);
  for (const panel of sidebarPanels.values()) {
    for (const surface of panel.surfaces.values()) {
      if (surface.view.webContents === contents || surface.id === ownerTabId) return surface;
    }
  }
  return null;
}

function trustedCredentialSender(event, claimedOrigin) {
  if (privateInstance || !event || !event.sender) return null;
  const tab = tabForRemoteContents(event.sender);
  if (!tab) return null;
  const senderUrl = event.senderFrame && event.senderFrame.url
    ? event.senderFrame.url
    : event.sender.getURL();
  try {
    const parsed = new URL(senderUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (typeof claimedOrigin !== 'string' || new URL(claimedOrigin).origin !== parsed.origin) {
      return null;
    }
    return { tab, origin: parsed.origin };
  } catch (error) {
    return null;
  }
}

function trustedPageOpenSender(event, claimedOrigin, targetUrl) {
  if (!event || !event.sender) return null;
  const tab = tabForRemoteContents(event.sender);
  if (!tab) return null;
  const senderUrl = event.senderFrame && event.senderFrame.url
    ? event.senderFrame.url
    : event.sender.getURL();
  try {
    const parsedSender = new URL(senderUrl);
    if (parsedSender.protocol !== 'https:' && parsedSender.protocol !== 'http:') return null;
    if (typeof claimedOrigin !== 'string' || new URL(claimedOrigin).origin !== parsedSender.origin) {
      return null;
    }
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') return null;
    return { tab, url: parsedTarget.href };
  } catch (error) {
    return null;
  }
}

function registerHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!trustedIpcSender(event)) {
      throw new Error('Blocked IPC call from an untrusted sender');
    }
    return handler(event, ...args);
  });
}

function sendToShell(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function navigationApi(contents) {
  return contents && contents.navigationHistory ? contents.navigationHistory : contents;
}

function canGoBack(contents) {
  try {
    const navigation = navigationApi(contents);
    return Boolean(navigation && navigation.canGoBack());
  } catch (error) {
    return false;
  }
}

function canGoForward(contents) {
  try {
    const navigation = navigationApi(contents);
    return Boolean(navigation && navigation.canGoForward());
  } catch (error) {
    return false;
  }
}

function publicTab(tab) {
  if (!tab) return null;
  const contents = tab.view.webContents;
  const active = tab.id === activeTabId;
  const ws = getWorkspaceDetails(tab.workspaceId);
  return {
    id: tab.id,
    title: tab.title || 'New Tab',
    url: tab.url || 'about:blank',
    pageOwned: Boolean(tab.pageOwned),
    favicon: tab.favicon || '',
    isLoading: Boolean(tab.isLoading),
    loading: Boolean(tab.isLoading),
    canGoBack: canGoBack(contents),
    canGoForward: canGoForward(contents),
    isMuted: Boolean(tab.isMuted),
    muted: Boolean(tab.isMuted),
    audible: Boolean(tab.audible),
    zoom: tab.zoom,
    crashed: Boolean(tab.crashed),
    pinned: Boolean(tab.pinned),
    readingMode: Boolean(tab.readingModeStyle),
    workspaceId: tab.workspaceId || 'default',
    workspaceName: ws.name,
    workspaceIcon: ws.icon,
    workspaceColor: ws.color,
    active,
  };
}

function getBrowserState() {
  const currentWorkspaceTabs = getWorkspaceTabs(activeWorkspaceId);
  return {
    tabs: currentWorkspaceTabs.map(publicTab),
    activeTabId,
    activeTab: activeTabId,
    splitScreen: splitScreen.enabled,
    secondaryTabId: splitScreen.secondaryTabId,
    viewVisible: tabsVisible,
    viewLayout: { ...viewLayout },
    zoomFactor: getActiveTab() ? getActiveTab().zoom : 1,
    isPrivate: privateInstance,
    closedTabCount: closedTabs.length,
    workspaces: workspaceList,
    activeWorkspaceId,
    activeWorkspace: getWorkspaceDetails(activeWorkspaceId),
  };
}

function getAllTabs() {
  return workspaceList.flatMap((workspace) => getWorkspaceTabs(workspace.id).map(publicTab));
}

function getTab(id) {
  const tabId = boundedInteger(id, 'tab id', 1, Number.MAX_SAFE_INTEGER);
  const tab = tabs.get(tabId);
  if (!tab) throw new Error('Tab not found');
  return tab;
}

function getActiveTab() {
  return activeTabId === null ? null : tabs.get(activeTabId) || null;
}

function emitTab(channel, tab) {
  sendToShell(channel, publicTab(tab));
}

function scheduleSessionSave() {
  if (privateInstance || !store) return;
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(flushSessionState, 400);
}

function flushSessionState() {
  if (sessionSaveTimer) {
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = null;
  }
  if (privateInstance || !store) return;
  const persistedTabs = Array.from(tabs.values()).slice(0, 30);
  const serializedTabs = persistedTabs
    .map((tab) => ({
      url: isAllowedRemoteUrl(tab.url, true) ? tab.url : 'about:blank',
      zoom: tab.zoom,
      muted: tab.isMuted,
      pinned: Boolean(tab.pinned),
      workspaceId: tab.workspaceId || 'default',
    }));
  const activeIndex = Math.max(
    0,
    persistedTabs.findIndex((tab) => tab.id === activeTabId)
  );
  store.set('browser_session_v2', {
    tabs: serializedTabs,
    activeIndex,
    activeWorkspaceId,
    lastActiveTabIndexes: serializeWorkspaceMemory(persistedTabs, lastActiveTabByWorkspace),
    savedAt: Date.now(),
  });
}

function scheduleHistorySave() {
  if (privateInstance || !store) return;
  if (historySaveTimer) clearTimeout(historySaveTimer);
  historySaveTimer = setTimeout(() => {
    historySaveTimer = null;
    store.set('browser_history_v2', historyRecords.slice(-MAX_HISTORY));
  }, 500);
}

function scheduleDownloadsSave() {
  if (privateInstance || !store) return;
  if (downloadsSaveTimer) clearTimeout(downloadsSaveTimer);
  downloadsSaveTimer = setTimeout(() => {
    downloadsSaveTimer = null;
    store.set('browser_downloads_v2', downloadRecords.slice(-MAX_DOWNLOADS));
  }, 750);
}

function recordHistory(tab, url) {
  if (!tab || !isAllowedRemoteUrl(url, false)) return;
  const now = Date.now();
  const last = historyRecords[historyRecords.length - 1];
  if (last && last.url === url && now - last.visitedAt < 3000) {
    last.title = tab.title || last.title;
    last.visitedAt = now;
  } else {
    historyRecords.push({
      id: 'history-' + now + '-' + Math.random().toString(36).slice(2, 8),
      url,
      title: tab.title || url,
      visitedAt: now,
    });
  }
  if (historyRecords.length > MAX_HISTORY) {
    historyRecords.splice(0, historyRecords.length - MAX_HISTORY);
  }
  scheduleHistorySave();
}

function refreshHistoryTitle(tab) {
  if (!tab || !tab.url) return;
  for (let index = historyRecords.length - 1; index >= 0; index -= 1) {
    if (historyRecords[index].url === tab.url) {
      historyRecords[index].title = tab.title || tab.url;
      scheduleHistorySave();
      return;
    }
  }
}

function chromeCompatibilityUserAgent() {
  const chromeVersion = /^\d+(?:\.\d+){3}$/.test(String(process.versions.chrome || ''))
    ? process.versions.chrome
    : '136.0.0.0';
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + chromeVersion + ' Safari/537.36';
}

// Child windows begin navigating before `did-create-window` can customize their
// WebContents, so the application fallback must also be a supported Chrome identity.
app.userAgentFallback = chromeCompatibilityUserAgent();

const configuredClientHintSessions = new WeakSet();
function configureSessionClientHints(targetSession) {
  if (!targetSession || !targetSession.webRequest || configuredClientHintSessions.has(targetSession)) return;
  configuredClientHintSessions.add(targetSession);
  const chromeVer = /^\d+(?:\.\d+){3}$/.test(String(process.versions.chrome || ''))
    ? process.versions.chrome
    : '136.0.0.0';
  const major = chromeVer.split('.')[0];
  const chromeUA = chromeCompatibilityUserAgent();
  const brandHeader = '"Chromium";v="' + major + '", "Google Chrome";v="' + major + '", "Not?A_Brand";v="99"';

  try {
    targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      headers['User-Agent'] = chromeUA;
      if (headers['Sec-CH-UA'] || headers['sec-ch-ua'] || (details.url && /^https?:\/\//i.test(details.url))) {
        headers['Sec-CH-UA'] = brandHeader;
        headers['Sec-CH-UA-Mobile'] = '?0';
        headers['Sec-CH-UA-Platform'] = '"Windows"';
      }
      callback({ requestHeaders: headers });
    });
  } catch (error) {
    // webRequest listener already registered or unavailable
  }
}

function isWhatsAppWebUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.hostname.toLowerCase() === 'web.whatsapp.com') return true;
    if (!testMode) return false;
    const configured = new URL(WHATSAPP_WEB_URL);
    return parsed.origin === configured.origin && parsed.pathname === configured.pathname;
  } catch (error) {
    return false;
  }
}

function applyTabUserAgent(tab, url) {
  if (!tab || !tab.view || tab.view.webContents.isDestroyed()) return;
  const userAgent = isWhatsAppWebUrl(url)
    ? chromeCompatibilityUserAgent()
    : tab.defaultUserAgent;
  if (userAgent && tab.view.webContents.getUserAgent() !== userAgent) {
    tab.view.webContents.setUserAgent(userAgent);
  }
}

function loadTabContents(tab, url) {
  applyTabUserAgent(tab, url);
  const options = isWhatsAppWebUrl(url)
    ? { userAgent: chromeCompatibilityUserAgent() }
    : undefined;
  return tab.view.webContents.loadURL(url, options);
}

function safeViewSetVisible(view, visible) {
  try {
    view.setVisible(Boolean(visible));
  } catch (error) {
    // The view may already be detached during shutdown.
  }
}

function hasPendingHttpAuthForTab(tab) {
  if (!tab) return false;
  for (const entry of pendingHttpAuthCallbacks.values()) {
    if (entry.tabId === tab.id) return true;
  }
  return false;
}

function completeHttpAuthRequest(requestId, username, password, reason) {
  const entry = pendingHttpAuthCallbacks.get(requestId);
  if (!entry) return null;
  pendingHttpAuthCallbacks.delete(requestId);
  clearTimeout(entry.timeout);
  sendToShell('http-auth-closed', { requestId, tabId: entry.tabId, reason });
  try {
    // Empty credentials are another login attempt; no arguments cancel it.
    if (username || password) entry.callback(username || '', password || '');
    else entry.callback();
  } catch (error) {}
  resizeTabViewToCurrentLayout(tabs.get(entry.tabId));
  resizeViews();
  return entry;
}

function cancelHttpAuthRequestsForTab(tabId, reason) {
  for (const [requestId, entry] of Array.from(pendingHttpAuthCallbacks)) {
    if (entry.tabId === tabId) completeHttpAuthRequest(requestId, '', '', reason);
  }
}

function cancelHttpAuthRequestsForContents(contentsId, reason) {
  for (const [requestId, entry] of Array.from(pendingHttpAuthCallbacks)) {
    if (entry.contentsId === contentsId) completeHttpAuthRequest(requestId, '', '', reason);
  }
}

function attachHttpAuthLifecycle(contents) {
  contents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    // The challenged navigation starts before login is emitted. A later main
    // frame navigation supersedes its pending prompt; hash changes do not.
    if (isMainFrame && !isInPlace) {
      cancelHttpAuthRequestsForContents(contents.id, 'navigation');
    }
  });
  contents.once('destroyed', () => {
    cancelHttpAuthRequestsForContents(contents.id, 'destroyed');
  });
}

function splitSecondaryTab(primary) {
  if (!primary || !splitScreen.enabled) return null;
  const secondary = tabs.get(splitScreen.secondaryTabId);
  return secondary && secondary.id !== primary.id &&
    (secondary.workspaceId || 'default') === (primary.workspaceId || 'default')
    ? secondary
    : null;
}

function resizeTabViewToCurrentLayout(tab) {
  if (!tab || !tab.view || !mainWindow || mainWindow.isDestroyed()) return;
  if (tab.isHtmlFullscreen) {
    const [fullWidth, fullHeight] = mainWindow.getContentSize();
    tab.view.setBounds({ x: 0, y: 0, width: Math.max(1, fullWidth), height: Math.max(1, fullHeight) });
    return;
  }
  const bounds = viewBoundsForLayout(viewLayout);
  if (!bounds) return;
  viewLayout = bounds.layout;
  const { x, y, width, height } = bounds;
  const primary = getActiveTab();
  const secondary = splitSecondaryTab(primary);
  if (secondary && (tab.id === primary.id || tab.id === secondary.id)) {
    const leftWidth = Math.max(1, Math.floor(width / 2));
    const rightWidth = Math.max(1, width - leftWidth);
    if (tab.id === primary.id) {
      tab.view.setBounds({ x, y, width: leftWidth, height });
    } else {
      tab.view.setBounds({ x: x + leftWidth, y, width: rightWidth, height });
    }
    return;
  }
  tab.view.setBounds({ x, y, width, height });
}

function minimumViewLayout() {
  return mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()
    ? FULLSCREEN_VIEW_LAYOUT
    : DEFAULT_VIEW_LAYOUT;
}

function normalizeViewLayout(layout, minLayout) {
  const source = isPlainObject(layout) ? layout : {};
  let minimum = minLayout || minimumViewLayout();
  if (source.compact === true && minimum.top === DEFAULT_VIEW_LAYOUT.top) {
    minimum = { ...minimum, top: 34 + 34 + 44 };
  }
  return {
    top: boundedNumber(
      source.top === undefined ? minimum.top : Math.max(minimum.top, source.top),
      'layout.top',
      0,
      5000
    ),
    left: boundedNumber(
      source.left === undefined ? minimum.left : Math.max(minimum.left, source.left),
      'layout.left',
      0,
      5000
    ),
    right: boundedNumber(
      source.right === undefined ? 0 : source.right,
      'layout.right',
      0,
      5000
    ),
    bottom: boundedNumber(
      source.bottom === undefined ? 0 : source.bottom,
      'layout.bottom',
      0,
      5000
    ),
    ...(source.compact === true ? { compact: true } : {}),
  };
}

function viewBoundsForLayout(layout) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const content = mainWindow.getContentBounds();
  const guardedLayout = normalizeViewLayout(layout);
  const x = Math.min(Math.max(0, Math.round(guardedLayout.left || 0)), content.width);
  const y = Math.min(Math.max(0, Math.round(guardedLayout.top)), content.height);
  const right = Math.min(Math.max(0, Math.round(guardedLayout.right)), content.width - x);
  const bottom = Math.min(Math.max(0, Math.round(guardedLayout.bottom)), content.height - y);
  const width = Math.max(1, content.width - x - right);
  const height = Math.max(1, content.height - y - bottom);
  return { x, y, width, height, layout: guardedLayout };
}

function prepareRemoteContentView(view, layout) {
  if (!view) return;
  safeViewSetVisible(view, false);
  const bounds = viewBoundsForLayout(layout || viewLayout);
  if (!bounds) return;
  view.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
}

function resizeViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = viewBoundsForLayout(viewLayout);
  if (!bounds) return;
  viewLayout = bounds.layout;
  const primary = getActiveTab();
  const secondary = splitSecondaryTab(primary);
  const fullscreenTab = [primary, secondary].find((tab) =>
    tab && tab.isHtmlFullscreen && !hasPendingHttpAuthForTab(tab));

  for (const tab of tabs.values()) {
    safeViewSetVisible(tab.view, false);
  }
  resizeSidebarView(!fullscreenTab && !mainWindow.isFullScreen());

  if (!shellLayoutReady || !tabsVisible || !primary) return;
  if ((primary.workspaceId || 'default') !== activeWorkspaceId) return;

  if (fullscreenTab) {
    resizeTabViewToCurrentLayout(fullscreenTab);
    safeViewSetVisible(fullscreenTab.view, true);
    return;
  }

  const primaryCanShow = !hasPendingHttpAuthForTab(primary) &&
    (primary.pageOwned || primary.url !== 'about:blank');
  const secondaryCanShow = secondary && !hasPendingHttpAuthForTab(secondary) &&
    (secondary.pageOwned || secondary.url !== 'about:blank');

  resizeTabViewToCurrentLayout(primary);
  safeViewSetVisible(primary.view, primaryCanShow);
  if (secondary) {
    resizeTabViewToCurrentLayout(secondary);
    safeViewSetVisible(secondary.view, Boolean(secondaryCanShow));
  }
}

function setViewVisible(visible) {
  if (typeof visible !== 'boolean') {
    throw new TypeError('visible must be a boolean');
  }
  tabsVisible = visible;
  resizeViews();
  return getBrowserState();
}

function setViewLayout(layout) {
  assertPlainObject(layout, 'layout');
  const next = normalizeViewLayout(layout);
  shellLayoutReady = true;
  viewLayout = next;
  resizeViews();
  return { ...viewLayout };
}

function setSplitScreen(options) {
  assertPlainObject(options, 'split screen options');
  if (typeof options.enabled !== 'boolean') {
    throw new TypeError('enabled must be a boolean');
  }

  if (!options.enabled) {
    splitScreen = { enabled: false, secondaryTabId: null };
  } else {
    let secondaryId = options.secondaryTabId;
    if (secondaryId !== undefined && secondaryId !== null) {
      secondaryId = getTab(secondaryId).id;
    } else {
      const alternative = getWorkspaceTabs(activeWorkspaceId).find((tab) => tab.id !== activeTabId);
      secondaryId = alternative ? alternative.id : null;
    }
    if (!secondaryId || secondaryId === activeTabId) {
      throw new Error('Split screen requires a different secondary tab');
    }
    if ((getTab(secondaryId).workspaceId || 'default') !== activeWorkspaceId) {
      throw new Error('Split screen tabs must belong to the same workspace');
    }
    splitScreen = { enabled: true, secondaryTabId: secondaryId };
  }
  resizeViews();
  scheduleSessionSave();
  return getBrowserState();
}

function isAllowedNavigationUrl(candidate) {
  return Boolean(safeBrowsableUrl(candidate, true));
}

function attachNavigationGuards(contents) {
  contents.on('will-navigate', (event, url) => {
    const currentUrl = contents.getURL();
    const remoteToLocal = isAllowedRemoteUrl(currentUrl, false) &&
      (isAllowedFileUrl(url) || isAllowedDataUrl(url) || /^view-source:file:/i.test(url));
    if (remoteToLocal) {
      event.preventDefault();
      return;
    }
    if (!isAllowedNavigationUrl(url)) {
      event.preventDefault();
      if (safeExternalProtocolUrl(url)) {
        setImmediate(() => confirmOpenExternalUrl(url, mainWindow).catch(() => {}));
      }
    }
  });

  contents.on('will-redirect', (event, url) => {
    const currentUrl = contents.getURL();
    const remoteToLocal = isAllowedRemoteUrl(currentUrl, false) &&
      (isAllowedFileUrl(url) || isAllowedDataUrl(url) || /^view-source:file:/i.test(url));
    if (remoteToLocal) {
      event.preventDefault();
      return;
    }
    if (!isAllowedNavigationUrl(url)) {
      event.preventDefault();
      if (safeExternalProtocolUrl(url)) {
        setImmediate(() => confirmOpenExternalUrl(url, mainWindow).catch(() => {}));
      }
    }
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

function handleShortcut(event, input, tabId) {
  if (!input || input.type !== 'keyDown') return;
  const key = String(input.key || '').toLowerCase();
  const command = Boolean(input.control || input.meta);
  const shift = Boolean(input.shift);
  const alt = Boolean(input.alt);
  let handled = false;

  if (command && key === 't' && shift) {
    reopenClosedTab();
    handled = true;
  } else if (command && key === 't') {
    createTab('about:blank', { activate: true });
    handled = true;
  } else if (command && key === 'w') {
    closeTab(tabId || activeTabId);
    handled = true;
  } else if (command && key === 'l') {
    sendToShell('focus-address-bar', null);
    handled = true;
  } else if (command && shift && key === 'a') {
    sendToShell('open-command-palette', null);
    handled = true;
  } else if (command && shift && key === 'g') {
    sendToShell('open-chatgpt-requested', null);
    handled = true;
  } else if (command && shift && key === 's') {
    sendToShell('screenshot-active-page', null);
    handled = true;
  } else if (command && key === 'd') {
    sendToShell('bookmark-active-page', null);
    handled = true;
  } else if (command && key === 'm') {
    sendToShell('toggle-active-mute', null);
    handled = true;
  } else if (command && key === 'r') {
    reloadActive(Boolean(shift));
    handled = true;
  } else if (command && key === 'tab') {
    cycleTabs(shift ? -1 : 1);
    handled = true;
  } else if (command && key === 'p') {
    printActivePage().catch(() => {});
    handled = true;
  } else if (alt && key === 'left') {
    goBackActive();
    handled = true;
  } else if (alt && key === 'right') {
    goForwardActive();
    handled = true;
  } else if (command && (key === '+' || key === '=' || input.code === 'NumpadAdd')) {
    const tab = tabs.get(tabId || activeTabId);
    if (tab) {
      const nextZoom = getNextZoomIn(tab.zoom);
      setActiveZoom(nextZoom);
    }
    handled = true;
  } else if (command && (key === '-' || input.code === 'NumpadSubtract')) {
    const tab = tabs.get(tabId || activeTabId);
    if (tab) {
      const nextZoom = getNextZoomOut(tab.zoom);
      setActiveZoom(nextZoom);
    }
    handled = true;
  } else if (command && (key === '0' || input.code === 'Numpad0')) {
    setActiveZoom(1.0);
    handled = true;
  } else if (key === 'f5') {
    reloadActive(Boolean(shift));
    handled = true;
  } else if (key === 'f11') {
    toggleFullscreen();
    handled = true;
  } else if (key === 'f12') {
    // DevTools — F12 (like Chrome/Opera)
    const tab = tabs.get(tabId || activeTabId);
    if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.openDevTools({ mode: 'detach' });
    }
    handled = true;
  } else if (command && shift && key === 'i') {
    // DevTools — Ctrl+Shift+I
    const tab = tabs.get(tabId || activeTabId);
    if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.openDevTools({ mode: 'detach' });
    }
    handled = true;
  } else if (command && shift && key === 'j') {
    // DevTools Console — Ctrl+Shift+J
    const tab = tabs.get(tabId || activeTabId);
    if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.openDevTools({ mode: 'detach', activate: true });
    }
    handled = true;
  } else if (command && key === 'u') {
    // View Page Source — Ctrl+U
    const tab = tabs.get(tabId || activeTabId);
    if (tab && tab.url && isAllowedRemoteUrl(tab.url, false)) {
      createTab('view-source:' + tab.url, { activate: true });
    }
    handled = true;
  }

  if (handled) event.preventDefault();
}

function generatedStrongPassword() {
  return 'A!a1-' + crypto.randomBytes(18).toString('base64url');
}

function appendChatGptContextAction(template, params) {
  const selection = params.selectionText;
  if (!selection || !selection.trim() || params.formControlType === 'input-password') return;
  template.push({
    label: 'Copy selection and open ChatGPT',
    click: () => {
      clipboard.writeText(selection);
      sendToShell('open-chatgpt-requested', null);
    },
  });
  template.push({ type: 'separator' });
}

function fillGeneratedPassword(frame) {
  if (!frame || frame.isDestroyed()) return Promise.resolve(false);
  const password = generatedStrongPassword();
  const script = `(function () {
    function deepestActiveElement(root) {
      var active = root && root.activeElement;
      while (active && active.shadowRoot && active.shadowRoot.activeElement) {
        active = active.shadowRoot.activeElement;
      }
      return active;
    }
    function setValue(input, value) {
      var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (descriptor && descriptor.set) descriptor.set.call(input, value);
      else input.value = value;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var active = deepestActiveElement(document);
    if (!(active instanceof HTMLInputElement) || active.type !== 'password') return false;
    var value = ${JSON.stringify(password)};
    setValue(active, value);
    var scope = active.form || active.getRootNode() || document;
    var fields = scope.querySelectorAll ? scope.querySelectorAll('input[type="password"]') : [];
    for (var i = 0; i < fields.length; i += 1) {
      var field = fields[i];
      if (field === active || field.value || field.disabled || field.readOnly) continue;
      var metadata = [field.name, field.id, field.autocomplete, field.placeholder].join(' ').toLowerCase();
      if (/confirm|repeat|retype|new-password/.test(metadata)) setValue(field, value);
    }
    return true;
  })();`;
  return frame.executeJavaScript(script, true).catch(() => false);
}

async function showContextMenu(tab, params) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const contents = tab.view.webContents;
  const template = [];
  const linkUrl = safeRemoteUrl(params.linkURL);
  const frame = params.frame && !params.frame.isDestroyed() ? params.frame : null;

  if (linkUrl) {
    template.push({
      label: 'Open Link in New Tab',
      click: () => {
        createTab(linkUrl, { activate: true });
      },
    });
    template.push({
      label: 'Open Link in New Window',
      click: () => {
        createTab(linkUrl, { activate: true });
      },
    });
    template.push({
      label: 'Copy Link Address',
      click: () => clipboard.writeText(linkUrl),
    });
    template.push({
      label: 'Save Link As',
      click: () => contents.downloadURL(linkUrl),
    });
    template.push({
      label: 'Copy Link Text',
      click: () => clipboard.writeText(params.linkText || params.anchorText || ''),
      enabled: Boolean(params.linkText || params.anchorText),
    });
    template.push({ type: 'separator' });
  }

  if (params.mediaType === 'image' && params.srcURL) {
    const imgUrl = safeRemoteUrl(params.srcURL) || params.srcURL;
    template.push({
      label: 'Open Image in New Tab',
      click: () => createTab(imgUrl, { activate: true }),
    });
    template.push({
      label: 'Save Image As',
      click: () => contents.downloadURL(imgUrl),
    });
    template.push({
      label: 'Copy Image',
      click: () => contents.copyImageAt(params.x, params.y),
    });
    template.push({
      label: 'Copy Image Address',
      click: () => clipboard.writeText(imgUrl),
    });
    template.push({
      label: 'Search Image with Google',
      click: () => createTab('https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(imgUrl), { activate: true }),
    });
    template.push({ type: 'separator' });
  }

  if ((params.mediaType === 'video' || params.mediaType === 'audio') && params.srcURL) {
    const mediaUrl = safeRemoteUrl(params.srcURL) || params.srcURL;
    template.push({
      label: 'Open ' + params.mediaType.charAt(0).toUpperCase() + params.mediaType.slice(1) + ' in New Tab',
      click: () => createTab(mediaUrl, { activate: true }),
    });
    template.push({
      label: 'Save ' + params.mediaType.charAt(0).toUpperCase() + params.mediaType.slice(1) + ' As\u2026',
      click: () => contents.downloadURL(mediaUrl),
    });
    template.push({
      label: 'Copy ' + params.mediaType.charAt(0).toUpperCase() + params.mediaType.slice(1) + ' Address',
      click: () => clipboard.writeText(mediaUrl),
    });
    template.push({ type: 'separator' });
  }

  if (params.isEditable) {
    if (params.formControlType === 'input-password' && frame) {
      template.push({
        label: 'Use a generated strong password',
        click: () => fillGeneratedPassword(frame),
      });
      template.push({ type: 'separator' });
    }
    if (params.misspelledWord && Array.isArray(params.dictionarySuggestions)) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        template.push({
          label: suggestion,
          click: () => contents.replaceMisspelling(suggestion),
        });
      }
      if (params.dictionarySuggestions.length === 0) {
        template.push({ label: 'No spelling suggestions', enabled: false });
      }
      template.push({
        label: 'Add to dictionary',
        click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      template.push({ type: 'separator' });
    }
    template.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' });
    template.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'delete' });
    template.push({ role: 'selectAll' });
    template.push({ type: 'separator' });
  } else if (params.selectionText) {
    template.push({ role: 'copy' });
    const selText = params.selectionText.trim().slice(0, 100);
    if (selText) {
      template.push({
        label: 'Search "' + (selText.length > 30 ? selText.slice(0, 30) + '\u2026' : selText) + '" on Google',
        click: () => createTab('https://www.google.com/search?q=' + encodeURIComponent(selText), { activate: true }),
      });
    }
    template.push({ type: 'separator' });
  }

  appendChatGptContextAction(template, params);

  template.push({ label: 'Back', enabled: canGoBack(contents), click: () => goBack(tab.id) });
  template.push({ label: 'Forward', enabled: canGoForward(contents), click: () => goForward(tab.id) });
  template.push({ label: 'Reload', click: () => reloadTab(tab.id, false) });
  template.push({ type: 'separator' });
  template.push({
    label: 'Save Page As\u2026',
    click: () => {
      const pageUrl = contents.getURL();
      if (isAllowedRemoteUrl(pageUrl, false)) {
        contents.downloadURL(pageUrl);
      }
    },
  });
  template.push({
    label: 'Print\u2026',
    accelerator: 'Ctrl+P',
    click: () => contents.print(),
  });
  template.push({
    label: tab.isMuted ? 'Unmute Tab' : 'Mute Tab',
    click: () => setTabMuted(tab.id, !tab.isMuted),
  });

  template.push({ type: 'separator' });
  template.push({
    label: 'Developer Options',
    submenu: [
      {
        label: 'Inspect Element',
        accelerator: 'Ctrl+Shift+I',
        click: () => contents.inspectElement(params.x, params.y),
      },
      {
        label: 'Open Developer Tools',
        accelerator: 'F12',
        click: () => contents.openDevTools({ mode: 'detach' }),
      },
      {
        label: 'Open Console',
        accelerator: 'Ctrl+Shift+J',
        click: () => contents.openDevTools({ mode: 'detach', activate: true }),
      },
      { type: 'separator' },
      {
        label: 'View Page Source',
        accelerator: 'Ctrl+U',
        click: () => {
          const pageUrl = contents.getURL();
          if (isAllowedRemoteUrl(pageUrl, false)) {
            createTab('view-source:' + pageUrl, { activate: true });
          }
        },
      },
    ],
  });

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow });
}

async function showSidebarContextMenu(surface, params) {
  if (!surface || !surface.view || surface.view.webContents.isDestroyed()) return;
  const contents = surface.view.webContents;
  const template = [];
  const linkUrl = safeRemoteUrl(params.linkURL);

  if (linkUrl) {
    template.push({
      label: 'Open Link in New Tab',
      click: () => createTab(linkUrl, { activate: true }),
    });
    template.push({
      label: 'Open Link in New Window',
      click: () => createTab(linkUrl, { activate: true }),
    });
    template.push({ label: 'Copy Link Address', click: () => clipboard.writeText(linkUrl) });
    template.push({ label: 'Save Link As', click: () => contents.downloadURL(linkUrl) });
    template.push({ type: 'separator' });
  }

  // Image context items.
  if (params.mediaType === 'image' && params.srcURL) {
    const imgUrl = safeRemoteUrl(params.srcURL) || params.srcURL;
    template.push({ label: 'Open Image in New Tab', click: () => createTab(imgUrl, { activate: true }) });
    template.push({ label: 'Save Image As', click: () => contents.downloadURL(imgUrl) });
    template.push({ label: 'Copy Image', click: () => contents.copyImageAt(params.x, params.y) });
    template.push({ label: 'Copy Image Address', click: () => clipboard.writeText(imgUrl) });
    template.push({ type: 'separator' });
  }

  if (params.isEditable) {
    if (params.misspelledWord && Array.isArray(params.dictionarySuggestions)) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        template.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) });
      }
      if (params.dictionarySuggestions.length === 0) {
        template.push({ label: 'No spelling suggestions', enabled: false });
      }
      template.push({
        label: 'Add to dictionary',
        click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      template.push({ type: 'separator' });
    }
    template.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' });
    template.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' });
    template.push({ label: 'Select All', click: () => contents.selectAll() });
    template.push({ type: 'separator' });
  } else if (params.selectionText) {
    template.push({ role: 'copy' });
    const selText = params.selectionText.trim().slice(0, 100);
    if (selText) {
      template.push({
        label: 'Search "' + (selText.length > 30 ? selText.slice(0, 30) + '\u2026' : selText) + '" on Google',
        click: () => createTab('https://www.google.com/search?q=' + encodeURIComponent(selText), { activate: true }),
      });
    }
    template.push({ type: 'separator' });
  }

  appendChatGptContextAction(template, params);

  template.push({
    label: 'Back',
    enabled: canGoBack(contents),
    click: () => {
      const navigation = navigationApi(contents);
      if (navigation && navigation.canGoBack()) navigation.goBack();
    },
  });
  template.push({
    label: 'Forward',
    enabled: canGoForward(contents),
    click: () => {
      const navigation = navigationApi(contents);
      if (navigation && navigation.canGoForward()) navigation.goForward();
    },
  });
  template.push({ label: 'Reload', click: () => reloadSidebarSurface(surface) });

  template.push({ type: 'separator' });
  template.push({
    label: 'Developer Options',
    submenu: [
      {
        label: 'Inspect Element',
        click: () => contents.inspectElement(params.x, params.y),
      },
      {
        label: 'Open Developer Tools',
        click: () => contents.openDevTools({ mode: 'detach' }),
      },
      {
        label: 'View Page Source',
        click: () => {
          const pageUrl = contents.getURL();
          if (isAllowedRemoteUrl(pageUrl, false)) {
            createTab('view-source:' + pageUrl, { activate: true });
          }
        },
      },
    ],
  });

  Menu.buildFromTemplate(template).popup({ window: mainWindow });
}

function sidebarWorkspaceId(panel) {
  return panel.id === 'whatsapp' ? null : activeWorkspaceId;
}

function sidebarPanelId(value) {
  if (value === 'whatsapp' || value === 'chatgpt' ||
      (typeof value === 'string' && /^site-[a-zA-Z0-9_-]{1,80}$/.test(value))) return value;
  throw new TypeError('Invalid sidebar site ID');
}

function publicSidebarPanelState(panel) {
  if (!panel) return null;
  const surface = panel.surfaces.get(sidebarWorkspaceId(panel));
  return {
    id: panel.id,
    title: panel.title,
    visible: panel === activeSidebarPanel,
    status: surface?.status || 'idle',
    unreadCount: surface?.unreadCount || 0,
    url: surface?.url || panel.url,
    bounds: { ...sidebarPanelBounds },
    persistent: !privateInstance,
    message: surface?.message || '',
  };
}

function emitSidebarPanelStatus(surface) {
  const { panel, workspaceId } = surface;
  if (workspaceId === sidebarWorkspaceId(panel) && panel.surfaces.get(workspaceId) === surface) {
    sendToShell('sidebar-panel-status', publicSidebarPanelState(panel));
  }
}

function setSidebarSurfaceStatus(surface, status, message = '') {
  surface.status = status;
  surface.message = message.slice(0, 300);
  emitSidebarPanelStatus(surface);
  if (surface === selectedSidebarSurface) resizeViews();
}

function getWhatsappSession() {
  if (whatsappSession) return whatsappSession;
  whatsappSession = session.fromPartition(WHATSAPP_PARTITION, { cache: true });
  whatsappSession.setUserAgent(chromeCompatibilityUserAgent());
  whatsappSession.setSpellCheckerEnabled(true);
  whatsappSession.setSpellCheckerLanguages(['en-US', 'en-GB']);
  configurePermissions(whatsappSession);
  configureDeviceSelection(whatsappSession);
  configureScreenSharePicker(whatsappSession);
  configureDownloads(whatsappSession, { sessionKind: 'whatsapp' });
  configureSessionClientHints(whatsappSession);

  return whatsappSession;
}

function ensureSidebarSurface(panel) {
  const workspaceId = sidebarWorkspaceId(panel);
  const existing = panel.surfaces.get(workspaceId);
  if (existing) return existing;
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Browser window is not available');
  }

  const isWhatsApp = panel.id === 'whatsapp';
  const targetSession = isWhatsApp ? getWhatsappSession() : getWorkspaceSession(workspaceId);
  const view = new WebContentsView({
    webPreferences: {
      session: targetSession,
      preload: REMOTE_PRELOAD_FILE,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
      webSecurity: true,
      javascript: true,
      images: true,
      webgl: true,
      plugins: true,
      experimentalFeatures: false,
      spellcheck: true,
      backgroundThrottling: true,
    },
  });
  const surface = {
    id: 'sidebar:' + (workspaceId || '') + ':' + panel.id,
    panel,
    workspaceId,
    view,
    url: panel.url,
    unreadCount: 0,
    status: 'loading',
    message: '',
  };
  panel.surfaces.set(workspaceId, surface);
  if (isWhatsApp) view.setBackgroundColor('#0b141a');
  const contents = view.webContents;
  contents.setUserAgent(chromeCompatibilityUserAgent());
  safeViewSetVisible(view, false);
  view.setBounds(sidebarPanelBounds);
  mainWindow.contentView.addChildView(view);
  safeViewSetVisible(view, false);
  attachNavigationGuards(contents);
  attachBluetoothPicker(contents);
  attachHttpAuthLifecycle(contents);

  contents.setWindowOpenHandler((details) => {
    if (!isWhatsApp) return handleTabWindowOpen(details, surface, contents);
    const url = safeRemoteUrl(details.url);
    if (url) {
      setImmediate(() => createTab(url, { activate: details.disposition !== 'background-tab' }));
    } else if (safeExternalProtocolUrl(details.url)) {
      setImmediate(() => confirmOpenExternalUrl(details.url, mainWindow).catch(() => {}));
    }
    return { action: 'deny' };
  });
  contents.on('did-create-window', (popupWindow) => configurePagePopup(popupWindow, surface));
  contents.on('context-menu', (event, params) => {
    showSidebarContextMenu(surface, params).catch(() => {});
  });
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if ((input.control || input.meta) && input.shift && key === 'g') {
      event.preventDefault();
      sendToShell('open-chatgpt-requested', null);
    } else if (key === 'escape' && !input.control && !input.meta && !input.alt && !input.shift) {
      event.preventDefault();
      sendToShell('close-sidebar-panel-requested', null);
    }
  });
  contents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    if (!isInPlace && isMainFrame) {
      surface.requestedUrl = safeRemoteUrl(url) || panel.url;
      setSidebarSurfaceStatus(surface, 'loading');
    }
  });
  const syncUrl = (url) => {
    surface.url = safeRemoteUrl(url) || panel.url;
    surface.requestedUrl = surface.url;
    emitSidebarPanelStatus(surface);
  };
  contents.on('did-navigate', (event, url) => syncUrl(url));
  contents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    if (isMainFrame) syncUrl(url);
  });
  contents.on('did-redirect-navigation', (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) surface.requestedUrl = safeRemoteUrl(url) || panel.url;
  });
  contents.on('did-finish-load', () => {
    surface.hasLoaded = true;
    setSidebarSurfaceStatus(surface, 'ready');
  });
  contents.on('did-stop-loading', () => {
    // Downloads and other canceled navigations leave the previous page intact.
    if (surface.status === 'loading' && surface.hasLoaded) setSidebarSurfaceStatus(surface, 'ready');
  });
  contents.on('did-fail-load', (event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      surface.hasLoaded = false;
      surface.requestedUrl = safeRemoteUrl(validatedUrl) || panel.url;
      setSidebarSurfaceStatus(surface, 'error', errorDescription || 'Site could not load');
    }
  });
  if (isWhatsApp) {
    contents.on('page-title-updated', (event, title) => {
      const match = /^\((\d+)\)/.exec(title);
      surface.unreadCount = match ? Math.min(999, Number(match[1])) : 0;
      emitSidebarPanelStatus(surface);
    });
  }
  contents.on('render-process-gone', () => {
    surface.hasLoaded = false;
    setSidebarSurfaceStatus(surface, 'error', 'The site stopped responding. Select Reload to reconnect.');
  });
  contents.once('destroyed', () => {
    surface.hasLoaded = false;
    clearSidebarSurfaceReferences(surface);
    if (panel.surfaces.get(workspaceId) === surface) {
      setSidebarSurfaceStatus(surface, 'error', 'The site closed. Select Reload to reconnect.');
    }
  });

  reloadSidebarSurface(surface);
  return surface;
}

const WHATSAPP_BASE_WIDTH = 750;
const WHATSAPP_MIN_ZOOM = 0.8;

function resizeSidebarView(allowVisible) {
  const panel = activeSidebarPanel;
  const surface = allowVisible && panel ? ensureSidebarSurface(panel) : null;
  if (surface !== selectedSidebarSurface) {
    selectedSidebarSurface = surface;
    if (surface) emitSidebarPanelStatus(surface);
  }
  const show = surface && !surface.view.webContents.isDestroyed() &&
    surface.status !== 'error' && surface.hasLoaded && !hasPendingHttpAuthForTab(surface);
  if (shownSidebarSurface && (!show || shownSidebarSurface !== surface)) {
    safeViewSetVisible(shownSidebarSurface.view, false);
    shownSidebarSurface = null;
  }
  if (!surface || surface.view.webContents.isDestroyed()) return;

  const content = mainWindow.getContentBounds();
  const x = Math.min(Math.round(sidebarPanelBounds.x), content.width);
  const y = Math.min(Math.round(sidebarPanelBounds.y), content.height);
  const width = Math.max(1, Math.min(Math.round(sidebarPanelBounds.width), content.width - x));
  const height = Math.max(1, Math.min(Math.round(sidebarPanelBounds.height), content.height - y));
  if (surface.panel.id === 'whatsapp') {
    const zoomFactor = Math.max(WHATSAPP_MIN_ZOOM, Math.min(1, width / WHATSAPP_BASE_WIDTH));
    surface.view.webContents.setZoomFactor(zoomFactor);
  }
  surface.view.setBounds({ x, y, width, height });
  if (show) {
    safeViewSetVisible(surface.view, true);
    shownSidebarSurface = surface;
  }
}

function setSidebarPanel(payload) {
  assertPlainObject(payload, 'Sidebar panel layout');
  if (typeof payload.visible !== 'boolean') {
    throw new TypeError('Sidebar panel visibility must be a boolean');
  }
  let bounds = sidebarPanelBounds;
  if (payload.bounds !== undefined) {
    assertPlainObject(payload.bounds, 'Sidebar panel bounds');
    bounds = {
      x: boundedNumber(payload.bounds.x, 'Sidebar panel x', 0, 5000),
      y: boundedNumber(payload.bounds.y, 'Sidebar panel y', 0, 5000),
      width: boundedNumber(payload.bounds.width, 'Sidebar panel width', 1, 5000),
      height: boundedNumber(payload.bounds.height, 'Sidebar panel height', 1, 5000),
    };
  }
  const previous = activeSidebarPanel;
  let panel = null;
  if (payload.visible) {
    const id = sidebarPanelId(payload.id);
    panel = sidebarPanels.get(id);
    if (id.startsWith('site-')) {
      const url = safeRemoteUrl(payload.url);
      const parsed = url && new URL(url);
      if (!parsed || parsed.username || parsed.password) {
        throw new TypeError('Enter an HTTP or HTTPS website URL without credentials');
      }
      const title = boundedString(payload.title, 'Sidebar site title', 300, false);
      if (panel && panel.url !== url) throw new Error('Sidebar site ID already refers to a different URL');
      if (!panel) {
        panel = { id, title, url, surfaces: new Map() };
        sidebarPanels.set(id, panel);
      }
    }
  }
  sidebarPanelBounds = bounds;
  activeSidebarPanel = panel;
  resizeViews();
  return publicSidebarPanelState(panel || previous);
}

function reloadSidebarSurface(surface) {
  const contents = surface.view.webContents;
  const url = surface.requestedUrl || surface.url;
  const reload = surface.status === 'ready' && safeRemoteUrl(contents.getURL());
  setSidebarSurfaceStatus(surface, 'loading');
  if (reload) {
    contents.reload();
    return;
  }
  contents.loadURL(url).catch((error) => {
    if (contents.isDestroyed() || surface.status !== 'loading' || contents.isLoadingMainFrame()) return;
    const message = error.code === 'ERR_ABORTED' ? 'This address did not open a page' : error.message;
    setSidebarSurfaceStatus(surface, 'error', message || 'Site could not load');
  });
}

function reloadSidebarPanel(value) {
  const panel = sidebarPanels.get(sidebarPanelId(value));
  if (!panel) throw new Error('Sidebar site is unavailable');
  const surface = panel.surfaces.get(sidebarWorkspaceId(panel));
  if (!surface || surface.view.webContents.isDestroyed()) {
    if (surface) destroySidebarSurface(surface);
    ensureSidebarSurface(panel);
    resizeViews();
  } else {
    reloadSidebarSurface(surface);
  }
  return publicSidebarPanelState(panel);
}

function openSidebarPanelTab(value) {
  const panel = sidebarPanels.get(sidebarPanelId(value));
  if (!panel) throw new Error('Sidebar site is unavailable');
  const url = panel.id === 'whatsapp' ? panel.url : publicSidebarPanelState(panel).url;
  const existing = panel.id === 'chatgpt' && getWorkspaceTabs().find((tab) => tab.url === url);
  return existing ? switchTab(existing.id) : createTab(url, { activate: true });
}

function clearSidebarSurfaceReferences(surface) {
  for (const key of recentCredentialUsernames.keys()) {
    if (key.startsWith(surface.id + '|')) recentCredentialUsernames.delete(key);
  }
  for (const [contentsId, ownerTabId] of popupOwnerTabIds) {
    if (ownerTabId === surface.id) popupOwnerTabIds.delete(contentsId);
  }
}

function destroySidebarSurface(surface) {
  surface.panel.surfaces.delete(surface.workspaceId);
  destroyTabView(surface);
}

function removeSidebarPanel(value) {
  const id = sidebarPanelId(value);
  if (!id.startsWith('site-')) throw new Error('Built-in sidebar sites cannot be removed');
  const panel = sidebarPanels.get(id);
  if (!panel) return false;
  if (panel === activeSidebarPanel) activeSidebarPanel = null;
  sidebarPanels.delete(id);
  for (const surface of panel.surfaces.values()) destroySidebarSurface(surface);
  resizeViews();
  return true;
}

function openUrlInWorkspaceTab(url, sourceTab, options) {
  const target = safeBrowsableUrl(url, true);
  if (!target) return null;
  return createTab(target, {
    activate: !(options && options.activate === false),
    workspaceId: sourceTab && sourceTab.workspaceId ? sourceTab.workspaceId : activeWorkspaceId,
  });
}

function attachBluetoothPicker(contents) {
  let selectionPending = false;
  contents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    if (selectionPending) return;
    selectionPending = true;
    chooseBrowserDevice('bluetooth', devices)
      .then((selected) => callback(selected ? selected.deviceId : ''))
      .catch(() => callback(''))
      .finally(() => { selectionPending = false; });
  });
}

function configurePagePopup(popupWindow, sourceTab) {
  if (!popupWindow || popupWindow.isDestroyed() || !sourceTab) return;
  const contents = popupWindow.webContents;
  popupOwnerTabIds.set(contents.id, sourceTab.id);
  attachHttpAuthLifecycle(contents);
  contents.setUserAgent(chromeCompatibilityUserAgent());
  attachNavigationGuards(contents);
  attachBluetoothPicker(contents);
  contents.setWindowOpenHandler((details) => handleTabWindowOpen(details, sourceTab, contents));
  contents.on('did-create-window', (nestedPopup) => configurePagePopup(nestedPopup, sourceTab));
  if (!sourceTab.panel) {
    contents.on('before-input-event', (event, input) => handleShortcut(event, input, sourceTab.id));
  }
  contents.on('will-navigate', (event, url) => {
    if (!event.defaultPrevented && isAllowedNavigationUrl(url)) {
      contents.setUserAgent(chromeCompatibilityUserAgent());
    }
  });
  contents.once('destroyed', () => popupOwnerTabIds.delete(contents.id));
  popupWindow.once('closed', () => popupOwnerTabIds.delete(contents.id));
}

function handleTabWindowOpen(details, sourceTab, contents) {
  const requestedUrl = details && details.url;
  const candidateUrl = (!requestedUrl || requestedUrl === 'about:blank') ? 'about:blank' : requestedUrl;
  const url = safeBrowsableUrl(candidateUrl, true);
  if (!url) {
    if (safeExternalProtocolUrl(requestedUrl)) {
      setImmediate(() => confirmOpenExternalUrl(requestedUrl, mainWindow).catch(() => {}));
    }
    return { action: 'deny' };
  }
  const sourceUrl = contents && !contents.isDestroyed() ? contents.getURL() : '';
  if (isAllowedRemoteUrl(sourceUrl, false) &&
      (isAllowedFileUrl(url) || isAllowedDataUrl(url) || /^view-source:file:/i.test(url))) {
    return { action: 'deny' };
  }
  const disposition = details && details.disposition;
  const tabDisposition = disposition === 'foreground-tab' || disposition === 'background-tab';
  const features = typeof details.features === 'string' ? details.features : '';
  const isLoginPopup = !tabDisposition &&
    (disposition === 'new-window' || (features && /width=|height=|popup/i.test(features)));
  if (isLoginPopup) {
    var popupWidth = 1024;
    var popupHeight = 768;
    var wMatch = features.match(/width=(\d+)/i);
    var hMatch = features.match(/height=(\d+)/i);
    if (wMatch) popupWidth = Math.min(Math.max(300, Number(wMatch[1])), 1600);
    if (hMatch) popupHeight = Math.min(Math.max(200, Number(hMatch[1])), 1200);
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: popupWidth,
        height: popupHeight,
        autoHideMenuBar: true,
        parent: mainWindow || undefined,
        webPreferences: {
          session: contents.session,
          preload: REMOTE_PRELOAD_FILE,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: false,
          allowRunningInsecureContent: false,
          webSecurity: true,
          javascript: true,
          images: true,
          webgl: true,
          plugins: true,
          spellcheck: true,
          backgroundThrottling: false,
        },
      },
    };
  }
  if (!mainWindow || mainWindow.isDestroyed() || tabs.size >= MAX_TABS) return { action: 'deny' };
  return {
    action: 'allow',
    outlivesOpener: true,
    overrideBrowserWindowOptions: {
      webPreferences: {
        session: contents.session,
        preload: REMOTE_PRELOAD_FILE,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        allowRunningInsecureContent: false,
        webSecurity: true,
      },
    },
    createWindow: (windowOptions) => {
      // Adopt Chromium's child contents: recreating its URL loses POST bodies,
      // sessionStorage, window.opener and scripts writing into about:blank.
      const created = createTab(url, {
        workspaceId: sourceTab.workspaceId || activeWorkspaceId,
        activate: disposition !== 'background-tab',
        windowOpenOptions: windowOptions,
        windowOpenDetails: details,
        openerTabId: sourceTab.id,
      });
      return tabs.get(created.id).view.webContents;
    },
  };
}

function attachTabEvents(tab) {
  const contents = tab.view.webContents;
  attachHttpAuthLifecycle(contents);

  contents.once('destroyed', () => {
    // Native child pages can close themselves (print helpers and OAuth flows).
    // Remove their shell tab too, unless closeTab already performed the cleanup.
    if (tabs.get(tab.id) === tab && mainWindow && !mainWindow.isDestroyed()) {
      closeTab(tab.id);
    }
  });

  attachNavigationGuards(contents);
  contents.on('will-navigate', (event, url) => {
    applyTabUserAgent(tab, url);
    // Apply Chrome-compatible user agent for Chrome Web Store so the
    // "Add to Chrome" button appears instead of "Switch to Chrome".
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'chromewebstore.google.com' || parsed.hostname === 'chrome.google.com') {
        const chromeUA = chromeCompatibilityUserAgent();
        if (contents.getUserAgent() !== chromeUA) {
          contents.setUserAgent(chromeUA);
        }
      }
    } catch (e) {}
  });
  contents.on('will-redirect', (event, url) => applyTabUserAgent(tab, url));
  contents.setWindowOpenHandler((details) => {
    return handleTabWindowOpen(details, tab, contents);
  });
  contents.on('did-create-window', (popupWindow) => configurePagePopup(popupWindow, tab));
  attachBluetoothPicker(contents);

  contents.on('before-input-event', (event, input) => {
    handleShortcut(event, input, tab.id);
  });

  contents.on('context-menu', (event, params) => {
    showContextMenu(tab, params).catch(() => {});
  });

  contents.on('did-start-loading', () => {
    tab.isLoading = true;
    tab.crashed = false;
    emitTab('tab-update', tab);
  });

  contents.on('did-stop-loading', () => {
    tab.isLoading = false;
    tab.url = contents.getURL() || tab.url;
    emitTab('tab-update', tab);
    resizeViews();
    scheduleSessionSave();
  });

  const onNavigate = (event, url) => {
    if (!safeBrowsableUrl(url, true)) return;
    tab.pendingInitialNavigation = false;
    tab.url = url;
    tab.crashed = false;
    const domainZoom = getZoomForUrl(url);
    if (domainZoom !== tab.zoom) {
      tab.zoom = domainZoom;
      tab.view.webContents.setZoomFactor(domainZoom);
    }
    emitTab('tab-navigated', tab);
    recordHistory(tab, url);
    resizeViews();
    scheduleSessionSave();
  };

  contents.on('did-navigate', (event, url) => {
    tab.readingModeStyle = null;
    tab.readingModeDocument = (tab.readingModeDocument || 0) + 1;
    onNavigate(event, url);
  });
  contents.on('did-navigate-in-page', onNavigate);

  contents.on('page-title-updated', (event, title) => {
    tab.title = typeof title === 'string' && title.trim()
      ? title.trim().slice(0, 500)
      : 'New Tab';
    refreshHistoryTitle(tab);
    emitTab('tab-update', tab);
  });

  contents.on('page-favicon-updated', (event, favicons) => {
    const favicon = Array.isArray(favicons)
      ? favicons.find((value) => typeof value === 'string' && value.length <= MAX_URL_LENGTH)
      : '';
    tab.favicon = favicon || '';
    emitTab('tab-update', tab);
  });

  const updateAudio = (audible) => {
    if (typeof audible !== 'boolean') {
      try {
        audible = Boolean(contents.isCurrentlyAudible && contents.isCurrentlyAudible());
      } catch (error) {
        audible = false;
      }
    }
    tab.audible = audible;
    emitTab('tab-audio-state', tab);
  };

  contents.on('media-started-playing', () => updateAudio(true));
  contents.on('media-paused', () => updateAudio());
  contents.on('audio-state-changed', (event) => {
    if (event && typeof event.audible === 'boolean') updateAudio(event.audible);
    else updateAudio();
  });

  contents.on('found-in-page', (event, result) => {
    sendToShell('found-in-page-result', { tabId: tab.id, ...result });
  });

  contents.on('zoom-changed', (event, zoomDirection) => {
    let currentFactor = contents.getZoomFactor();
    if (zoomDirection === 'in') currentFactor = getNextZoomIn(currentFactor);
    else if (zoomDirection === 'out') currentFactor = getNextZoomOut(currentFactor);
    tab.zoom = currentFactor;
    contents.setZoomFactor(currentFactor);
    emitTab('tab-update', tab);
    scheduleSessionSave();
  });

  contents.on('render-process-gone', (event, details) => {
    tab.crashed = true;
    tab.isLoading = false;
    emitTab('tab-update', tab);
    sendToShell('tab-update', {
      ...publicTab(tab),
      crashReason: details && details.reason ? details.reason : 'unknown',
    });
  });

  contents.on('did-fail-load', (event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      tab.isLoading = false;
      emitTab('tab-update', tab);
    }
  });

  contents.on('enter-html-full-screen', () => {
    tab.isHtmlFullscreen = true;
    resizeViews();
  });
  contents.on('leave-html-full-screen', () => {
    tab.isHtmlFullscreen = false;
    resizeViews();
  });
}

function createTab(url, options) {
  const settings = options || {};
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Browser window is not available');
  }
  if (tabs.size >= MAX_TABS) {
    throw new Error('Tab limit reached');
  }

  const requestedUrl = url === undefined || url === null || url === ''
    ? 'about:blank'
    : url;
  const normalizedUrl = normalizeNavigationUrl(requestedUrl);
  const id = nextTabId++;
  const targetWorkspaceId = settings.workspaceId || activeWorkspaceId || 'default';
  const targetSession = getWorkspaceSession(targetWorkspaceId);
  const windowOpenOptions = settings.windowOpenOptions;
  const backgroundThrottling = currentGamingLevel === 0 && backgroundTabThrottlingEnabled();

  const view = new WebContentsView({
    ...(windowOpenOptions && windowOpenOptions.webContents
      ? { webContents: windowOpenOptions.webContents } : {}),
    webPreferences: {
      ...(windowOpenOptions ? windowOpenOptions.webPreferences : {}),
      session: windowOpenOptions && windowOpenOptions.webPreferences && windowOpenOptions.webPreferences.session || targetSession,
      preload: REMOTE_PRELOAD_FILE,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
      webSecurity: true,
      javascript: true,
      images: true,
      webgl: true,
      plugins: true,
      experimentalFeatures: false,
      spellcheck: true,
      backgroundThrottling,
    },
  });
  if (windowOpenOptions && windowOpenOptions.webContents) {
    view.webContents.setBackgroundThrottling(backgroundThrottling);
  }
  const restored = isPlainObject(settings.restored) ? settings.restored : {};
  // Fix Bug 2: apply saved domain zoom immediately when creating a new tab so
  // duplicated tabs and sub-links start at the right zoom before navigation fires.
  const zoom = Number.isFinite(restored.zoom)
    ? Math.min(3, Math.max(0.25, restored.zoom))
    : getZoomForUrl(normalizedUrl);
  const tab = {
    id,
    view,
    workspaceId: targetWorkspaceId,
    title: 'New Tab',
    url: normalizedUrl,
    favicon: '',
    isLoading: normalizedUrl !== 'about:blank',
    isMuted: Boolean(restored.muted),
    pinned: Boolean(restored.pinned),
    audible: false,
    zoom,
    crashed: false,
    isHtmlFullscreen: false,
    pageOwned: Boolean(windowOpenOptions),
    openerTabId: settings.openerTabId || null,
    pendingInitialNavigation: Boolean(windowOpenOptions),
    openedWithPost: Boolean(settings.windowOpenDetails && settings.windowOpenDetails.postBody),
    defaultUserAgent: targetSession.getUserAgent(),
  };

  tabs.set(id, tab);
  if (!lastActiveTabByWorkspace.has(targetWorkspaceId)) {
    lastActiveTabByWorkspace.set(targetWorkspaceId, id);
  }
  prepareRemoteContentView(view);
  mainWindow.contentView.addChildView(view);
  prepareRemoteContentView(view);
  attachTabEvents(tab);
  view.webContents.setAudioMuted(tab.isMuted);
  view.webContents.setZoomFactor(tab.zoom);
  emitTab('tab-created', tab);

  const activate = settings.activate !== false;
  if (activate || activeTabId === null) {
    switchTab(id);
  } else {
    resizeViews();
  }

  const loadingContents = view.webContents;
  applyTabUserAgent(tab, normalizedUrl);
  if (!windowOpenOptions || !windowOpenOptions.webContents) {
    // Chromium already navigates adopted children. Link dispositions without
    // child contents need one load, including the original referrer and body.
    const details = settings.windowOpenDetails;
    const postBody = details && details.postBody;
    const load = windowOpenOptions
      ? loadingContents.loadURL(normalizedUrl, {
        httpReferrer: details.referrer,
        ...(postBody ? {
          postData: postBody.data,
          extraHeaders: 'Content-Type: ' + postBody.contentType +
            (postBody.boundary ? '; boundary=' + postBody.boundary : ''),
        } : {}),
      })
      : loadTabContents(tab, normalizedUrl);
    load.catch(() => {
      if (!loadingContents.isDestroyed() && tabs.get(tab.id) === tab) {
        tab.isLoading = false;
        emitTab('tab-update', tab);
      }
    });
  }
  scheduleSessionSave();
  return publicTab(tab);
}

function destroyTabView(tab) {
  if (!tab || !tab.view) return;
  safeViewSetVisible(tab.view, false);
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.contentView.removeChildView(tab.view);
    }
  } catch (error) {
    // The view may already have been detached.
  }
  try {
    if (!tab.view.webContents.isDestroyed()) {
      tab.view.webContents.close();
    }
  } catch (error) {
    // Ignore shutdown races.
  }
}

function closeTab(id, options) {
  const tab = getTab(id);
  const wsId = tab.workspaceId || 'default';
  const workspaceTabsBeforeClose = getWorkspaceTabs(wsId);
  const workspaceIndex = workspaceTabsBeforeClose.findIndex((item) => item.id === tab.id);
  const wasActive = activeTabId === tab.id;

  if (!(options && options.skipHistory) && tab.url && tab.url !== 'about:blank') {
    closedTabs.unshift({
      url: tab.url,
      zoom: tab.zoom,
      muted: tab.isMuted,
      title: tab.title,
      workspaceId: wsId,
      pinned: Boolean(tab.pinned),
    });
    if (closedTabs.length > MAX_CLOSED_TABS) closedTabs.length = MAX_CLOSED_TABS;
  }

  tabs.delete(tab.id);
  cancelHttpAuthRequestsForTab(tab.id, 'tab-closed');
  for (const key of recentCredentialUsernames.keys()) {
    if (key.startsWith(tab.id + '|')) recentCredentialUsernames.delete(key);
  }
  for (const [contentsId, ownerTabId] of popupOwnerTabIds) {
    if (ownerTabId === tab.id) popupOwnerTabIds.delete(contentsId);
  }
  destroyTabView(tab);

  if (splitScreen.secondaryTabId === tab.id) {
    splitScreen = { enabled: false, secondaryTabId: null };
  }

  sendToShell('tab-closed', { id: tab.id });

  const remainingWsTabs = getWorkspaceTabs(wsId);
  const rememberedWasClosed = lastActiveTabByWorkspace.get(wsId) === tab.id;

  if (remainingWsTabs.length === 0) {
    lastActiveTabByWorkspace.delete(wsId);
    if (activeWorkspaceId === wsId) {
      createTab('about:blank', { workspaceId: wsId, activate: true });
    }
  } else if (wasActive) {
    const opener = tabs.get(tab.openerTabId);
    const nextTab = opener && opener.workspaceId === wsId ? opener
      : remainingWsTabs[Math.min(Math.max(workspaceIndex, 0), remainingWsTabs.length - 1)];
    if (nextTab) switchTab(nextTab.id);
  } else {
    if (rememberedWasClosed) {
      const fallback = remainingWsTabs[Math.min(Math.max(workspaceIndex, 0), remainingWsTabs.length - 1)];
      if (fallback) rememberWorkspaceTab(fallback);
    }
    resizeViews();
  }

  scheduleSessionSave();
  return { success: true, id: tab.id };
}

function switchTab(id) {
  const tab = getTab(id);
  const previousTab = getActiveTab();
  if (activeWorkspaceId !== (tab.workspaceId || 'default') ||
      (previousTab && (previousTab.workspaceId || 'default') !== (tab.workspaceId || 'default'))) {
    splitScreen = { enabled: false, secondaryTabId: null };
  }
  activeWorkspaceId = tab.workspaceId || 'default';
  activeTabId = tab.id;
  rememberWorkspaceTab(tab);
  if (splitScreen.secondaryTabId === tab.id) {
    const replacement = getWorkspaceTabs(activeWorkspaceId).find((item) => item.id !== tab.id);
    splitScreen.secondaryTabId = replacement ? replacement.id : null;
    splitScreen.enabled = Boolean(replacement);
  }
  if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
    tab.view.webContents.setZoomFactor(Number.isFinite(tab.zoom) ? tab.zoom : 1.0);
  }
  resizeViews();
  emitTab('tab-switched', tab);
  scheduleSessionSave();
  return publicTab(tab);
}

function cycleTabs(direction) {
  const ids = getWorkspaceTabs(activeWorkspaceId).map((tab) => tab.id);
  if (ids.length < 2) return getActiveTab() ? publicTab(getActiveTab()) : null;
  const current = Math.max(0, ids.indexOf(activeTabId));
  const next = (current + direction + ids.length) % ids.length;
  return switchTab(ids[next]);
}

function duplicateTab(id) {
  const tab = getTab(id);
  return createTab(tab.url || 'about:blank', {
    workspaceId: tab.workspaceId || 'default',
    activate: true,
    restored: { zoom: tab.zoom, muted: tab.isMuted },
  });
}

function setTabPinned(id, pinned) {
  const tab = getTab(id);
  tab.pinned = Boolean(pinned);
  emitTab('tab-update', tab);
  scheduleSessionSave();
  return getBrowserState();
}

function closeOtherTabs(id) {
  const keep = getTab(id);
  const otherIds = getWorkspaceTabs(keep.workspaceId || 'default')
    .filter((tab) => tab.id !== keep.id)
    .map((tab) => tab.id);
  for (const tabId of otherIds) {
    if (tabs.has(tabId)) closeTab(tabId);
  }
  if (tabs.has(keep.id)) switchTab(keep.id);
  return getBrowserState();
}

function reopenClosedTab() {
  const closed = closedTabs.shift();
  if (!closed) return null;
  const workspaceId = closed.workspaceId && workspaceList.some((workspace) => workspace.id === closed.workspaceId)
    ? closed.workspaceId
    : activeWorkspaceId;
  return createTab(closed.url, {
    workspaceId,
    activate: true,
    restored: { zoom: closed.zoom, muted: closed.muted, pinned: closed.pinned },
  });
}

async function navigateTab(id, input) {
  const tab = getTab(id);
  const externalUrl = safeExternalProtocolUrl(typeof input === 'string' ? input.trim() : '');
  if (externalUrl) {
    await confirmOpenExternalUrl(externalUrl, mainWindow);
    return publicTab(tab);
  }
  const url = normalizeNavigationUrl(input);
  tab.pendingInitialNavigation = false;
  tab.pageOwned = false;
  tab.url = url;
  tab.isLoading = url !== 'about:blank';
  tab.crashed = false;
  resizeViews();
  emitTab('tab-update', tab);
  const loadingContents = tab.view.webContents;
  loadTabContents(tab, url).catch(() => {
    if (!loadingContents || loadingContents.isDestroyed() || tabs.get(tab.id) !== tab) return;
    tab.isLoading = false;
    emitTab('tab-update', tab);
  });
  scheduleSessionSave();
  return publicTab(tab);
}

function goBack(id) {
  const tab = getTab(id);
  const navigation = navigationApi(tab.view.webContents);
  if (navigation && navigation.canGoBack()) navigation.goBack();
  return publicTab(tab);
}

function goForward(id) {
  const tab = getTab(id);
  const navigation = navigationApi(tab.view.webContents);
  if (navigation && navigation.canGoForward()) navigation.goForward();
  return publicTab(tab);
}

function goBackActive() {
  const tab = getActiveTab();
  return tab ? goBack(tab.id) : null;
}

function goForwardActive() {
  const tab = getActiveTab();
  return tab ? goForward(tab.id) : null;
}

function reloadTab(id, ignoreCache) {
  const tab = getTab(id);
  if (ignoreCache) tab.view.webContents.reloadIgnoringCache();
  else tab.view.webContents.reload();
  return publicTab(tab);
}

function reloadActive(ignoreCache) {
  const tab = getActiveTab();
  return tab ? reloadTab(tab.id, Boolean(ignoreCache)) : null;
}

function stopActive() {
  const tab = getActiveTab();
  if (tab) {
    cancelHttpAuthRequestsForTab(tab.id, 'stopped');
    tab.view.webContents.stop();
  }
  return tab ? publicTab(tab) : null;
}

function setTabMuted(id, muted) {
  if (typeof muted !== 'boolean') throw new TypeError('muted must be a boolean');
  const tab = getTab(id);
  tab.isMuted = muted;
  tab.view.webContents.setAudioMuted(muted);
  emitTab('tab-audio-state', tab);
  scheduleSessionSave();
  return publicTab(tab);
}

const CHROME_ZOOM_STEPS = Object.freeze([
  0.25, 0.33, 0.50, 0.67, 0.75, 0.80, 0.90, 1.00, 1.10, 1.25, 1.50, 1.75, 2.00, 2.50, 3.00, 4.00, 5.00
]);

function getNextZoomIn(current) {
  const rounded = Math.round((current || 1.0) * 100) / 100;
  for (const step of CHROME_ZOOM_STEPS) {
    if (step > rounded + 0.005) return step;
  }
  return CHROME_ZOOM_STEPS[CHROME_ZOOM_STEPS.length - 1];
}

function getNextZoomOut(current) {
  const rounded = Math.round((current || 1.0) * 100) / 100;
  for (let i = CHROME_ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (CHROME_ZOOM_STEPS[i] < rounded - 0.005) return CHROME_ZOOM_STEPS[i];
  }
  return CHROME_ZOOM_STEPS[0];
}

let siteZoomGrants = {};

function loadSiteZoomGrants() {
  if (privateInstance || !store) {
    siteZoomGrants = {};
    return;
  }
  const saved = store.get('site_zoom_levels_v1', {});
  siteZoomGrants = isPlainObject(saved) ? saved : {};
}

function saveSiteZoomGrants() {
  if (privateInstance || !store) return;
  store.set('site_zoom_levels_v1', siteZoomGrants);
}

function extractSiteHost(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.hostname.toLowerCase();
    }
  } catch (error) {}
  return null;
}

function getZoomForUrl(url) {
  const host = extractSiteHost(url);
  if (host && Number.isFinite(siteZoomGrants[host])) {
    return Math.min(5.0, Math.max(0.25, siteZoomGrants[host]));
  }
  return 1.0;
}

function saveZoomForUrl(url, factor) {
  const host = extractSiteHost(url);
  if (!host) return;
  const rounded = Math.round(factor * 100) / 100;
  if (Math.abs(rounded - 1.0) < 0.01) {
    delete siteZoomGrants[host];
  } else {
    siteZoomGrants[host] = rounded;
  }
  saveSiteZoomGrants();
}

function setActiveZoom(factor) {
  boundedNumber(factor, 'zoom factor', 0.25, 5.0);
  const tab = getActiveTab();
  if (!tab) return null;
  tab.zoom = factor;
  tab.view.webContents.setZoomFactor(factor);
  saveZoomForUrl(tab.url, factor);
  emitTab('tab-update', tab);
  scheduleSessionSave();
  return publicTab(tab);
}

function showFindForFocusedPage() {
  const primary = getActiveTab();
  const target = [primary, splitSecondaryTab(primary)].find((tab) =>
    tab && !tab.view.webContents.isDestroyed() && tab.view.webContents.isFocused());
  if (target) sendToShell('show-find-bar', { tabId: target.id });
  else if (primary && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isFocused()) {
    sendToShell('show-find-bar', { tabId: primary.id });
  }
}

function findInActivePage(text, options) {
  const query = boundedString(text, 'find text', 1000, false);
  const input = options === undefined || options === null
    ? {}
    : assertPlainObject(options, 'find options');
  const primary = getActiveTab();
  const secondary = splitSecondaryTab(primary);
  const tab = input.tabId === undefined || input.tabId === null ? primary :
    [primary, secondary].find((candidate) => candidate && candidate.id === input.tabId);
  if (!tab) return null;
  return tab.view.webContents.findInPage(query, {
    forward: input.forward !== false,
    findNext: Boolean(input.findNext),
    matchCase: Boolean(input.matchCase),
  });
}

function stopFindActive(tabId) {
  const tab = tabId === undefined || tabId === null ? getActiveTab() : tabs.get(tabId);
  if (tab) tab.view.webContents.stopFindInPage('clearSelection');
  return true;
}

async function captureActivePage() {
  const tab = getActiveTab();
  if (!tab || tab.url === 'about:blank') {
    return { success: false, error: 'No page is available to capture' };
  }
  const image = await tab.view.webContents.capturePage();
  const filename = 'InvictaTill-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
  const destination = uniquePath(path.join(app.getPath('downloads'), filename));
  await fs.promises.writeFile(destination, image.toPNG());
  return { success: true, path: destination };
}

function printActivePage() {
  const tab = getActiveTab();
  if (!tab || tab.url === 'about:blank') {
    return Promise.resolve({ success: false, error: 'No page is available to print' });
  }
  return new Promise((resolve) => {
    tab.view.webContents.print({ printBackground: true }, (success, failureReason) => {
      resolve(success
        ? { success: true }
        : { success: false, error: failureReason || 'Printing failed' });
    });
  });
}

async function saveActivePagePdf() {
  const tab = getActiveTab();
  if (!tab || tab.url === 'about:blank') {
    return { success: false, error: 'No page is available to save' };
  }
  const suggested = sanitizeFilename(tab.title || 'page') + '.pdf';
  const selection = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Page as PDF',
    defaultPath: path.join(app.getPath('documents'), suggested),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (selection.canceled || !selection.filePath) {
    return { success: false, canceled: true };
  }
  const data = await tab.view.webContents.printToPDF({ printBackground: true });
  await fs.promises.writeFile(selection.filePath, data);
  return { success: true, path: selection.filePath };
}

async function extractPageContext(options) {
  const input = isPlainObject(options) ? options : {};
  const maxChars = boundedInteger(
    input.maxChars === undefined ? 12000 : input.maxChars,
    'maxChars',
    500,
    MAX_PAGE_CONTEXT
  );
  const tab = getActiveTab();
  if (!tab || tab.url === 'about:blank') {
    return { title: '', url: 'about:blank', text: '', truncated: false };
  }

  const result = await tab.view.webContents.executeJavaScriptInIsolatedWorld(
    987,
    [{
      code:
        '(function () {' +
        'var body = document.body;' +
        'var text = body ? (body.innerText || "") : "";' +
        'return { title: document.title || "", url: location.href, text: text };' +
        '})()',
    }],
    false
  );
  const text = typeof result.text === 'string' ? result.text : '';
  return {
    title: typeof result.title === 'string' ? result.title.slice(0, 500) : tab.title,
    url: isAllowedRemoteUrl(result.url, false) ? result.url : tab.url,
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
  };
}

function cleanupDownloadTab(contents) {
  const tab = [...tabs.values()].find((entry) => entry.view.webContents === contents);
  if (!tab || !tab.pageOwned || !tab.pendingInitialNavigation || contents.isDestroyed()) return;
  // An explicitly opened blank page may contain a report written by its opener.
  if (tab.url === 'about:blank') return;
  const currentUrl = contents.getURL();
  if (currentUrl && currentUrl !== 'about:blank') return;
  // Wait until Chromium has handed the transfer to DownloadItem. Keep existing
  // report pages open; only discard a fresh child that never displayed a page.
  setImmediate(() => {
    if (tabs.get(tab.id) === tab && tab.pendingInitialNavigation) {
      closeTab(tab.id, { skipHistory: true });
    }
  });
}

function sanitizeFilename(value) {
  const text = String(value || 'download')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[.\s]+$/g, '')
    .slice(0, 180);
  return text || 'download';
}

function uniquePath(candidate) {
  const parsed = path.parse(candidate);
  let result = candidate;
  let counter = 1;
  while (fs.existsSync(result) && counter < 1000) {
    result = path.join(parsed.dir, parsed.name + ' (' + counter + ')' + parsed.ext);
    counter += 1;
  }
  return result;
}

function publicDownload(record) {
  const totalBytes = Number.isFinite(record.totalBytes) ? record.totalBytes : 0;
  const receivedBytes = Number.isFinite(record.receivedBytes) ? record.receivedBytes : 0;
  const startedAt = Number.isFinite(record.startedAt) ? record.startedAt : Date.now();
  const elapsedSeconds = Math.max(1, (Date.now() - startedAt) / 1000);
  const speedBytesPerSecond = record.state === 'progressing' || record.state === 'downloading'
    ? Math.round(receivedBytes / elapsedSeconds)
    : 0;
  const remainingBytes = totalBytes > receivedBytes ? totalBytes - receivedBytes : 0;
  const extension = path.extname(record.filename || '').replace(/^\./, '').toLowerCase();
  let retryUnavailableReason = '';
  if (record.requestMethod === 'POST') {
    retryUnavailableReason = 'Return to the original page and export again. This download requires the original form submission.';
  } else if (!safeRemoteUrl(record.url)) {
    retryUnavailableReason = 'Return to the original page and download this file again.';
  } else if (record.sessionKind === 'workspace' && !workspaceList.some((workspace) => workspace.id === record.workspaceId)) {
    retryUnavailableReason = 'The original workspace was removed. Open the source page in a workspace and download again.';
  } else if (!['workspace', 'whatsapp', 'browser'].includes(record.sessionKind)) {
    retryUnavailableReason = 'Return to the original page and download again. This saved download has no session information.';
  }
  return {
    id: record.id,
    url: record.url,
    filename: record.filename,
    extension,
    mimeType: record.mimeType,
    sourceHost: record.sourceHost || '',
    sessionKind: record.sessionKind || null,
    workspaceId: record.workspaceId || null,
    requestMethod: record.requestMethod || null,
    canRetry: !retryUnavailableReason,
    retryUnavailableReason,
    totalBytes,
    receivedBytes,
    percent: totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0,
    speedBytesPerSecond,
    etaSeconds: speedBytesPerSecond > 0 && remainingBytes > 0 ? Math.ceil(remainingBytes / speedBytesPerSecond) : null,
    state: record.state,
    paused: Boolean(record.paused),
    canResume: Boolean(record.canResume),
    savePath: record.savePath,
    filePath: record.savePath,
    exists: Boolean(record.savePath && fs.existsSync(record.savePath)),
    startedAt: record.startedAt,
    completedAt: record.completedAt || null,
    durationMs: record.completedAt && startedAt ? Math.max(0, record.completedAt - startedAt) : null,
    error: record.error || null,
  };
}

function updateDownloadRecord(record) {
  const index = downloadRecords.findIndex((item) => item.id === record.id);
  const snapshot = publicDownload(record);
  if (index >= 0) downloadRecords[index] = snapshot;
  else downloadRecords.push(snapshot);
  if (downloadRecords.length > MAX_DOWNLOADS) {
    downloadRecords.splice(0, downloadRecords.length - MAX_DOWNLOADS);
  }
  scheduleDownloadsSave();
  return snapshot;
}

function configureDownloads(targetSession, source = { sessionKind: 'browser' }) {
  if (configuredDownloadSessions.has(targetSession)) return;
  configuredDownloadSessions.add(targetSession);
  targetSession.on('will-download', (event, item, contents) => {
    const rawUrl = item.getURL() || '';
    const url = isAllowedDownloadUrl(rawUrl) || safeRemoteUrl(rawUrl);
    if (!url) {
      event.preventDefault();
      return;
    }
    const id = 'download-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const filename = sanitizeFilename(path.basename(item.getFilename() || 'download'));
    const savePath = uniquePath(path.join(app.getPath('downloads'), filename));
    item.setSavePath(savePath);
    let sourceHost = '';
    try {
      sourceHost = new URL(url.startsWith('blob:') ? url.slice(5) : url).hostname;
    } catch (error) {
      sourceHost = '';
    }

    const sourceTab = contents ? tabForRemoteContents(contents) : null;
    const record = {
      id,
      url,
      filename,
      mimeType: item.getMimeType() || '',
      sourceHost,
      sessionKind: source.sessionKind,
      workspaceId: source.sessionKind === 'workspace' ? source.workspaceId : null,
      requestMethod: sourceTab && sourceTab.pendingInitialNavigation && sourceTab.openedWithPost ? 'POST' : null,
      totalBytes: item.getTotalBytes() || 0,
      receivedBytes: item.getReceivedBytes() || 0,
      state: 'progressing',
      paused: false,
      canResume: false,
      savePath,
      startedAt: Date.now(),
      completedAt: null,
      error: null,
    };
    liveDownloads.set(id, { item, record });
    const created = updateDownloadRecord(record);
    sendToShell('download-created', created);

    item.on('updated', (downloadEvent, state) => {
      record.state = state;
      record.totalBytes = item.getTotalBytes() || record.totalBytes;
      record.receivedBytes = item.getReceivedBytes() || 0;
      record.paused = item.isPaused();
      record.canResume = item.canResume();
      const snapshot = updateDownloadRecord(record);
      sendToShell('download-updated', snapshot);
    });

    item.once('done', (downloadEvent, state) => {
      record.state = state;
      record.totalBytes = item.getTotalBytes() || record.totalBytes;
      record.receivedBytes = item.getReceivedBytes() || record.receivedBytes;
      record.paused = false;
      record.canResume = item.canResume();
      record.completedAt = Date.now();
      if (state !== 'completed') record.error = 'Download ' + state;
      const snapshot = updateDownloadRecord(record);
      sendToShell('download-updated', snapshot);
      liveDownloads.delete(id);
    });
    cleanupDownloadTab(contents);
  });
}

function getDownloads() {
  return downloadRecords.slice().reverse().map(publicDownload);
}

function downloadAction(id, action) {
  const downloadId = boundedString(id, 'download id', 200, false);
  const command = boundedString(action, 'download action', 30, false).toLowerCase();
  const live = liveDownloads.get(downloadId);

  if (command === 'remove') {
    downloadRecords = downloadRecords.filter((item) => item.id !== downloadId);
    scheduleDownloadsSave();
    return { success: true };
  }

  if (command === 'retry') {
    const existing = downloadRecords.find((item) => item.id === downloadId);
    if (!existing) throw new Error('Download not found');
    const snapshot = publicDownload(existing);
    if (!snapshot.canRetry) throw new Error(snapshot.retryUnavailableReason);
    const targetSession = existing.sessionKind === 'workspace'
      ? getWorkspaceSession(existing.workspaceId)
      : existing.sessionKind === 'whatsapp' ? getWhatsappSession() : browserSession;
    if (!targetSession) throw new Error('The original download session is unavailable. Download again from the source page.');
    targetSession.downloadURL(existing.url);
    return { success: true };
  }

  if (!live) throw new Error('Active download not found');
  if (command === 'pause') live.item.pause();
  else if (command === 'resume' && live.item.canResume()) live.item.resume();
  else if (command === 'cancel') live.item.cancel();
  else throw new TypeError('Unsupported download action');
  return { success: true, download: publicDownload(live.record) };
}

function showDownload(id) {
  const downloadId = boundedString(id, 'download id', 200, false);
  const record = downloadRecords.find((item) => item.id === downloadId);
  if (!record || !record.savePath) throw new Error('Download not found');
  shell.showItemInFolder(record.savePath);
  return true;
}

async function openDownloadsFolder() {
  const error = await shell.openPath(app.getPath('downloads'));
  return error
    ? { success: false, error }
    : { success: true };
}

async function openDownload(id) {
  const downloadId = boundedString(id, 'download id', 200, false);
  const record = downloadRecords.find((item) => item.id === downloadId);
  if (!record || !record.savePath || !fs.existsSync(record.savePath)) {
    throw new Error('Downloaded file not found');
  }
  const error = await shell.openPath(record.savePath);
  return error
    ? { success: false, error }
    : { success: true };
}

function copyDownloadUrl(id) {
  const downloadId = boundedString(id, 'download id', 200, false);
  const record = downloadRecords.find((item) => item.id === downloadId);
  if (!record || !record.url) throw new Error('Download URL not found');
  clipboard.writeText(record.url);
  return { success: true };
}

function clearDownloads() {
  downloadRecords = downloadRecords.filter((record) => liveDownloads.has(record.id));
  if (!privateInstance && store) {
    store.set('browser_downloads_v2', downloadRecords.slice(-MAX_DOWNLOADS));
  }
  return true;
}

function permissionOrigin(webContents, details, fallbackOrigin) {
  const candidates = [
    details && details.securityOrigin,
    details && details.requestingUrl,
    fallbackOrigin,
    webContents && !webContents.isDestroyed() ? webContents.getURL() : '',
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.origin;
    } catch (error) {
      // Try the next candidate.
    }
  }
  return null;
}

const PROMPTABLE_PERMISSIONS = new Set([
  'media',
  'camera',
  'microphone',
  'geolocation',
  'notifications',
  'clipboard-read',
  'clipboard-write',
  'clipboard-sanitized-write',
  'pointerLock',
  'fullscreen',
  'display-capture',
  'midi',
  'midiSysex',
  'mediaKeySystem',
  'idle-detection',
  'keyboardLock',
  'speaker-selection',
  'window-management',
  'storage-access',
  'top-level-storage-access',
  'openExternal',
  'fileSystem',
  'hid',
  'serial',
  'usb',
  'local-fonts',
  'screen-wake-lock',
  'persistent-storage',
  'background-sync',
  'sensors',
  'accessibility-events',
]);

function permissionKeys(origin, permission, details) {
  if (!origin) return [];
  if (permission === 'camera') {
    return [origin + '|camera', origin + '|media:video'];
  }
  if (permission === 'microphone') {
    return [origin + '|microphone', origin + '|media:audio'];
  }
  if (permission === 'media') {
    const requestedTypes = details && Array.isArray(details.mediaTypes)
      ? details.mediaTypes
      : (details && typeof details.mediaType === 'string' ? [details.mediaType] : []);
    const types = requestedTypes.filter((type) => type === 'video' || type === 'audio');
    const keys = [];
    if (types.length === 0 || types.includes('video')) {
      keys.push(origin + '|camera', origin + '|media:video');
    }
    if (types.length === 0 || types.includes('audio')) {
      keys.push(origin + '|microphone', origin + '|media:audio');
    }
    return keys;
  }
  return [origin + '|' + permission];
}

function permissionLabel(permission, details) {
  if (permission === 'camera') return 'camera';
  if (permission === 'microphone') return 'microphone';
  if (permission === 'display-capture') return 'screen share';
  if (permission === 'media') {
    const types = details && Array.isArray(details.mediaTypes)
      ? details.mediaTypes
      : (details && typeof details.mediaType === 'string' ? [details.mediaType] : []);
    if (types.includes('video') && types.includes('audio')) return 'camera and microphone';
    if (types.includes('video')) return 'camera';
    if (types.includes('audio')) return 'microphone';
    return 'camera and microphone';
  }
  const labels = {
    geolocation: 'location',
    notifications: 'notifications',
    'clipboard-read': 'clipboard',
    pointerLock: 'mouse pointer lock',
    fullscreen: 'full screen',
    'display-capture': 'screen share',
    mediaKeySystem: 'protected media playback',
    'idle-detection': 'device activity status',
    keyboardLock: 'keyboard lock',
    'speaker-selection': 'audio output devices',
    'window-management': 'window placement information',
    'storage-access': 'cross-site cookies',
    'top-level-storage-access': 'top-level storage access',
    openExternal: 'external applications',
    fileSystem: 'files and folders you choose',
    hid: 'HID devices',
    serial: 'serial devices',
    usb: 'USB devices',
    'local-fonts': 'local fonts',
    'screen-wake-lock': 'screen wake lock',
    'persistent-storage': 'persistent storage',
    'background-sync': 'background synchronization',
  };
  return labels[permission] || permission;
}

function savePermissionGrants() {
  if (!privateInstance && store) store.set('site_permission_grants_v2', permissionGrants);
}

function configurePermissions(targetSession) {
  targetSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (!PROMPTABLE_PERMISSIONS.has(permission)) return false;
    const origin = permissionOrigin(webContents, details, requestingOrigin);
    if (!origin) return false;
    const keys = permissionKeys(origin, permission, details);
    if (!keys.length) return false;
    if (keys.some((key) => permissionGrants[key] === false)) {
      return false;
    }
    // Source selection is the per-request consent prompt for display capture.
    if (permission === 'display-capture') return true;

    // Standard non-invasive web capabilities allowed by default in modern Chromium browsers
    // unless explicitly denied by the user.
    if (permission === 'pointerLock' || permission === 'keyboardLock' ||
        permission === 'fullscreen' || permission === 'screen-wake-lock' ||
        permission === 'mediaKeySystem' || permission === 'persistent-storage' ||
        permission === 'local-fonts' || permission === 'background-sync') {
      return true;
    }

    return keys.every((key) => permissionGrants[key] === true);
  });

  targetSession.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    let completed = false;
    const finish = (allowed) => {
      if (completed) return;
      completed = true;
      callback(Boolean(allowed));
    };

    try {
      if (!PROMPTABLE_PERMISSIONS.has(permission)) {
        finish(false);
        return;
      }
      const origin = permissionOrigin(webContents, details, null);
      if (!origin) {
        finish(false);
        return;
      }
      // Electron 43 performs a generic `media` permission request with an empty
      // mediaTypes array before dispatching the display-media source handler.
      const isDisplayMediaPipeline = permission === 'display-capture' || (
        permission === 'media' &&
        details && Array.isArray(details.mediaTypes) && details.mediaTypes.length === 0
      );
      const keys = permissionKeys(
        origin,
        isDisplayMediaPipeline ? 'display-capture' : permission,
        details
      );
      if (!keys.length) {
        finish(false);
        return;
      }
      if (keys.some((key) => permissionGrants[key] === false)) {
        finish(false);
        return;
      }
      if (isDisplayMediaPipeline) {
        // The source picker is the per-request permission prompt. Avoid a second
        // native dialog that can open behind the frameless browser window.
        finish(true);
        return;
      }
      // Standard non-invasive web capabilities are granted immediately without a
      // blocking dialog that disrupts 3D games, video playback, or fonts.
      if (permission === 'pointerLock' || permission === 'keyboardLock' ||
          permission === 'fullscreen' || permission === 'screen-wake-lock' ||
          permission === 'mediaKeySystem' || permission === 'persistent-storage' ||
          permission === 'local-fonts' || permission === 'background-sync') {
        if (keys.some((key) => permissionGrants[key] === false)) {
          finish(false);
          return;
        }
        finish(true);
        return;
      }
      if (keys.every((key) => permissionGrants[key] === true)) {
        finish(true);
        return;
      }
      if (!mainWindow || mainWindow.isDestroyed()) {
        finish(false);
        return;
      }
      const host = new URL(origin).hostname;
      const response = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Site Permission',
        message: 'Allow ' + host + ' to use your ' + permissionLabel(permission, details) + '?',
        detail: 'Only grant access to sites you trust.',
        buttons: ['Allow once', 'Always allow', 'Deny'],
        defaultId: 1,
        cancelId: 2,
        noLink: true,
      });
      if (response.response === 1) {
        for (const key of keys) permissionGrants[key] = true;
        savePermissionGrants();
        sendToShell('permission-state-changed', { origin, permission, granted: true, remembered: true });
        finish(true);
      } else if (response.response === 0) {
        sendToShell('permission-state-changed', { origin, permission, granted: true, remembered: false });
        finish(true);
      } else {
        for (const key of keys) permissionGrants[key] = false;
        savePermissionGrants();
        sendToShell('permission-state-changed', { origin, permission, granted: false, remembered: true });
        finish(false);
      }
    } catch (error) {
      finish(false);
    }
  });
}

function deviceLabel(item, type) {
  if (!item || typeof item !== 'object') return type + ' device';
  if (type === 'serial') {
    return String(item.displayName || item.portName || item.portId || 'Serial device').slice(0, 100);
  }
  if (type === 'passkey') {
    return String(item.displayName || item.name || 'Passkey account').slice(0, 100);
  }
  return String(
    item.deviceName || item.productName || item.name || item.manufacturerName ||
    item.serialNumber || (type.toUpperCase() + ' device')
  ).slice(0, 100);
}

async function chooseBrowserDevice(type, items) {
  const available = Array.isArray(items) ? items.filter(Boolean).slice(0, 8) : [];
  if (!available.length) return null;
  const title = type === 'passkey' ? 'Choose a passkey' : 'Choose a ' + type.toUpperCase() + ' device';
  const buttons = available.map((item) => deviceLabel(item, type));
  buttons.push('Cancel');
  const options = {
    type: 'question',
    title,
    message: title,
    detail: available.length < (Array.isArray(items) ? items.length : 0)
      ? 'Showing the first eight available choices.'
      : 'Only choose a device or account you trust.',
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    noLink: true,
  };
  const response = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options);
  return response.response >= 0 && response.response < available.length
    ? available[response.response]
    : null;
}

function configureDeviceSelection(targetSession) {
  if (!targetSession || configuredDeviceSessions.has(targetSession)) return;
  configuredDeviceSessions.add(targetSession);

  targetSession.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    chooseBrowserDevice('hid', details && details.deviceList)
      .then((selected) => callback(selected ? selected.deviceId : null))
      .catch(() => callback(null));
  });
  targetSession.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();
    chooseBrowserDevice('usb', details && details.deviceList)
      .then((selected) => callback(selected ? selected.deviceId : undefined))
      .catch(() => callback());
  });
  targetSession.on('select-serial-port', (event, portList, _contents, callback) => {
    event.preventDefault();
    chooseBrowserDevice('serial', portList)
      .then((selected) => callback(selected ? selected.portId : ''))
      .catch(() => callback(''));
  });
  targetSession.on('select-webauthn-account', (event, details, callback) => {
    event.preventDefault();
    chooseBrowserDevice('passkey', details && details.accounts)
      .then((selected) => callback(selected ? selected.credentialId : null))
      .catch(() => callback(null));
  });
}

function sanitizeHistoryRecord(value) {
  if (!isPlainObject(value)) return null;
  if (!isAllowedRemoteUrl(value.url, false)) return null;
  return {
    id: typeof value.id === 'string' ? value.id.slice(0, 200) : 'history-' + Date.now(),
    url: value.url.slice(0, MAX_URL_LENGTH),
    title: typeof value.title === 'string' ? value.title.slice(0, 500) : value.url,
    visitedAt: Number.isFinite(value.visitedAt) ? value.visitedAt : Date.now(),
  };
}

function sanitizeDownloadRecord(value) {
  if (!isPlainObject(value) || !isAllowedRemoteUrl(value.url, false)) return null;
  const wasActive = value.state === 'progressing' || value.state === 'downloading';
  return {
    id: typeof value.id === 'string' ? value.id.slice(0, 200) : 'download-' + Date.now(),
    url: value.url.slice(0, MAX_URL_LENGTH),
    filename: sanitizeFilename(value.filename || 'download'),
    sourceHost: typeof value.sourceHost === 'string' ? value.sourceHost.slice(0, 250) : '',
    sessionKind: ['workspace', 'whatsapp', 'browser'].includes(value.sessionKind) ? value.sessionKind : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId.slice(0, 100) : null,
    requestMethod: value.requestMethod === 'POST' ? 'POST' : null,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType.slice(0, 200) : '',
    totalBytes: Number.isFinite(value.totalBytes) ? value.totalBytes : 0,
    receivedBytes: Number.isFinite(value.receivedBytes) ? value.receivedBytes : 0,
    state: wasActive ? 'interrupted' : typeof value.state === 'string' ? value.state.slice(0, 50) : 'interrupted',
    paused: false,
    canResume: false,
    savePath: typeof value.savePath === 'string' ? value.savePath.slice(0, 32768) : '',
    startedAt: Number.isFinite(value.startedAt) ? value.startedAt : Date.now(),
    completedAt: Number.isFinite(value.completedAt) ? value.completedAt : null,
    error: wasActive ? 'Download interrupted when the browser closed' : typeof value.error === 'string' ? value.error.slice(0, 500) : null,
  };
}

let savedPasswords = [];

function secureStorageAvailable() {
  return Boolean(safeStorage && safeStorage.isEncryptionAvailable());
}

function normalizeCredentialOrigin(value) {
  const text = boundedString(value, 'credential origin', 32768, false);
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : 'https://' + text);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new TypeError('Unsupported credential origin');
    }
    return parsed.origin;
  } catch (error) {
    throw new TypeError('Invalid credential origin');
  }
}

function normalizeCredentialDomain(value) {
  const parsed = new URL(normalizeCredentialOrigin(value));
  return parsed.host.toLowerCase().replace(/^www\./, '').slice(0, 250);
}

function findSavedCredential(origin, username) {
  const normalized = normalizeCredentialOrigin(origin);
  return savedPasswords.find((item) => (
    item.origin === normalized && item.username === username
  )) || null;
}

function latestSavedCredential(origin) {
  const normalized = normalizeCredentialOrigin(origin);
  return savedPasswords
    .filter((item) => item.origin === normalized)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
}

function rememberCredentialUsername(tab, origin, username) {
  if (!tab || !origin || !username) return;
  recentCredentialUsernames.set(tab.id + '|' + origin, {
    username: String(username).slice(0, 250),
    observedAt: Date.now(),
  });
}

function recentCredentialUsername(tab, origin) {
  if (!tab || !origin) return '';
  const key = tab.id + '|' + origin;
  const remembered = recentCredentialUsernames.get(key);
  if (!remembered) return '';
  if (Date.now() - remembered.observedAt > 10 * 60 * 1000) {
    recentCredentialUsernames.delete(key);
    return '';
  }
  return remembered.username;
}

function saveCredential(payload) {
  assertPlainObject(payload, 'password payload');
  if (privateInstance) {
    throw new Error('Passwords are not saved from private windows');
  }
  if (!secureStorageAvailable()) {
    throw new Error('Secure OS key storage is not available; passwords cannot be saved safely');
  }
  const origin = normalizeCredentialOrigin(payload.origin || payload.domain);
  const domain = normalizeCredentialDomain(origin);
  const username = boundedString(payload.username || '', 'username', 250, true);
  const password = boundedString(payload.password || '', 'password', 500, false);
  const existing = findSavedCredential(origin, username);
  const mode = existing ? 'updated' : 'saved';

  if (existing) {
    existing.password = password;
    existing.updatedAt = Date.now();
  } else {
    savedPasswords.push({
      id: 'pwd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      origin,
      domain,
      username,
      password,
      updatedAt: Date.now(),
    });
  }
  savePasswordsToStore();
  return { mode, origin, domain, username };
}

function credentialForOrigin(origin) {
  if (privateInstance || !secureStorageAvailable()) return null;
  const credential = latestSavedCredential(origin);
  if (!credential) return null;
  return {
    username: credential.username,
    password: credential.password,
  };
}

function publicSavedPasswords() {
  return savedPasswords.map((item) => ({
    id: item.id,
    origin: item.origin,
    domain: item.domain,
    username: item.username,
    updatedAt: item.updatedAt,
  }));
}

function queueCredentialSavePrompt(payload, senderDetails) {
  if (privateInstance || !secureStorageAvailable()) return false;
  assertPlainObject(payload, 'submitted credential');
  const origin = normalizeCredentialOrigin(senderDetails.origin);
  const domain = normalizeCredentialDomain(origin);
  const reportedUsername = boundedString(payload.username || '', 'username', 250, true);
  if (reportedUsername) {
    rememberCredentialUsername(senderDetails.tab, senderDetails.origin, reportedUsername);
  }
  const username = reportedUsername || recentCredentialUsername(senderDetails.tab, senderDetails.origin);
  const password = boundedString(payload.password || '', 'password', 500, false);
  const existing = findSavedCredential(origin, username);
  if (existing && existing.password === password) return false;

  for (const pending of pendingCredentialPrompts.values()) {
    if (pending.origin === origin && pending.username === username && pending.password === password) {
      return false;
    }
  }

  const requestId = 'credential-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const timeout = setTimeout(() => pendingCredentialPrompts.delete(requestId), 120000);
  if (typeof timeout.unref === 'function') timeout.unref();
  pendingCredentialPrompts.set(requestId, {
    requestId,
    origin,
    domain,
    username,
    password,
    mode: existing ? 'update' : 'save',
    tabId: senderDetails.tab.id,
    timeout,
  });
  sendToShell('password-save-request', {
    requestId,
    origin,
    domain,
    username,
    mode: existing ? 'update' : 'save',
  });
  return true;
}

function resolveCredentialSavePrompt(requestId, decision) {
  const id = boundedString(requestId, 'credential request id', 200, false);
  const action = boundedString(decision, 'credential decision', 20, false).toLowerCase();
  if (action !== 'save' && action !== 'dismiss') {
    throw new TypeError('Unsupported credential decision');
  }
  const pending = pendingCredentialPrompts.get(id);
  if (!pending) return { success: false, expired: true };
  pendingCredentialPrompts.delete(id);
  clearTimeout(pending.timeout);
  if (action === 'dismiss') return { success: true, saved: false };
  const result = saveCredential(pending);
  return { success: true, saved: true, ...result };
}

function loadSavedPasswords() {
  if (!store || privateInstance) return;
  if (!secureStorageAvailable()) {
    savedPasswords = [];
    return;
  }
  const raw = store.get('workspace_passwords_v1', []);
  if (Array.isArray(raw)) {
    let needsMigration = false;
    savedPasswords = raw.map((item) => {
      if (!isPlainObject(item)) return null;
      let pass = '';
      if (typeof item.encrypted === 'string' && item.encrypted) {
        try {
          pass = safeStorage.decryptString(Buffer.from(item.encrypted, 'hex'));
        } catch (error) {
          return null;
        }
      } else if (typeof item.password === 'string' && item.password) {
        // Migrate legacy plaintext entries immediately into OS-backed encryption.
        pass = item.password;
        needsMigration = true;
      }
      let origin = '';
      let domain = '';
      try {
        // Older entries discarded the scheme and www prefix. Bind those
        // ambiguous hosts to HTTPS only; a different origin must be saved again.
        origin = item.origin
          ? normalizeCredentialOrigin(item.origin)
          : normalizeCredentialOrigin(normalizeCredentialDomain(item.domain));
        domain = normalizeCredentialDomain(origin);
        if (origin !== item.origin || domain !== item.domain) needsMigration = true;
      } catch (error) {
        return null;
      }
      return {
        id: typeof item.id === 'string' ? item.id : 'pwd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        origin,
        domain,
        username: typeof item.username === 'string' ? item.username.slice(0, 250) : '',
        password: typeof pass === 'string' ? pass.slice(0, 500) : '',
        updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
      };
    }).filter((p) => p && p.domain);
    if (needsMigration) savePasswordsToStore();
  }
}

function savePasswordsToStore() {
  if (!store || privateInstance) return;
  if (!secureStorageAvailable()) {
    throw new Error('Secure OS key storage is not available; passwords were not saved');
  }
  const toSave = savedPasswords.map((item) => {
    const encrypted = safeStorage.encryptString(item.password).toString('hex');
    return {
      id: item.id,
      origin: item.origin,
      domain: item.domain,
      username: item.username,
      encrypted,
      updatedAt: item.updatedAt,
    };
  });
  store.set('workspace_passwords_v1', toSave);
}

function parseCsvRows(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function importPasswordsFromCsv(csvText) {
  if (privateInstance) throw new Error('Cannot import passwords in private mode');
  if (!secureStorageAvailable()) throw new Error('OS secure storage is not available; passwords cannot be saved');

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { success: true, count: 0, skipped: 0 };

  const headers = rows[0].map((h) => h.toLowerCase());
  let urlIdx = headers.findIndex((h) => h.includes('url') || h.includes('website') || h.includes('origin'));
  let userIdx = headers.findIndex((h) => h.includes('username') || h.includes('user') || h.includes('login') || h.includes('email'));
  let passIdx = headers.findIndex((h) => h.includes('password') || h.includes('pass'));

  if (urlIdx === -1 || passIdx === -1) {
    if (rows[0].length >= 4) {
      urlIdx = 1; userIdx = 2; passIdx = 3;
    } else if (rows[0].length >= 3) {
      urlIdx = 0; userIdx = 1; passIdx = 2;
    } else {
      throw new Error('Unrecognized password CSV format. Columns for URL and Password are required.');
    }
  }

  let count = 0;
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawUrl = row[urlIdx] || '';
    const username = userIdx >= 0 ? (row[userIdx] || '') : '';
    const password = row[passIdx] || '';

    if (!rawUrl || !password) {
      skipped++;
      continue;
    }

    try {
      const origin = normalizeCredentialOrigin(rawUrl);
      const domain = normalizeCredentialDomain(origin);
      const existing = findSavedCredential(origin, username);
      if (existing) {
        existing.password = password;
        existing.updatedAt = Date.now();
      } else {
        savedPasswords.push({
          id: 'pwd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          origin,
          domain,
          username: username.slice(0, 250),
          password: password.slice(0, 500),
          updatedAt: Date.now(),
        });
      }
      count++;
    } catch (e) {
      skipped++;
    }
  }

  if (count > 0) {
    savePasswordsToStore();
  }
  return { success: true, count, skipped };
}

function getInstalledBrowserHistoryPaths() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  return {
    chrome: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'History'),
    edge: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'History'),
    brave: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'History'),
    opera: path.join(appData, 'Opera Software', 'Opera Stable', 'History'),
  };
}

function detectInstalledBrowsers() {
  const paths = getInstalledBrowserHistoryPaths();
  return {
    chrome: fs.existsSync(paths.chrome),
    edge: fs.existsSync(paths.edge),
    brave: fs.existsSync(paths.brave),
    opera: fs.existsSync(paths.opera),
  };
}

function importBrowserHistory(browserName) {
  if (privateInstance) throw new Error('Cannot import history in private mode');
  const paths = getInstalledBrowserHistoryPaths();
  const histPath = paths[browserName];
  if (!histPath || !fs.existsSync(histPath)) {
    throw new Error('History database not found for ' + browserName);
  }

  const tmpCopy = path.join(os.tmpdir(), 'invicta_import_hist_' + Date.now() + '.tmp');
  try {
    fs.copyFileSync(histPath, tmpCopy);
    const buf = fs.readFileSync(tmpCopy);
    try { fs.unlinkSync(tmpCopy); } catch (e) {}

    const str = buf.toString('latin1');
    const matches = str.match(/https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g);
    if (!matches || matches.length === 0) {
      return { success: true, count: 0 };
    }

    const cleanUrls = Array.from(new Set(
      matches.filter((u) => u.length > 10 && u.length < 500 && !u.includes('\0') && !u.includes('\r') && !u.includes('\n'))
    ));

    let added = 0;
    const now = Date.now();
    for (const rawUrl of cleanUrls) {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
        const url = parsed.href;
        if (url.includes('chrome-extension:') || url.includes('devtools:') || url.includes('edge://')) continue;

        if (!historyRecords.some((r) => r.url === url)) {
          historyRecords.push({
            id: 'history-' + (now - added * 100) + '-' + Math.random().toString(36).slice(2, 8),
            url,
            title: parsed.hostname + (parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(0, 40) : ''),
            visitedAt: now - added * 1000,
          });
          added++;
        }
      } catch (e) {}
    }

    if (historyRecords.length > MAX_HISTORY) {
      historyRecords.splice(0, historyRecords.length - MAX_HISTORY);
    }
    scheduleHistorySave();
    return { success: true, count: added };
  } catch (err) {
    try { if (fs.existsSync(tmpCopy)) fs.unlinkSync(tmpCopy); } catch (e) {}
    throw new Error('Failed to import ' + browserName + ' history: ' + err.message);
  }
}

function importHistoryFromFile(content, fileExtension) {
  if (privateInstance) throw new Error('Cannot import history in private mode');
  let items = [];
  if (fileExtension === '.json') {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && Array.isArray(parsed.history)) {
        items = parsed.history;
      }
    } catch (e) {
      throw new Error('Invalid JSON history file');
    }
  } else {
    const rows = parseCsvRows(content);
    if (rows.length > 0) {
      const headers = rows[0].map((h) => h.toLowerCase());
      const urlIdx = headers.findIndex((h) => h.includes('url'));
      const titleIdx = headers.findIndex((h) => h.includes('title') || h.includes('name'));
      const startRow = (urlIdx !== -1) ? 1 : 0;
      const targetUrlIdx = urlIdx !== -1 ? urlIdx : 0;
      const targetTitleIdx = titleIdx !== -1 ? titleIdx : (rows[0].length > 1 ? 1 : -1);

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (row[targetUrlIdx]) {
          items.push({
            url: row[targetUrlIdx],
            title: targetTitleIdx >= 0 ? row[targetTitleIdx] : '',
          });
        }
      }
    }
  }

  let added = 0;
  const now = Date.now();
  for (const item of items) {
    const rawUrl = typeof item === 'string' ? item : (item && (item.url || item.href));
    if (!rawUrl || typeof rawUrl !== 'string') continue;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      const url = parsed.href;
      if (!historyRecords.some((r) => r.url === url)) {
        historyRecords.push({
          id: 'history-' + (now - added * 50) + '-' + Math.random().toString(36).slice(2, 8),
          url,
          title: (item && item.title) || parsed.hostname,
          visitedAt: (item && item.visitedAt) || (now - added * 1000),
        });
        added++;
      }
    } catch (e) {}
  }

  if (historyRecords.length > MAX_HISTORY) {
    historyRecords.splice(0, historyRecords.length - MAX_HISTORY);
  }
  scheduleHistorySave();
  return { success: true, count: added };
}

function loadPersistentBrowserData() {
  if (!store) return;
  loadWorkspaces();
  loadSavedPasswords();
  loadSiteZoomGrants();
  if (!privateInstance) {
    const storedHistory = store.get('browser_history_v2', []);
    historyRecords = Array.isArray(storedHistory)
      ? storedHistory.map(sanitizeHistoryRecord).filter(Boolean).slice(-MAX_HISTORY)
      : [];
    const storedDownloads = store.get('browser_downloads_v2', []);
    downloadRecords = Array.isArray(storedDownloads)
      ? storedDownloads.map(sanitizeDownloadRecord).filter(Boolean).slice(-MAX_DOWNLOADS)
      : [];
  }
  if (privateInstance) {
    permissionGrants = {};
  } else {
    const grants = store.get('site_permission_grants_v2', {});
    permissionGrants = isPlainObject(grants) ? grants : {};
  }
}

function restoreTabs() {
  if (privateInstance || !store) {
    createTab('about:blank', { activate: true });
    return;
  }
  const saved = store.get('browser_session_v2', null);
  const entries = saved && Array.isArray(saved.tabs)
    ? saved.tabs.slice(0, 30)
    : [];
  if (!entries.length) {
    createTab('about:blank', { activate: true });
    return;
  }

  if (saved && saved.activeWorkspaceId && workspaceList.some((w) => w.id === saved.activeWorkspaceId)) {
    activeWorkspaceId = saved.activeWorkspaceId;
  }

  const createdTabs = [];
  for (const entry of entries) {
    const url = entry && isAllowedRemoteUrl(entry.url, true) ? entry.url : 'about:blank';
    const wsId = entry && entry.workspaceId && workspaceList.some((w) => w.id === entry.workspaceId)
      ? entry.workspaceId
      : 'default';
    const created = createTab(url, {
      workspaceId: wsId,
      activate: false,
      restored: {
        zoom: entry && Number.isFinite(entry.zoom) ? entry.zoom : 1,
        muted: Boolean(entry && entry.muted),
        pinned: Boolean(entry && entry.pinned),
      },
    });
    createdTabs.push({ id: created.id, workspaceId: wsId });
  }

  lastActiveTabByWorkspace = restoreWorkspaceMemory(
    createdTabs,
    saved && saved.lastActiveTabIndexes
  );

  const activeIndex = Number.isInteger(saved.activeIndex)
    ? Math.min(Math.max(saved.activeIndex, 0), createdTabs.length - 1)
    : 0;
  const rememberedTabId = lastActiveTabByWorkspace.get(activeWorkspaceId);
  const legacyActive = createdTabs[activeIndex];
  if (rememberedTabId) {
    switchTab(rememberedTabId);
  } else if (legacyActive) {
    switchTab(legacyActive.id);
  } else {
    activateWorkspace(activeWorkspaceId);
  }
}

function queryHistory(query) {
  let text = '';
  let limit = 200;
  let range = 'all';
  if (typeof query === 'string') {
    text = query.trim().toLowerCase().slice(0, 500);
  } else if (query !== undefined && query !== null) {
    assertPlainObject(query, 'history query');
    const queryText = query.text === undefined ? query.query : query.text;
    if (queryText !== undefined && typeof queryText !== 'string') {
      throw new TypeError('history query text must be a string');
    }
    text = typeof queryText === 'string'
      ? queryText.trim().toLowerCase().slice(0, 500)
      : '';
    if (query.limit !== undefined) {
      limit = boundedInteger(query.limit, 'history limit', 1, 1000);
    }
    if (query.range !== undefined) {
      if (typeof query.range !== 'string' ||
          !['day', 'week', 'month', 'year', 'all'].includes(query.range)) {
        throw new TypeError('Unsupported history range');
      }
      range = query.range;
    }
  }
  const now = new Date();
  let records = range === 'all'
    ? historyRecords
    : historyRecords.filter((record) => {
      const visited = new Date(record.visitedAt);
      if (range === 'day') return visited.toDateString() === now.toDateString();
      if (range === 'week') return visited >= new Date(now.getTime() - 7 * 86400000);
      if (range === 'month') {
        return visited.getMonth() === now.getMonth() &&
          visited.getFullYear() === now.getFullYear();
      }
      return visited.getFullYear() === now.getFullYear();
    });
  records = text
    ? records.filter((record) =>
      record.url.toLowerCase().includes(text) ||
      record.title.toLowerCase().includes(text))
    : records;
  return records.slice(-limit).reverse();
}

function clearHistory() {
  historyRecords = [];
  if (!privateInstance && store) store.set('browser_history_v2', []);
  return true;
}

async function clearBrowsingData(options) {
  const input = options === undefined ? {} : assertPlainObject(options, 'clear data options');
  const allowedKeys = new Set([
    'cache',
    'cookies',
    'localStorage',
    'indexedDB',
    'serviceWorkers',
    'auth',
    'history',
    'downloads',
    'permissions',
  ]);
  for (const [key, value] of Object.entries(input)) {
    if (!allowedKeys.has(key)) throw new TypeError('Unsupported clear-data option: ' + key);
    if (typeof value !== 'boolean') {
      throw new TypeError('clear-data option ' + key + ' must be a boolean');
    }
  }
  const clearAll = Object.keys(input).length === 0;
  const result = {};

  if (clearAll || input.cache === true) {
    await browserSession.clearCache();
    result.cache = true;
  }

  const storages = [];
  if (clearAll || input.cookies === true) storages.push('cookies');
  if (clearAll || input.localStorage === true) storages.push('localstorage');
  if (clearAll || input.indexedDB === true) storages.push('indexdb');
  if (clearAll || input.serviceWorkers === true) {
    storages.push('serviceworkers', 'cachestorage');
  }
  if (storages.length) {
    await browserSession.clearStorageData({ storages: Array.from(new Set(storages)) });
    result.storage = true;
  }

  if (clearAll || input.auth === true) {
    await browserSession.clearAuthCache();
    result.auth = true;
  }
  if (clearAll || input.history === true) {
    clearHistory();
    result.history = true;
  }
  if (clearAll || input.downloads === true) {
    downloadRecords = [];
    if (!privateInstance && store) store.set('browser_downloads_v2', []);
    result.downloads = true;
  }
  if (clearAll || input.permissions === true) {
    permissionGrants = {};
    savePermissionGrants();
    result.permissions = true;
  }
  return { success: true, cleared: result };
}

function getReleaseDetails() {
  return {
    version: app.getVersion(),
    releaseDate: '2026-11-17',
    title: 'ChatGPT, saved websites, and Downloads',
    intro: 'Open ChatGPT and your favorite websites in the sidebar.',
    features: [
      'Open ChatGPT in the same sidebar as WhatsApp from the app rail or with Ctrl+Shift+G.',
      'Use the plus button to save a website. Sidebar pages stay open as you switch between them.',
      'Reload a sidebar site or open it in a full tab from the panel header.',
    ],
    bugFixes: [
      'Aligned file details, warnings, progress bars, and controls in Downloads.',
      'Downloads and other browser popups stay accessible alongside sidebar websites.',
    ],
  };
}

function setupAutoUpdater() {
  if (updateController) return updateController.getState();
  let disabledReason = null;
  if (isDev) disabledReason = 'Updates are available only in an installed production build.';
  else if (privateInstance) disabledReason = 'Updates are managed by the regular browser window.';
  else if (portableInstance) disabledReason = 'Automatic updates require the installed setup version; portable builds update manually.';
  else if (!autoUpdater) disabledReason = 'Update service is unavailable in this build.';

  updateController = createUpdateController({
    updater: autoUpdater,
    currentVersion: app.getVersion(),
    disabledReason,
    send: sendToShell,
  });
  updateController.configure();
  updateController.scheduleAutomaticCheck(8000);
  return updateController.getState();
}

async function checkForUpdates() {
  if (!updateController) setupAutoUpdater();
  return updateController.check(true);
}

function installUpdate() {
  if (!updateController) setupAutoUpdater();
  return updateController.install();
}

function setupFocusController() {
  if (focusController) return focusController.getState();
  focusController = createFocusController({
    loadState: () => (!privateInstance && store ? store.get('focus_session_v1', null) : null),
    saveState: (value) => {
      if (!privateInstance && store) store.set('focus_session_v1', value);
    },
    loadHistory: () => (!privateInstance && store ? store.get('focus_history_v1', []) : []),
    saveHistory: (value) => {
      if (!privateInstance && store) store.set('focus_history_v1', value);
    },
    send: sendToShell,
    notify: (mode, intention) => {
      if (testMode || !Notification.isSupported()) return;
      const isBreak = mode === 'break';
      const title = isBreak ? 'Break complete' : 'Focus session complete';
      const body = isBreak
        ? 'Ready for the next focused work block.'
        : (intention ? 'Completed: ' + intention : 'Great work. Take a short recovery break.');
      new Notification({ title, body, silent: false }).show();
    },
  });
  return focusController.configure();
}

function generate24HourWfhReport() {
  const records = privateInstance
    ? historyRecords
    : (store ? store.get('wfh_activity_records', []) : []);
  const valid = Array.isArray(records) ? records : [];
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const recent24h = valid.filter((record) => {
    const timestamp = record.timestamp || record.visitedAt;
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });

  const domainCounts = new Map();
  recent24h.forEach((rec) => {
    let domain = rec.domain;
    if (!domain && rec.url) {
      try { domain = new URL(rec.url).hostname; } catch (e) {}
    }
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }
  });

  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dom, count]) => '  • ' + dom + ' (' + count + ' visits)');

  const tasks = store ? store.get('pending_tasks', []) : [];
  const pendingTasksList = Array.isArray(tasks) ? tasks.filter((t) => !t.done) : [];
  const completedTasksList = Array.isArray(tasks) ? tasks.filter((t) => t.done) : [];

  const reportText =
    'Web pages visited: ' + recent24h.length + '\n' +
    'Open tabs: ' + tabs.size + '\n' +
    'Open tasks: ' + pendingTasksList.length + '\n' +
    'Completed tasks: ' + completedTasksList.length + '\n\n' +
    'Top visited domains\n' +
    (topDomains.length ? topDomains.join('\n') : '  • No web activity recorded in the last 24 hours') + '\n\n' +
    'Pending tasks\n' +
    (pendingTasksList.length
      ? pendingTasksList.slice(0, 5).map((t) => '  [ ] ' + t.text + (t.date ? ' (' + t.date + ')' : '')).join('\n')
      : '  • No pending tasks');

  return {
    success: true,
    response: reportText,
    report: reportText,
    totalVisits: recent24h.length,
    openTasks: pendingTasksList.length,
    completedTasks: completedTasksList.length
  };
}

function extractEmailTasksFromContext(pageContext) {
  if (!pageContext || !pageContext.text) {
    return {
      success: false,
      error: 'Open an email or page with readable text.'
    };
  }

  const text = pageContext.text;
  const url = pageContext.url || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const detectedTasks = [];

  for (const line of lines) {
    if (detectedTasks.length >= 6) break;
    if (/^(re:|fwd:|subject:|action required|please|kindly|deadline|review|confirm|submit|send|update)/i.test(line) && line.length >= 10 && line.length <= 150) {
      detectedTasks.push(line.replace(/^(re:|fwd:|subject:)\s*/i, 'Email Action: '));
    }
  }

  if (!detectedTasks.length) {
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 20 && s.length <= 120);
    const actionable = sentences.filter((s) => /please|need|must|review|reply|send|check|verify|report|update|confirm/i.test(s)).slice(0, 4);
    actionable.forEach((s) => detectedTasks.push('Task: ' + s));
  }

  const currentTasks = store ? store.get('pending_tasks', []) : [];
  const existingTexts = new Set(currentTasks.map((t) => t.text));
  const newTasksAdded = [];

  detectedTasks.forEach((taskTitle) => {
    const textToSave = taskTitle.slice(0, 200);
    if (!existingTexts.has(textToSave)) {
      const item = {
        id: 'task-email-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        text: textToSave,
        done: false,
        date: new Date().toLocaleDateString(),
        sourceUrl: url,
        sourceTitle: pageContext.title || 'Email Task'
      };
      currentTasks.unshift(item);
      newTasksAdded.push(item);
      existingTexts.add(textToSave);
    }
  });

  if (store && newTasksAdded.length) {
    store.set('pending_tasks', currentTasks.slice(0, MAX_TASKS));
  }

  return {
    success: true,
    addedTasks: newTasksAdded,
    totalTasks: currentTasks.length
  };
}

function sanitizeBookmark(value) {
  if (!isPlainObject(value)) throw new TypeError('Invalid bookmark');
  const url = normalizeNavigationUrl(value.url);
  if (url === 'about:blank') throw new TypeError('Blank pages cannot be bookmarked');
  return {
    url,
    title: typeof value.title === 'string' ? value.title.slice(0, 500) : url,
  };
}

function sanitizeTask(value) {
  if (!isPlainObject(value)) throw new TypeError('Invalid task');
  return {
    id: typeof value.id === 'string'
      ? value.id.slice(0, 200)
      : 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    text: boundedString(value.text, 'task text', 2000, false),
    done: Boolean(value.done),
    date: typeof value.date === 'string' ? value.date.slice(0, 100) : new Date().toLocaleDateString(),
  };
}

function sanitizeActivity(value) {
  assertPlainObject(value, 'activity item');
  const timestamp = Number.isFinite(value.timestamp) ? value.timestamp : Date.now();
  return {
    id: 'activity-' + timestamp + '-' + Math.random().toString(36).slice(2, 8),
    timestamp,
    dateStr: typeof value.dateStr === 'string'
      ? value.dateStr.slice(0, 20)
      : new Date(timestamp).toISOString().slice(0, 10),
    title: typeof value.title === 'string' ? value.title.slice(0, 500) : 'Browsing Activity',
    url: isAllowedRemoteUrl(value.url, false) ? value.url.slice(0, MAX_URL_LENGTH) : '',
    domain: typeof value.domain === 'string' ? value.domain.slice(0, 300) : '',
    durationSec: Number.isFinite(value.durationSec)
      ? Math.min(Math.max(value.durationSec, 0), 86400)
      : 60,
    category: typeof value.category === 'string' ? value.category.slice(0, 100) : 'General',
    mode: typeof value.mode === 'string' ? value.mode.slice(0, 100) : 'Workspace',
  };
}

function activityStoreRecords() {
  if (privateInstance) return historyRecords;
  const records = store ? store.get('wfh_activity_records', []) : [];
  return Array.isArray(records) ? records : [];
}

function saveActivityRecords(records) {
  if (!privateInstance && store) {
    store.set('wfh_activity_records', records.slice(-MAX_ACTIVITY_RECORDS));
  }
}

function filterActivityRecords(timeframe) {
  const allowed = new Set(['day', 'week', 'month', 'year', 'all']);
  const selected = allowed.has(timeframe) ? timeframe : 'day';
  const now = new Date();
  return activityStoreRecords().filter((record) => {
    const timestamp = record.timestamp || record.visitedAt;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return false;
    if (selected === 'day') return date.toDateString() === now.toDateString();
    if (selected === 'week') return date >= new Date(now.getTime() - 7 * 86400000);
    if (selected === 'month') {
      return date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    }
    if (selected === 'year') return date.getFullYear() === now.getFullYear();
    return true;
  });
}

function applyTabBackgroundThrottling() {
  const enabled = currentGamingLevel === 0 && backgroundTabThrottlingEnabled();
  for (const tab of tabs.values()) {
    const contents = tab.view.webContents;
    if (!contents.isDestroyed()) contents.setBackgroundThrottling(enabled);
  }
}

function setGamingMode(level) {
  boundedInteger(level, 'gaming level', 0, 2);
  currentGamingLevel = level;
  if (level > 0 && powerBlockerId === null) {
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
  if (level === 0 && powerBlockerId !== null) {
    if (powerSaveBlocker.isStarted(powerBlockerId)) {
      powerSaveBlocker.stop(powerBlockerId);
    }
    powerBlockerId = null;
  }
  applyTabBackgroundThrottling();
  return {
    success: true,
    level,
    safeMode: true,
    killedApps: [],
    note: 'Gaming mode does not modify Windows or terminate other applications.',
  };
}

function toggleFullscreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
}

function launchPrivateWindow() {
  if (privateLaunchPending) {
    return { success: false, error: 'A private window is already launching' };
  }
  privateLaunchPending = true;
  try {
    let executable;
    let args;
    if (isDev) {
      executable = process.execPath;
      args = [process.argv[1], '--dev', '--private-mode'];
    } else {
      executable = app.getPath('exe');
      args = ['--private-mode'];
    }
    spawn(executable, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    setTimeout(() => {
      privateLaunchPending = false;
    }, 3000);
    return { success: true };
  } catch (error) {
    privateLaunchPending = false;
    return { success: false, error: error.message };
  }
}

function registerIpcHandlers() {
  ipcMain.on('credential-username-observed', (event, payload) => {
    try {
      if (!isPlainObject(payload)) return;
      const senderDetails = trustedCredentialSender(event, payload.origin);
      if (!senderDetails) return;
      const username = boundedString(payload.username || '', 'username', 250, false);
      rememberCredentialUsername(senderDetails.tab, senderDetails.origin, username);
    } catch (error) {
      // Username-only login steps are best-effort and never block navigation.
    }
  });
  ipcMain.on('open-link-from-page', (event, payload) => {
    try {
      if (!isPlainObject(payload)) return;
      const senderDetails = trustedPageOpenSender(event, payload.origin, payload.url);
      if (!senderDetails) return;
      openUrlInWorkspaceTab(senderDetails.url, senderDetails.tab, {
        activate: payload.activate !== false,
      });
    } catch (error) {
      // Invalid page link requests are ignored; normal navigation can continue.
    }
  });
  ipcMain.on('credential-submitted', (event, payload) => {
    try {
      if (!isPlainObject(payload)) return;
      const senderDetails = trustedCredentialSender(event, payload.origin);
      if (!senderDetails) return;
      queueCredentialSavePrompt(payload, senderDetails);
    } catch (error) {
      // Invalid or stale credential reports are ignored without exposing secrets.
    }
  });
  ipcMain.handle('get-page-credential', async (event, payload) => {
    try {
      if (!isPlainObject(payload)) return null;
      const senderDetails = trustedCredentialSender(event, payload.origin);
      if (!senderDetails) return null;
      return credentialForOrigin(senderDetails.origin);
    } catch (error) {
      return null;
    }
  });
  registerHandler('get-browser-state', () => getBrowserState());
  registerHandler('get-all-tabs', () => getAllTabs());
  registerHandler('new-tab', (event, url) =>
    createTab(url === undefined || url === null || url === '' ? 'about:blank' : url, {
      activate: true,
    }));
  registerHandler('close-tab', (event, id) => closeTab(id));
  registerHandler('switch-tab', (event, id) => switchTab(id));
  registerHandler('duplicate-tab', (event, id) => duplicateTab(id));
  registerHandler('set-tab-pinned', (event, payload) => {
    assertPlainObject(payload, 'pin tab payload');
    if (typeof payload.pinned !== 'boolean') throw new TypeError('pinned must be a boolean');
    return setTabPinned(payload.id, payload.pinned);
  });
  registerHandler('close-other-tabs', (event, id) => closeOtherTabs(id));
  registerHandler('reopen-closed-tab', () => reopenClosedTab());
  registerHandler('navigate', (event, url) => {
    const tab = getActiveTab();
    if (!tab) throw new Error('No active tab');
    return navigateTab(tab.id, url);
  });
  registerHandler('go-back', () => goBackActive());
  registerHandler('go-forward', () => goForwardActive());
  registerHandler('reload', (event, ignoreCache) => {
    if (ignoreCache !== undefined && typeof ignoreCache !== 'boolean') {
      throw new TypeError('ignoreCache must be a boolean');
    }
    return reloadActive(Boolean(ignoreCache));
  });
  registerHandler('stop', () => stopActive());
  registerHandler('get-active-url', () => {
    const tab = getActiveTab();
    return tab ? tab.url : '';
  });
  registerHandler('set-view-visible', (event, visible) => setViewVisible(visible));
  registerHandler('set-view-layout', (event, layout) => setViewLayout(layout));
  registerHandler('get-sidebar-panel-state', (event, id) =>
    publicSidebarPanelState(sidebarPanels.get(sidebarPanelId(id))));
  registerHandler('set-sidebar-panel', (event, payload) => setSidebarPanel(payload));
  registerHandler('reload-sidebar-panel', (event, id) => reloadSidebarPanel(id));
  registerHandler('open-sidebar-panel-tab', (event, id) => openSidebarPanelTab(id));
  registerHandler('remove-sidebar-panel', (event, id) => removeSidebarPanel(id));
  registerHandler('set-split-screen', (event, options) => setSplitScreen(options));
  registerHandler('find-in-page', (event, text, options) => findInActivePage(text, options));
  registerHandler('stop-find', (event, tabId) => stopFindActive(tabId));
  registerHandler('mute-tab', (event, muted) => {
    const tab = getActiveTab();
    if (!tab) return null;
    return setTabMuted(tab.id, muted);
  });
  registerHandler('mute-tab-by-id', (event, payload) => {
    assertPlainObject(payload, 'mute payload');
    return setTabMuted(payload.id, payload.muted);
  });
  registerHandler('set-zoom', (event, factor) => setActiveZoom(factor));
  registerHandler('screenshot', () => captureActivePage());
  registerHandler('print-page', () => printActivePage());
  registerHandler('save-page-pdf', () => saveActivePagePdf());
  registerHandler('open-devtools', () => {
    const tab = getActiveTab();
    if (!tab) return false;
    tab.view.webContents.openDevTools({ mode: 'detach' });
    return true;
  });
  registerHandler('open-devtools-console', () => {
    const tab = getActiveTab();
    if (!tab) return false;
    tab.view.webContents.openDevTools({ mode: 'detach', activate: true });
    return true;
  });
  registerHandler('view-page-source', () => {
    const tab = getActiveTab();
    if (!tab || !isAllowedRemoteUrl(tab.url, false)) return false;
    createTab('view-source:' + tab.url, { activate: true });
    return true;
  });
  registerHandler('launch-private-window', () => launchPrivateWindow());
  registerHandler('is-private-instance', () => privateInstance);
  registerHandler('get-history', (event, query) => queryHistory(query));
  registerHandler('clear-history', () => clearHistory());
  registerHandler('get-downloads', () => getDownloads());
  registerHandler('download-action', (event, payload) => {
    assertPlainObject(payload, 'download action');
    return downloadAction(payload.id, payload.action);
  });
  registerHandler('show-download', (event, id) => showDownload(id));
  registerHandler('open-download', (event, id) => openDownload(id));
  registerHandler('open-downloads-folder', () => openDownloadsFolder());
  registerHandler('copy-download-url', (event, id) => copyDownloadUrl(id));
  registerHandler('clear-downloads', () => clearDownloads());
  registerHandler('clear-browsing-data', (event, options) => clearBrowsingData(options));

  registerHandler('minimize-window', () => {
    mainWindow.minimize();
    return true;
  });
  registerHandler('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.restore();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  registerHandler('close-window', () => {
    mainWindow.close();
    return true;
  });
  registerHandler('toggle-fullscreen', () => toggleFullscreen());

  registerHandler('set-gaming-mode', (event, level) => setGamingMode(level));
  registerHandler('launch-gaming-window', () => ({
    success: false,
    error: 'Dedicated gaming processes were removed for safety. Use gaming mode in this window.',
  }));
  registerHandler('is-gaming-instance', () => gamingInstance);
  registerHandler('inject-pointer-lock', async () => {
    const tab = getActiveTab();
    if (!tab) return false;
    return tab.view.webContents.executeJavaScript(
      'document.documentElement.requestPointerLock ? ' +
      'document.documentElement.requestPointerLock().then(function(){return true;}).catch(function(){return false;}) : false',
      true
    );
  });
  registerHandler('clear-cache', async () => {
    await browserSession.clearCache();
    return { success: true };
  });

  registerHandler('get-bookmarks', () => {
    const bookmarks = store ? store.get('bookmarks', []) : [];
    return Array.isArray(bookmarks) ? bookmarks.slice(0, MAX_BOOKMARKS) : [];
  });
  registerHandler('save-bookmarks', (event, value) => {
    if (!Array.isArray(value) || value.length > MAX_BOOKMARKS) {
      throw new RangeError('Too many bookmarks');
    }
    const bookmarks = value.map(sanitizeBookmark);
    if (store) store.set('bookmarks', bookmarks);
    return true;
  });
  registerHandler('get-settings', () => {
    const settings = store ? store.get('settings', {}) : {};
    return isPlainObject(settings) ? settings : {};
  });
  registerHandler('save-settings', (event, value) => {
    const settings = boundedJsonClone(
      assertPlainObject(value, 'settings'),
      'settings',
      100000
    );
    if (store) store.set('settings', settings);
    return true;
  });

  registerHandler('get-24h-report', () => generate24HourWfhReport());
  registerHandler('extract-email-tasks', async () => {
    try {
      const pageContext = await extractPageContext({ maxChars: MAX_PAGE_CONTEXT });
      return extractEmailTasksFromContext(pageContext);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  registerHandler('get-workspaces', () => ({
    workspaces: workspaceList,
    activeWorkspaceId,
    activeWorkspace: getWorkspaceDetails(activeWorkspaceId),
  }));

  registerHandler('set-active-workspace', (event, workspaceId) => {
    return activateWorkspace(workspaceId);
  });

  registerHandler('add-workspace', (event, payload) => {
    assertPlainObject(payload, 'workspace details');
    const name = boundedString(payload.name, 'workspace name', 100, true);
    const icon = boundedString(payload.icon || '💼', 'workspace icon', 10, false);
    const color = boundedString(payload.color || '#3b82f6', 'workspace color', 20, false);
    const id = 'ws-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const newWs = { id, name, icon, color };
    workspaceList.push(newWs);
    activeWorkspaceId = id;
    saveWorkspaces();
    createTab('about:blank', { workspaceId: id, activate: true });
    return getBrowserState();
  });

  registerHandler('delete-workspace', (event, workspaceId) => {
    if (workspaceId === 'default') {
      throw new Error('Cannot delete the Default workspace');
    }
    const deletedActiveWorkspace = activeWorkspaceId === workspaceId;
    workspaceList = workspaceList.filter((w) => w.id !== workspaceId);
    if (deletedActiveWorkspace) {
      activeWorkspaceId = 'default';
      activeTabId = null;
    }
    for (const panel of sidebarPanels.values()) {
      const surface = panel.surfaces.get(workspaceId);
      if (surface) destroySidebarSurface(surface);
    }
    for (const [tabId, tab] of Array.from(tabs.entries())) {
      if (tab.workspaceId === workspaceId) {
        closeTab(tabId);
      }
    }
    lastActiveTabByWorkspace.delete(workspaceId);
    if (deletedActiveWorkspace || !tabs.has(activeTabId)) activateWorkspace(activeWorkspaceId);
    saveWorkspaces();
    return getBrowserState();
  });

  registerHandler('rename-workspace', (event, payload) => {
    assertPlainObject(payload, 'rename workspace payload');
    const id = boundedString(payload.id, 'workspace id', 100, false);
    const name = boundedString(payload.name, 'workspace name', 100, true);
    const found = workspaceList.find((w) => w.id === id);
    if (found) {
      found.name = name;
      saveWorkspaces();
    }
    return getBrowserState();
  });

  registerHandler('reorder-workspaces', (event, workspaceIds) => {
    if (!Array.isArray(workspaceIds)) {
      throw new TypeError('workspaceIds must be an array');
    }
    const reordered = [];
    for (const id of workspaceIds) {
      const found = workspaceList.find((w) => w.id === id);
      if (found) reordered.push(found);
    }
    for (const w of workspaceList) {
      if (!reordered.includes(w)) reordered.push(w);
    }
    workspaceList = reordered;
    saveWorkspaces();
    return getBrowserState();
  });

  registerHandler('reorder-tabs', (event, tabIds) => {
    if (!Array.isArray(tabIds)) {
      throw new TypeError('tabIds must be an array');
    }
    const reorderedTabs = new Map();
    for (const id of tabIds) {
      const numId = Number(id);
      if (tabs.has(numId)) {
        reorderedTabs.set(numId, tabs.get(numId));
      }
    }
    for (const [id, tab] of tabs.entries()) {
      if (!reorderedTabs.has(id)) {
        reorderedTabs.set(id, tab);
      }
    }
    tabs.clear();
    for (const [id, tab] of reorderedTabs) tabs.set(id, tab);
    scheduleSessionSave();
    return getBrowserState();
  });

  registerHandler('get-saved-passwords', () => publicSavedPasswords());

  registerHandler('save-password', (event, payload) => {
    saveCredential(payload);
    return publicSavedPasswords();
  });

  registerHandler('resolve-password-save-request', (event, payload) => {
    assertPlainObject(payload, 'credential prompt response');
    return resolveCredentialSavePrompt(payload.requestId, payload.decision);
  });

  // HTTP Basic Auth response — renderer sends credentials (or null to cancel).
  registerHandler('respond-http-auth', (event, payload) => {
    assertPlainObject(payload, 'http auth response');
    const entry = pendingHttpAuthCallbacks.get(payload.requestId);
    if (!entry) return;
    let username = typeof payload.username === 'string' ? payload.username.slice(0, 250) : '';
    let password = typeof payload.password === 'string' ? payload.password.slice(0, 500) : '';
    const credentialId = typeof payload.credentialId === 'string' ? payload.credentialId : '';
    if (!password && credentialId && entry.domain && entry.origin && !entry.isProxy) {
      const credential = savedPasswords.find((item) => item.id === credentialId);
      if (credential && credential.origin === entry.origin && credential.domain === entry.domain &&
          (!username || username === credential.username)) {
        username = credential.username;
        password = credential.password;
      }
    }
    completeHttpAuthRequest(payload.requestId, username, password, 'responded');
    if (password && !entry.isProxy && entry.origin) {
      setImmediate(() => {
        try {
          const tab = entry.sidebarSurface || tabs.get(entry.tabId);
          if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
            queueCredentialSavePrompt({ username, password }, { tab, origin: entry.origin });
          }
        } catch (error) {}
      });
    }
  });

  registerHandler('delete-password', (event, id) => {
    savedPasswords = savedPasswords.filter((p) => p.id !== id);
    savePasswordsToStore();
    return publicSavedPasswords();
  });

  registerHandler('autofill-credentials', (event, payload) => {
    assertPlainObject(payload, 'autofill payload');
    const tab = getActiveTab();
    if (!tab || !tab.view) return false;
    const credentialId = boundedString(payload.id, 'credential id', 200, false);
    const credential = savedPasswords.find((item) => item.id === credentialId);
    if (!credential) return false;
    let activeDomain;
    let activeOrigin;
    try {
      activeOrigin = normalizeCredentialOrigin(tab.view.webContents.getURL());
      activeDomain = normalizeCredentialDomain(activeOrigin);
    } catch (error) {
      return false;
    }
    if (credential.domain !== activeDomain) return false;
    if (credential.origin !== activeOrigin) return false;
    const username = credential.username;
    const password = credential.password;
    const code = `(function() {
      if (location.origin !== ${JSON.stringify(activeOrigin)}) return false;
      const userInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]');
      const passInputs = document.querySelectorAll('input[type="password"]');
      if (userInputs.length > 0 && ${JSON.stringify(username)}) {
        userInputs[0].value = ${JSON.stringify(username)};
        userInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        userInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (passInputs.length > 0 && ${JSON.stringify(password)}) {
        passInputs[0].value = ${JSON.stringify(password)};
        passInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        passInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    })();`;
    tab.view.webContents.executeJavaScript(code).catch(() => {});
    return true;
  });

  registerHandler('select-screen-share-source', async (event, selection) => {
    assertPlainObject(selection, 'screen share selection');
    const pending = pendingScreenShareRequest;
    if (!pending) return { success: false, error: 'The screen-share request has expired' };
    const requestId = boundedString(selection.requestId, 'screen share request id', 100, false);
    const sourceId = boundedString(selection.sourceId, 'screen share source id', 100, false);
    if (requestId !== pending.id) {
      return { success: false, error: 'The screen-share request is no longer active' };
    }
    if (pending.requestFrame.isDestroyed()) {
      completeScreenShareRequest({}, requestId);
      return { success: false, error: 'The requesting page is no longer available' };
    }

    let video = null;
    let audio = null;
    let enableLocalEcho = false;
    if (sourceId.startsWith('tab:')) {
      const tabId = Number(sourceId.slice(4));
      const tab = Number.isInteger(tabId) ? tabs.get(tabId) : null;
      if (tab && tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
        video = tab.view.webContents.mainFrame;
        if (selection.audio === true && pending.audioRequested) {
          audio = tab.view.webContents.mainFrame;
          enableLocalEcho = true;
        }
      }
    } else {
      video = pending.desktopSources.get(sourceId) || null;
      if (video && selection.audio === true && pending.audioRequested && process.platform === 'win32') {
        audio = 'loopback';
      }
    }

    if (!video) {
      return { success: false, error: 'The selected screen-share source is no longer available' };
    }
    const streams = { video };
    if (audio) streams.audio = audio;
    if (enableLocalEcho) streams.enableLocalEcho = true;
    const success = completeScreenShareRequest(streams, requestId);
    return success
      ? { success: true }
      : { success: false, error: 'The screen-share request could not be completed' };
  });

  registerHandler('cancel-screen-share', (event, requestId) => {
    if (!pendingScreenShareRequest) return { success: true, cancelled: false };
    if (requestId !== undefined && requestId !== null) {
      const expected = boundedString(requestId, 'screen share request id', 100, false);
      if (expected !== pendingScreenShareRequest.id) {
        return { success: false, error: 'The screen-share request is no longer active' };
      }
    }
    const id = pendingScreenShareRequest.id;
    return { success: completeScreenShareRequest({}, id), cancelled: true };
  });

  registerHandler('zoom-in', () => {
    const tab = getActiveTab();
    if (!tab) return null;
    const nextZoom = getNextZoomIn(tab.zoom);
    return setActiveZoom(nextZoom);
  });

  registerHandler('zoom-out', () => {
    const tab = getActiveTab();
    if (!tab) return null;
    const nextZoom = getNextZoomOut(tab.zoom);
    return setActiveZoom(nextZoom);
  });

  registerHandler('reset-zoom', () => setActiveZoom(1.0));

  registerHandler('get-site-permissions', (event, originUrl) => {
    const origin = permissionOrigin(null, null, typeof originUrl === 'string' ? originUrl : '');
    if (!origin) return { origin: '', permissions: {} };
    const permissions = ['camera', 'microphone', 'geolocation', 'notifications', 'display-capture'];
    const result = {};
    for (const perm of permissions) {
      const keys = permissionKeys(origin, perm, null);
      if (keys.some((k) => permissionGrants[k] === false)) {
        result[perm] = 'deny';
      } else if (keys.some((k) => permissionGrants[k] === true)) {
        result[perm] = 'allow';
      } else {
        result[perm] = 'ask';
      }
    }
    return { origin, permissions: result };
  });

  registerHandler('set-site-permission', (event, payload) => {
    assertPlainObject(payload, 'site permission payload');
    const { originUrl, permission, state: permState } = payload;
    const origin = permissionOrigin(null, null, typeof originUrl === 'string' ? originUrl : '');
    if (!origin) return false;
    const keys = permissionKeys(origin, permission, null);
    for (const key of keys) {
      if (permState === 'allow') {
        permissionGrants[key] = true;
      } else if (permState === 'deny') {
        permissionGrants[key] = false;
      } else {
        delete permissionGrants[key];
      }
    }
    savePermissionGrants();
    return true;
  });

  registerHandler('log-activity', (event, value) => {
    const record = sanitizeActivity(value);
    if (privateInstance) {
      return true;
    }
    const records = activityStoreRecords();
    records.push(record);
    saveActivityRecords(records);
    return true;
  });
  registerHandler('get-activity-records', (event, timeframe) =>
    filterActivityRecords(typeof timeframe === 'string' ? timeframe : 'day'));
  registerHandler('clear-activity-records', () => {
    if (!privateInstance && store) store.set('wfh_activity_records', []);
    return true;
  });

  registerHandler('get-pending-tasks', () => {
    const tasks = store ? store.get('pending_tasks', []) : [];
    return Array.isArray(tasks) ? tasks.slice(0, MAX_TASKS) : [];
  });
  registerHandler('save-pending-tasks', (event, value) => {
    if (!Array.isArray(value) || value.length > MAX_TASKS) {
      throw new RangeError('Too many tasks');
    }
    const tasks = value.map(sanitizeTask);
    if (store) store.set('pending_tasks', tasks);
    return true;
  });

  registerHandler('get-version', () => app.getVersion());
  registerHandler('get-release-notes', () => getReleaseDetails());
  registerHandler('get-update-state', () => {
    if (!updateController) setupAutoUpdater();
    return updateController.getState();
  });
  registerHandler('check-updates', () => checkForUpdates());
  registerHandler('install-update', () => installUpdate());
  registerHandler('get-focus-state', () => {
    if (!focusController) setupFocusController();
    return focusController.getState();
  });
  registerHandler('start-focus-session', (event, payload) => {
    assertPlainObject(payload, 'focus session');
    if (!focusController) setupFocusController();
    return focusController.start({
      mode: payload.mode,
      durationMinutes: payload.durationMinutes,
      intention: boundedString(payload.intention || '', 'focus intention', 240, true),
      workspaceId: activeWorkspaceId,
    });
  });
  registerHandler('pause-focus-session', () => {
    if (!focusController) setupFocusController();
    return focusController.pause();
  });
  registerHandler('resume-focus-session', () => {
    if (!focusController) setupFocusController();
    return focusController.resume();
  });
  registerHandler('cancel-focus-session', () => {
    if (!focusController) setupFocusController();
    return focusController.cancel();
  });

  registerHandler('get-memory-stats', async () => {
    const metrics = app.getAppMetrics();
    const totalMB = metrics.reduce((sum, m) => sum + (m.memory ? (m.memory.workingSetSize || 0) : 0), 0);
    return {
      totalMB: Math.round(totalMB / 1024),
      processes: metrics.length,
      backgroundTabThrottling: backgroundTabThrottlingEnabled(),
      freeSystemMB: Math.round(os.freemem() / (1024 * 1024)),
    };
  });

  registerHandler('set-background-tab-throttling', (event, enabled) => {
    if (typeof enabled !== 'boolean') throw new TypeError('Background tab throttling setting must be a boolean');
    store.set('backgroundTabThrottling', enabled);
    applyTabBackgroundThrottling();
    return enabled;
  });

  registerHandler('force-gc', async () => {
    const sessions = new Set(workspaceSessionsMap.values());
    if (browserSession) sessions.add(browserSession);
    if (whatsappSession) sessions.add(whatsappSession);
    await Promise.all(Array.from(sessions, (targetSession) => targetSession.clearCache()));
    return { success: true };
  });

  registerHandler('toggle-reading-mode', async (event, tabId) => {
    const targetId = tabId !== undefined ? boundedInteger(tabId, 'tab id', 1, Number.MAX_SAFE_INTEGER) : activeTabId;
    const tab = getTab(targetId);
    if (isNewTabUrl(tab.url) || tab.isLoading || tab.crashed) throw new Error('Reading mode requires a loaded page');
    const contents = tab.view.webContents;
    if (tab.readingModePending) return Boolean(tab.readingModeStyle);
    const documentVersion = tab.readingModeDocument;
    tab.readingModePending = true;
    try {
      let styleKey = null;
      if (tab.readingModeStyle) {
        await contents.removeInsertedCSS(tab.readingModeStyle);
      } else {
        styleKey = await contents.insertCSS(`
        body {
          max-width: 780px !important;
          margin: 40px auto !important;
          padding: 0 24px !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif !important;
          font-size: 19px !important;
          line-height: 1.75 !important;
          color: #2e3440 !important;
          background: #fbfbfc !important;
        }
        header, footer, nav, aside, .sidebar, .ad, .advertisement, [role="banner"], [role="complementary"] {
          display: none !important;
        }
        img {
          max-width: 100% !important;
          height: auto !important;
          border-radius: 8px !important;
        }
        p, li {
          margin-bottom: 1.2em !important;
        }
        `, { cssOrigin: 'user' });
      }
      if (tab.readingModeDocument === documentVersion) {
        tab.readingModeStyle = styleKey;
        emitTab('tab-update', tab);
      }
      return Boolean(tab.readingModeStyle);
    } finally {
      tab.readingModePending = false;
    }
  });

  registerHandler('detect-installed-browsers', () => detectInstalledBrowsers());

  registerHandler('import-browser-history', (event, browserName) => {
    const name = boundedString(browserName, 'browser name', 30, false).toLowerCase();
    return importBrowserHistory(name);
  });

  registerHandler('pick-and-import-passwords', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, reason: 'Browser window is unavailable' };
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Passwords (CSV)',
      filters: [
        { name: 'Password CSV Files (*.csv)', extensions: ['csv'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    return importPasswordsFromCsv(content);
  });

  registerHandler('pick-and-import-history', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, reason: 'Browser window is unavailable' };
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import History (CSV or JSON)',
      filters: [
        { name: 'History Files (*.csv, *.json, *.txt)', extensions: ['csv', 'json', 'txt'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf8');
    return importHistoryFromFile(content, ext);
  });

  registerHandler('get-system-info', () => ({
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)),
    hostname: os.hostname(),
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
  }));
  registerHandler('get-gpu-info', async () => {
    try {
      const info = await app.getGPUInfo('basic');
      const metrics = app.getAppMetrics();
      const gpu = metrics.find((metric) => metric.type === 'GPU');
      return { gpuPid: gpu ? gpu.pid : null, controllers: info.gpuDevice || [] };
    } catch (error) {
      return { gpuPid: null, controllers: [], error: error.message };
    }
  });
  registerHandler('boost-gpu-priority', () => ({
    success: true,
    applied: false,
    reason: 'Unsafe operating-system priority mutation is disabled.',
  }));

  // ── Extension Management ──
  registerHandler('get-installed-extensions', () => {
    if (!extensionManager) return [];
    return extensionManager.getInstalledExtensions();
  });
  registerHandler('get-featured-extensions', () => {
    if (!extensionManager) return [];
    return extensionManager.getFeaturedExtensions();
  });
  registerHandler('get-extension-categories', () => {
    if (!extensionManager) return [];
    return extensionManager.getCategories();
  });
  registerHandler('search-extensions', (event, query) => {
    if (!extensionManager) return [];
    return extensionManager.searchExtensions(query);
  });
  registerHandler('install-extension-from-store', async (event, extensionId) => {
    if (!extensionManager) throw new Error('Extensions not available');
    const id = boundedString(extensionId, 'extension id', 64, false);
    const result = await extensionManager.installFromWebStore(id, process.versions.chrome);
    sendToShell('extension-installed', result);
    return result;
  });
  registerHandler('install-extension-from-file', async () => {
    if (!extensionManager) throw new Error('Extensions not available');
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Install Extension',
      filters: [
        { name: 'Chrome Extensions', extensions: ['crx', 'zip'] },
      ],
      properties: ['openFile'],
    });
    if (selection.canceled || !selection.filePaths.length) {
      return { success: false, canceled: true };
    }
    const result = await extensionManager.installFromPath(selection.filePaths[0]);
    sendToShell('extension-installed', result);
    return result;
  });
  registerHandler('toggle-extension', (event, payload) => {
    if (!extensionManager) throw new Error('Extensions not available');
    assertPlainObject(payload, 'toggle extension');
    return extensionManager.toggleExtension(
      boundedString(payload.id, 'extension id', 64, false),
      Boolean(payload.enabled)
    );
  });
  registerHandler('uninstall-extension', (event, id) => {
    if (!extensionManager) throw new Error('Extensions not available');
    return extensionManager.uninstallExtension(boundedString(id, 'extension id', 64, false));
  });
  registerHandler('get-extension-popup', (event, id) => {
    if (!extensionManager) return null;
    return extensionManager.getExtensionPopup(boundedString(id, 'extension id', 64, false), getWorkspaceSession());
  });
  registerHandler('get-extension-options-url', (event, id) => {
    if (!extensionManager) return null;
    return extensionManager.getExtensionOptionsUrl(boundedString(id, 'extension id', 64, false), getWorkspaceSession());
  });

  // ── Opera-style Extension Popup Window ──
  // Creates a small frameless child BrowserWindow anchored near the toolbar icon.
  let activeExtPopup = null;
  let extensionPopupRequest = 0;
  registerHandler('open-extension-popup', async (event, payload) => {
    const parent = mainWindow;
    if (!extensionManager || !parent || parent.isDestroyed()) return { success: false, reason: 'Not ready' };
    const request = ++extensionPopupRequest;
    const extId = boundedString(payload && payload.id, 'extension id', 64, false);

    if (activeExtPopup && !activeExtPopup.isDestroyed()) activeExtPopup.destroy();

    const workspaceId = activeWorkspaceId;
    const targetSession = getWorkspaceSession(workspaceId);
    const requestIsCurrent = () => request === extensionPopupRequest && workspaceId === activeWorkspaceId && !parent.isDestroyed();
    await extensionManager.registerSession(targetSession);
    if (!requestIsCurrent()) return { success: false, canceled: true };

    const popup = extensionManager.getExtensionPopup(extId, targetSession);
    const optUrl = extensionManager.getExtensionOptionsUrl(extId, targetSession);

    // If neither popup nor options, just signal the UI to show a notification.
    if (!popup && !optUrl) {
      return { success: false, reason: 'no-popup' };
    }

    const parentBounds = parent.getBounds();
    const screenX = Number.isFinite(payload.screenX) ? Math.round(payload.screenX) : parentBounds.x;
    const screenY = Number.isFinite(payload.screenY) ? Math.round(payload.screenY) : parentBounds.y;
    const { screen } = require('electron');
    const workArea = screen.getDisplayNearestPoint({ x: screenX, y: screenY }).workArea;
    const popupWidth = Math.min(workArea.width, popup ? popup.width : 480);
    const popupHeight = Math.min(workArea.height, popup ? popup.height : 620);
    const winX = Math.max(workArea.x, Math.min(screenX, workArea.x + workArea.width - popupWidth));
    const winY = Math.max(workArea.y, Math.min(screenY + 6, workArea.y + workArea.height - popupHeight));

    let extWin;
    try {
      extWin = new BrowserWindow({
        parent,
        x: winX,
        y: winY,
        width: popupWidth,
        height: popupHeight,
        minWidth: Math.min(200, popupWidth),
        minHeight: Math.min(100, popupHeight),
        frame: false,
        titleBarStyle: 'hidden',
        show: false,
        resizable: true,
        movable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        transparent: false,
        backgroundColor: '#1a1f2e',
        hasShadow: true,
        webPreferences: {
          session: targetSession,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          allowRunningInsecureContent: false,
        },
      });

      // Auto-close on blur.
      extWin.on('blur', () => {
        if (!extWin.isDestroyed()) extWin.close();
      });
      extWin.on('closed', () => {
        if (activeExtPopup === extWin) activeExtPopup = null;
      });

      // Suppress new windows from within the popup.
      extWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

      activeExtPopup = extWin;
      await extWin.loadURL(popup ? popup.url : optUrl);
      if (!requestIsCurrent() || extWin.isDestroyed()) {
        if (!extWin.isDestroyed()) extWin.destroy();
        return { success: false, canceled: true };
      }
      extWin.show();
      return { success: true };
    } catch (err) {
      const canceled = !requestIsCurrent() || Boolean(extWin && extWin.isDestroyed());
      if (extWin && !extWin.isDestroyed()) extWin.destroy();
      if (canceled) return { success: false, canceled: true };
      return { success: false, reason: err.message };
    }
  });
}


function createMainWindow() {
  tabsVisible = false;
  shellLayoutReady = false;
  viewLayout = { ...DEFAULT_VIEW_LAYOUT };

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f7f8f5',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition: SHELL_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: true,
      safeDialogs: true,
    },
  });

  // Native accelerators run after the focused frame can preventDefault(), so
  // web editors (including those in iframes) retain their own Ctrl+F search.
  Menu.setApplicationMenu(Menu.buildFromTemplate([{
    label: 'Find in page',
    visible: false,
    accelerator: 'CommandOrControl+F',
    click: showFindForFocusedPage,
  }]));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isShellUrl(url)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = safeRemoteUrl(details.url);
    if (url) {
      setImmediate(() => createTab(url, { activate: true }));
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.on('before-input-event', (event, input) => {
    handleShortcut(event, input, activeTabId);
  });

  mainWindow.loadFile(SHELL_FILE);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
    resizeViews();
  });
  mainWindow.on('resize', resizeViews);
  mainWindow.on('maximize', resizeViews);
  mainWindow.on('unmaximize', resizeViews);
  mainWindow.on('enter-full-screen', () => {
    sendToShell('fullscreen-change', true);
    resizeViews();
  });
  mainWindow.on('leave-full-screen', () => {
    sendToShell('fullscreen-change', false);
    resizeViews();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    activeSidebarPanel = null;
    selectedSidebarSurface = null;
    shownSidebarSurface = null;
    for (const panel of sidebarPanels.values()) {
      for (const surface of panel.surfaces.values()) destroySidebarSurface(surface);
    }
  });
}

if (hasInstanceLock && !privateInstance) {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (!hasInstanceLock) return;
  store = new Store({ name: 'invictatill-data' });
  browserSession = session.fromPartition(REMOTE_PARTITION, {
    cache: true,
  });
  browserSession.setUserAgent(chromeCompatibilityUserAgent(), 'en-US,en;q=0.9');
  browserSession.setSpellCheckerEnabled(true);
  browserSession.setSpellCheckerLanguages(['en-US', 'en-GB']);
  configurePermissions(session.defaultSession);
  configureScreenSharePicker(session.defaultSession);
  configureSessionClientHints(session.defaultSession);
  configurePermissions(browserSession);
  configureDeviceSelection(browserSession);
  configureScreenSharePicker(browserSession);
  configureDownloads(browserSession);
  configureSessionClientHints(browserSession);
  loadPersistentBrowserData();
  setupFocusController();
  registerIpcHandlers();
  createMainWindow();
  restoreTabs();
  setupAutoUpdater();

  // Initialize Chrome extension support.
  if (!privateInstance) {
    extensionManager = createExtensionManager({
      store,
      chromeVersion: process.versions.chrome,
      isDev,
      onStatusChange: (status, extId) => {
        sendToShell('extension-status-changed', { status, extensionId: extId });
      },
    });
    // Register the main browser session so extensions load into it immediately.
    extensionManager.registerSession(browserSession);
    extensionManager.loadAllExtensions().catch((error) => {
      if (isDev) console.error('Extension loading error:', error);
    });

    // Register any workspace sessions that were created during tab restore
    // before the extension manager existed. Without this, extensions won't
    // work in restored tabs because the sessions are cached and never
    // registered retroactively.
    for (const sess of workspaceSessionsMap.values()) {
      if (!extensionManager.isSessionRegistered(sess)) {
        extensionManager.registerSession(sess);
      }
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null && app.isReady()) {
    createMainWindow();
    if (tabs.size === 0) restoreTabs();
    else resizeViews();
  }
});

app.on('before-quit', () => {
  completeScreenShareRequest({}, null);
  for (const pending of pendingCredentialPrompts.values()) clearTimeout(pending.timeout);
  pendingCredentialPrompts.clear();
  // Cancel any in-flight HTTP Auth requests so their responses don't hang.
  for (const requestId of Array.from(pendingHttpAuthCallbacks.keys())) {
    completeHttpAuthRequest(requestId, '', '', 'shutdown');
  }
  flushSessionState();
  for (const sess of workspaceSessionsMap.values()) {
    try {
      sess.cookies.flushStore();
    } catch (e) {}
  }
  if (browserSession) {
    try {
      browserSession.cookies.flushStore();
    } catch (e) {}
  }
  if (whatsappSession) {
    try {
      whatsappSession.cookies.flushStore();
    } catch (e) {}
  }
  if (historySaveTimer && !privateInstance && store) {
    clearTimeout(historySaveTimer);
    store.set('browser_history_v2', historyRecords.slice(-MAX_HISTORY));
  }
  if (downloadsSaveTimer && !privateInstance && store) {
    clearTimeout(downloadsSaveTimer);
    store.set('browser_downloads_v2', downloadRecords.slice(-MAX_DOWNLOADS));
  }
  if (focusController) focusController.dispose();
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
  powerBlockerId = null;
});

app.on('window-all-closed', () => {
  app.quit();
});

// Offer the same explicit certificate choices a full browser provides. Invalid
// certificates are never trusted silently and every bypass lasts for one request.
app.on('certificate-error', (event, webContents, url, error, certificate, callback, isMainFrame) => {
  if (!isMainFrame || !tabForRemoteContents(webContents)) return;
  event.preventDefault();
  let host = url;
  try { host = new URL(url).hostname; } catch (parseError) {}
  const issuer = certificate && certificate.issuerName ? certificate.issuerName : 'Unknown issuer';
  const options = {
    type: 'warning',
    title: 'Your connection is not private',
    message: 'Chromium could not verify the identity of ' + host + '.',
    detail: String(error || 'Certificate verification failed') + '\nIssuer: ' + issuer +
      '\n\nContinue only if you understand the risk.',
    buttons: ['Go back', 'Continue (unsafe)'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  };
  const prompt = mainWindow && !mainWindow.isDestroyed()
    ? dialog.showMessageBox(mainWindow, options)
    : dialog.showMessageBox(options);
  prompt.then((response) => callback(response.response === 1)).catch(() => callback(false));
});

app.on('select-client-certificate', (event, webContents, url, certificateList, callback) => {
  if (!tabForRemoteContents(webContents)) return;
  event.preventDefault();
  const certificates = Array.isArray(certificateList) ? certificateList.slice(0, 8) : [];
  if (certificates.length <= 1) {
    callback(certificates[0]);
    return;
  }
  const buttons = certificates.map((certificate) =>
    String(certificate.subjectName || certificate.issuerName || 'Client certificate').slice(0, 100)
  );
  buttons.push('Cancel');
  const options = {
    type: 'question',
    title: 'Choose a client certificate',
    message: 'Choose a certificate for ' + String(url).slice(0, 300),
    detail: 'The selected certificate will be shared with this site for authentication.',
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    noLink: true,
  };
  const prompt = mainWindow && !mainWindow.isDestroyed()
    ? dialog.showMessageBox(mainWindow, options)
    : dialog.showMessageBox(options);
  prompt.then((response) => {
    callback(response.response < certificates.length ? certificates[response.response] : undefined);
  }).catch(() => callback());
});

// ═══════════════════════════════════════════════════════════════════
// HTTP Basic Authentication — intercept 401 challenges and show a
// custom in-app credentials dialog instead of letting Electron
// auto-cancel the request (which produces a raw 401 page).
// ═══════════════════════════════════════════════════════════════════
app.on('login', (event, _webContents, _details, authInfo, callback) => {
  // MUST call preventDefault() or Electron will immediately cancel the request.
  event.preventDefault();

  const requestingTab = tabForRemoteContents(_webContents);
  if (!requestingTab) {
    try { callback(); } catch (error) {}
    return;
  }
  const sidebarSurface = requestingTab.panel ? requestingTab : null;
  if (!sidebarSurface) resizeTabViewToCurrentLayout(requestingTab);

  const requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

  // Safety net: auto-cancel after 5 minutes so the callback is never left dangling.
  const timeout = setTimeout(() => {
    completeHttpAuthRequest(requestId, '', '', 'timeout');
  }, 5 * 60 * 1000);

  let origin = '';
  let domain = '';
  try {
    const requestUrl = _details && typeof _details.url === 'string' ? _details.url : '';
    // A proxy challenge authenticates to the proxy, never to the requested
    // website. Missing request URLs also cannot establish a credential origin.
    if (!authInfo.isProxy && requestUrl) {
      origin = normalizeCredentialOrigin(requestUrl);
      domain = normalizeCredentialDomain(origin);
    }
  } catch (error) {}
  const savedCredential = origin && secureStorageAvailable()
    ? latestSavedCredential(origin)
    : null;

  pendingHttpAuthCallbacks.set(requestId, {
    callback,
    timeout,
    tabId: requestingTab.id,
    sidebarSurface,
    contentsId: _webContents.id,
    origin,
    domain,
    isProxy: Boolean(authInfo.isProxy),
  });

  sendToShell('http-auth-request', {
    requestId,
    tabId: sidebarSurface ? null : requestingTab.id,
    ...(sidebarSurface ? { sidebarId: sidebarSurface.panel.id, workspaceId: sidebarSurface.workspaceId } : {}),
    host: authInfo.host || '',
    port: authInfo.port || 0,
    realm: authInfo.realm || '',
    scheme: authInfo.scheme || 'basic',
    isProxy: Boolean(authInfo.isProxy),
    savedCredentialId: savedCredential ? savedCredential.id : '',
    savedUsername: savedCredential ? savedCredential.username : '',
  });
  resizeViews();
});
