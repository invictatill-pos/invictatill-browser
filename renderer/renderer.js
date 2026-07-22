'use strict';

const api = window.electronAPI || {};
const $ = function (id) { return document.getElementById(id); };

const els = {
  browserChrome: $('browser-chrome'),
  tabsContainer: $('tabs-container'),
  addressBar: $('address-bar'),
  omnibox: $('omnibox-shell'),
  newTabPage: $('new-tab-page'),
  pageError: $('page-error'),
  pageErrorTitle: $('page-error-title'),
  pageErrorMessage: $('page-error-message'),
  securityIndicator: $('security-indicator'),
  securityIcon: $('security-icon'),
  securityText: $('security-text'),
  bookmarkButton: $('btn-bookmark-star'),
  backButton: $('btn-back'),
  forwardButton: $('btn-forward'),
  reloadButton: $('btn-reload'),
  muteButton: $('btn-mute'),
  muteIcon: $('mute-icon'),
  splitButton: $('btn-split-screen'),
  aiButton: $('btn-ai-drawer'),
  drawer: $('workspace-drawer'),
  drawerClose: $('btn-close-drawer'),
  menuButton: $('btn-menu'),
  menu: $('browser-menu'),
  findBar: $('find-bar'),
  findInput: $('find-input'),
  findResults: $('find-results'),
  notificationStack: $('notification-stack'),
  modeBadgeText: $('mode-badge-text'),
  titlebarStatus: $('titlebar-status'),
  bookmarksGrid: $('bookmarks-grid'),
  bookmarksEmpty: $('bookmarks-empty'),
  recentList: $('recent-list'),
  recentEmpty: $('recent-empty'),
  taskList: $('pending-tasks-list'),
  tasksEmpty: $('tasks-empty'),
  taskBadge: $('task-badge-count'),
  taskSummary: $('task-summary'),
  historyList: $('history-list'),
  historyEmpty: $('history-empty'),
  historySearch: $('history-search'),
  downloadsList: $('downloads-list'),
  downloadsEmpty: $('downloads-empty'),
  downloadsSummary: $('downloads-summary'),
  downloadBadge: $('download-badge-count'),
  aiMessages: $('ai-chat-messages'),
  aiInput: $('ai-chat-input'),
  aiSend: $('btn-send-ai'),
  aiStop: $('btn-stop-ai'),
  aiStatus: $('ai-composer-status'),
  aiContext: $('ai-context-toggle'),
  aiContextNote: $('ai-context-note'),
  aiProviderBadge: $('ai-provider-badge'),
  updateBanner: $('update-banner'),
  updateTitle: $('update-banner-title'),
  updateSub: $('update-banner-sub'),
  updateProgress: $('update-progress'),
  installUpdateButton: $('btn-install-update'),
  updateModalBackdrop: $('update-modal-backdrop'),
  updateModal: $('update-modal'),
  modalVersion: $('modal-version-label'),
  modalTitle: $('modal-release-title'),
  modalIntro: $('modal-release-intro'),
  modalFeatures: $('modal-feature-list'),
  modalFixes: $('modal-bug-list'),
  modalInstall: $('btn-modal-install'),
  zoomDisplay: $('zoom-display'),
  siteInfoModalBackdrop: $('site-info-modal-backdrop'),
  siteInfoModal: $('site-info-modal'),
  siteInfoOrigin: $('site-info-origin'),
  siteInfoSecurityDetails: $('site-info-security-details'),
  sitePermissionsList: $('site-permissions-list'),
  btnCloseSiteInfo: $('btn-close-site-info'),
  btnCloseSiteInfoDone: $('btn-close-site-info-done'),
  btnResetSitePermissions: $('btn-reset-site-permissions'),
  btnZoomOut: $('btn-zoom-out'),
  btnZoomIn: $('btn-zoom-in'),
  btnZoomReset: $('btn-zoom-reset'),
  workspaceTabsStrip: $('workspace-tabs-strip'),
  workspaceTabsContainer: $('workspace-tabs-container'),
  btnAddWorkspaceOpen: $('btn-add-workspace-open'),
  addWorkspaceModalBackdrop: $('add-workspace-modal-backdrop'),
  addWorkspaceModal: $('add-workspace-modal'),
  btnCloseAddWs: $('btn-close-add-ws'),
  btnCancelAddWs: $('btn-cancel-add-ws'),
  addWorkspaceForm: $('add-workspace-form'),
  wsInputName: $('ws-input-name'),
  wsIconPicker: $('ws-icon-picker'),
  wsColorPicker: $('ws-color-picker'),
};

const state = {
  tabs: [],
  activeTabId: null,
  closedTabCount: 0,
  splitScreen: false,
  secondaryTabId: null,
  zoomFactor: 1,
  isPrivate: false,
  workspaces: [],
  activeWorkspaceId: 'default',
  selectedWsIcon: '🏢',
  selectedWsColor: '#3b82f6',
  engineMode: 'workspace',
  drawerOpen: false,
  menuOpen: false,
  findOpen: false,
  modalOpen: false,
  lastViewVisible: null,
  lastLayoutKey: '',
  isFullscreen: false,
  bookmarks: [],
  tasks: [],
  history: [],
  downloads: [],
  historyRange: 'day',
  historyQuery: '',
  settings: {
    searchEngine: 'google',
    homepage: '',
    restoreSession: true,
    activityTracking: false
  },
  aiConfig: {
    provider: 'local',
    endpoint: '',
    model: ''
  },
  aiBusy: false,
  aiRequestId: 0,
  activeAiRequestId: null,
  lastAiRequest: null,
  updateReady: false,
  updateBannerVisible: false,
  previousModalFocus: null,
  activityTimer: null
};

function createElement(tag, className, textValue) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textValue !== undefined && textValue !== null) node.textContent = String(textValue);
  return node;
}

function clearNode(node) {
  if (node) node.replaceChildren();
}

function setHidden(node, hidden) {
  if (!node) return;
  node.classList.toggle('hidden', Boolean(hidden));
  if (hidden) node.setAttribute('hidden', '');
  else node.removeAttribute('hidden');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function idKey(id) {
  return String(id === undefined || id === null ? '' : id);
}

function sameId(a, b) {
  return idKey(a) === idKey(b);
}

function activeTab() {
  return state.tabs.find(function (tab) { return sameId(tab.id, state.activeTabId); }) || null;
}

function tabFromPayload(payload) {
  if (!payload) return null;
  return payload.tab && typeof payload.tab === 'object' ? payload.tab : payload;
}

function errorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || error.error || 'Unknown error';
}

async function invoke(name) {
  const args = Array.prototype.slice.call(arguments, 1);
  if (typeof api[name] !== 'function') throw new Error('Browser capability unavailable: ' + name);
  return api[name].apply(api, args);
}

async function invokeOptional(name) {
  const args = Array.prototype.slice.call(arguments, 1);
  if (typeof api[name] !== 'function') return undefined;
  return api[name].apply(api, args);
}

async function invokeFirst(names) {
  const args = Array.prototype.slice.call(arguments, 1);
  for (let index = 0; index < names.length; index += 1) {
    if (typeof api[names[index]] === 'function') {
      return api[names[index]].apply(api, args);
    }
  }
  return undefined;
}

function notify(message, type, duration) {
  if (!els.notificationStack) return;
  clearNode(els.notificationStack);
  const item = createElement('div', 'notification ' + (type || 'info'));
  const dot = createElement('span', 'notification-dot');
  dot.setAttribute('aria-hidden', 'true');
  const copy = createElement('span', '', message);
  item.append(dot, copy);
  els.notificationStack.appendChild(item);
  window.setTimeout(function () {
    item.remove();
  }, duration || 3200);
}

function setTitleStatus(message) {
  if (els.titlebarStatus) els.titlebarStatus.textContent = message || '';
}

function isNewTabUrl(url) {
  const value = String(url || '').trim().toLowerCase();
  return !value || value === 'about:blank' || value === 'invicta://newtab' || value === 'invictatill://newtab';
}

function isSafeFavicon(url) {
  if (!url) return false;
  return /^(https?:|data:image\/|blob:)/i.test(String(url));
}

function displayHostForTab(tab) {
  const crashed = Boolean(tab && (tab.crashed || tab.status === 'crashed' || tab.discardedReason === 'crashed'));
  const showNewTab = !tab || isNewTabUrl(tab.url);
  setHidden(els.newTabPage, !showNewTab);
  setHidden(els.pageError, !crashed);
  if (crashed) {
    els.pageErrorTitle.textContent = 'This tab stopped responding';
    els.pageErrorMessage.textContent = 'Reload ' + (tab.title || 'this page') + ' or open a fresh tab.';
  }
}

function shouldShowPageView() {
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url)) return false;
  if (tab.crashed || tab.status === 'crashed') return false;
  if (state.modalOpen) return false;
  if (state.menuOpen && window.innerWidth <= 600) return false;
  if (state.drawerOpen && window.innerWidth <= 720) return false;
  return true;
}

function updateViewLayout() {
  if (!els.browserChrome) return;
  const chromeRect = els.browserChrome.getBoundingClientRect();
  let right = 0;
  if (state.drawerOpen && window.innerWidth > 720 && els.drawer) {
    right = Math.ceil(els.drawer.getBoundingClientRect().width);
  }
  if (state.menuOpen && window.innerWidth > 600) right = Math.max(right, 304);
  let bottom = 0;
  if (state.updateBannerVisible && els.updateBanner) {
    bottom = Math.ceil(els.updateBanner.getBoundingClientRect().height + 30);
  }
  const layout = {
    top: Math.max(0, Math.ceil(chromeRect.bottom)),
    right: Math.max(0, right),
    bottom: Math.max(0, bottom)
  };
  const layoutKey = layout.top + ':' + layout.right + ':' + layout.bottom;
  if (layoutKey !== state.lastLayoutKey) {
    state.lastLayoutKey = layoutKey;
    invokeOptional('setViewLayout', layout).catch(function () {});
  }
  const visible = shouldShowPageView();
  if (visible !== state.lastViewVisible) {
    state.lastViewVisible = visible;
    invokeOptional('setViewVisible', visible).catch(function () {});
  }
}

let resizeFrame = 0;
function scheduleLayout() {
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(function () {
    resizeFrame = 0;
    updateViewLayout();
  });
}

function setMode(mode) {
  const validMode = mode === 'private' || mode === 'gaming' ? mode : 'workspace';
  document.body.classList.remove('mode-workspace', 'mode-private', 'mode-gaming');
  document.body.classList.add('mode-' + validMode);
  document.body.dataset.engineMode = validMode;
  document.body.dataset.private = validMode === 'private' ? 'true' : 'false';
  if (els.modeBadgeText) {
    els.modeBadgeText.textContent = validMode === 'private' ? 'Private' : validMode === 'gaming' ? 'Gaming' : 'Workspace';
  }
}

function normalizeTab(raw) {
  const tab = raw && typeof raw === 'object' ? raw : {};
  return {
    id: tab.id,
    title: String(tab.title || (isNewTabUrl(tab.url) ? 'New tab' : tab.url || 'New tab')),
    url: String(tab.url || 'about:blank'),
    favicon: tab.favicon || tab.favIcon || tab.faviconUrl || '',
    loading: Boolean(tab.loading || tab.isLoading),
    audible: Boolean(tab.audible || tab.isAudible),
    muted: Boolean(tab.muted || tab.isMuted),
    crashed: Boolean(tab.crashed || tab.status === 'crashed'),
    canGoBack: Boolean(tab.canGoBack),
    canGoForward: Boolean(tab.canGoForward),
    workspaceId: tab.workspaceId || 'default',
    workspaceName: tab.workspaceName || 'Default',
    workspaceIcon: tab.workspaceIcon || '🌐',
    workspaceColor: tab.workspaceColor || '#6366f1',
    active: Boolean(tab.active),
    status: tab.status || ''
  };
}

function applyBrowserState(browserState) {
  const next = browserState && typeof browserState === 'object' ? browserState : {};
  const rawTabs = Array.isArray(next.tabs) ? next.tabs : [];
  state.tabs = rawTabs.map(normalizeTab);
  let activeId = next.activeTabId;
  if (activeId === undefined || activeId === null) {
    const marked = state.tabs.find(function (tab) { return tab.active; });
    activeId = marked ? marked.id : state.tabs.length ? state.tabs[0].id : null;
  }
  state.activeTabId = activeId;
  state.closedTabCount = Number(next.closedTabCount || 0);
  state.splitScreen = Boolean(next.splitScreen && (next.splitScreen.enabled !== false));
  state.secondaryTabId = next.secondaryTabId || (next.splitScreen && next.splitScreen.secondaryTabId) || null;
  if (Number.isFinite(Number(next.zoomFactor))) state.zoomFactor = Number(next.zoomFactor);
  state.isPrivate = Boolean(next.isPrivate);
  state.engineMode = next.engineMode === 'gaming' ? 'gaming' : 'workspace';
  if (Array.isArray(next.workspaces)) state.workspaces = next.workspaces;
  if (next.activeWorkspaceId) state.activeWorkspaceId = next.activeWorkspaceId;
  setMode(state.isPrivate ? 'private' : state.engineMode);
  renderWorkspaces();
  renderTabs();
  renderBrowserControls();
}

async function refreshBrowserState() {
  try {
    const browserState = await invoke('getBrowserState');
    applyBrowserState(browserState);
  } catch (error) {
    setTitleStatus('Browser connection unavailable');
    notify(errorMessage(error), 'error', 5000);
    if (!state.tabs.length) {
      state.tabs = [normalizeTab({ id: 'local-new-tab', title: 'New tab', url: 'about:blank', active: true })];
      state.activeTabId = 'local-new-tab';
      renderTabs();
      renderBrowserControls();
    }
  }
}

function upsertTab(rawTab) {
  if (!rawTab || rawTab.id === undefined || rawTab.id === null) return;
  const tab = normalizeTab(rawTab);
  const index = state.tabs.findIndex(function (item) { return sameId(item.id, tab.id); });
  if (index >= 0) state.tabs[index] = Object.assign({}, state.tabs[index], tab);
  else state.tabs.push(tab);
  if (rawTab.active) state.activeTabId = rawTab.id;
  renderTabs();
  renderBrowserControls();
}

function tabButtonLabel(tab) {
  let label = tab.muted ? 'Unmute ' : 'Mute ';
  label += tab.title || 'tab';
  return label;
}

function focusAdjacentTab(currentId, direction) {
  if (!state.tabs.length) return;
  const index = state.tabs.findIndex(function (tab) { return sameId(tab.id, currentId); });
  const targetIndex = (index + direction + state.tabs.length) % state.tabs.length;
  const target = document.querySelector('[role="tab"][data-tab-id="' + CSS.escape(idKey(state.tabs[targetIndex].id)) + '"]');
  if (target) target.focus();
}

function renderTabs() {
  if (!els.tabsContainer) return;
  clearNode(els.tabsContainer);
  state.tabs.forEach(function (tab) {
    const selected = sameId(tab.id, state.activeTabId);
    const item = createElement('div', 'tab-item');
    item.dataset.tabId = idKey(tab.id);
    item.setAttribute('role', 'presentation');
    item.classList.toggle('active', selected);
    if (tab.loading) item.classList.add('loading');
    if (tab.crashed) item.classList.add('crashed');

    const selectButton = createElement('button', 'tab-select');
    selectButton.type = 'button';
    selectButton.dataset.tabId = idKey(tab.id);
    selectButton.id = 'browser-tab-' + idKey(tab.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    selectButton.setAttribute('role', 'tab');
    selectButton.setAttribute('aria-selected', selected ? 'true' : 'false');
    selectButton.setAttribute('aria-controls', 'browser-stage');
    selectButton.setAttribute('title', tab.title);
    selectButton.tabIndex = selected ? 0 : -1;

    const faviconWrap = createElement('span', 'tab-favicon-wrap');
    if (isSafeFavicon(tab.favicon)) {
      const favicon = createElement('img', 'tab-favicon');
      favicon.src = String(tab.favicon);
      favicon.alt = '';
      favicon.referrerPolicy = 'no-referrer';
      favicon.addEventListener('error', function () {
        favicon.remove();
        if (!faviconWrap.querySelector('.tab-fallback-icon')) {
          faviconWrap.appendChild(createElement('span', 'tab-fallback-icon', tab.crashed ? '!' : '◌'));
        }
      });
      faviconWrap.appendChild(favicon);
    } else {
      faviconWrap.appendChild(createElement('span', 'tab-fallback-icon', tab.crashed ? '!' : '◌'));
    }

    const title = createElement('span', 'tab-title', tab.title);
    const audioButton = createElement('button', 'tab-state-button', tab.muted ? '🔇' : '🔊');
    audioButton.type = 'button';
    audioButton.classList.toggle('audible', tab.audible);
    audioButton.classList.toggle('muted', tab.muted);
    audioButton.setAttribute('aria-label', tabButtonLabel(tab));
    audioButton.setAttribute('aria-pressed', tab.muted ? 'true' : 'false');
    audioButton.title = tabButtonLabel(tab);
    audioButton.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleMute(tab.id, !tab.muted);
    });

    const closeButton = createElement('button', 'tab-close-button', '✕');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close ' + tab.title);
    closeButton.title = 'Close tab';
    closeButton.addEventListener('click', function (event) {
      event.stopPropagation();
      closeTab(tab.id);
    });

    if (tab.workspaceColor) {
      const wsDot = createElement('span', 'tab-ws-dot');
      wsDot.style.background = tab.workspaceColor;
      wsDot.title = 'Workspace: ' + (tab.workspaceName || 'Default');
      selectButton.prepend(wsDot);
    }
    selectButton.append(faviconWrap, title);
    item.append(selectButton, audioButton, closeButton);
    selectButton.addEventListener('click', function () { switchTab(tab.id); });
    selectButton.addEventListener('auxclick', function (event) {
      if (event.button === 1) {
        event.preventDefault();
        closeTab(tab.id);
      }
    });
    selectButton.addEventListener('dblclick', function () {
      duplicateTab(tab.id);
    });
    selectButton.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        switchTab(tab.id);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        focusAdjacentTab(tab.id, -1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        focusAdjacentTab(tab.id, 1);
      } else if (event.key === 'Delete') {
        event.preventDefault();
        closeTab(tab.id);
      } else if (event.key === 'Home') {
        event.preventDefault();
        const first = els.tabsContainer.querySelector('[role="tab"]');
        if (first) first.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        const allTabs = els.tabsContainer.querySelectorAll('[role="tab"]');
        if (allTabs.length) allTabs[allTabs.length - 1].focus();
      }
    });
    els.tabsContainer.appendChild(item);
    if (selected) {
      window.requestAnimationFrame(function () {
        item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }
  });
  const reopen = $('btn-reopen-tab');
  if (reopen) reopen.disabled = state.closedTabCount <= 0;
  const menuReopen = $('menu-reopen-tab');
  if (menuReopen) menuReopen.disabled = state.closedTabCount <= 0;
}

function renderBrowserControls() {
  const tab = activeTab();
  const hasPage = Boolean(tab && !isNewTabUrl(tab.url));
  displayHostForTab(tab);
  if (els.addressBar && document.activeElement !== els.addressBar) {
    els.addressBar.value = tab && !isNewTabUrl(tab.url) ? tab.url : '';
  }
  if (els.btnZoomReset) {
    const zoomPct = Math.round((state.zoomFactor || 1) * 100) + '%';
    els.btnZoomReset.textContent = zoomPct;
  }
  els.backButton.disabled = !(tab && tab.canGoBack);
  els.forwardButton.disabled = !(tab && tab.canGoForward);
  els.reloadButton.classList.toggle('loading', Boolean(tab && tab.loading));
  els.reloadButton.disabled = !tab;
  els.reloadButton.setAttribute('aria-label', tab && tab.loading ? 'Stop loading' : 'Reload page');
  els.reloadButton.title = tab && tab.loading ? 'Stop loading (Esc)' : 'Reload (Ctrl+R)';
  const muted = Boolean(tab && tab.muted);
  els.muteButton.disabled = !hasPage;
  els.muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
  els.muteButton.setAttribute('aria-label', muted ? 'Unmute current tab' : 'Mute current tab');
  els.muteIcon.textContent = muted ? '🔇' : '🔊';
  els.splitButton.setAttribute('aria-pressed', state.splitScreen ? 'true' : 'false');
  els.splitButton.disabled = !state.splitScreen && state.tabs.filter(function (item) { return !isNewTabUrl(item.url); }).length < 2;
  $('btn-screenshot').disabled = !hasPage;
  $('menu-duplicate-tab').disabled = !tab;
  $('menu-print').disabled = !hasPage;
  $('menu-save-pdf').disabled = !hasPage;
  $('menu-devtools').disabled = !hasPage;
  $('btn-print-page').disabled = !hasPage;
  $('btn-save-pdf').disabled = !hasPage;
  updateSecurityIndicator(tab ? tab.url : '');
  updateBookmarkButton();
  updateZoomDisplay();
  setTitleStatus(tab && tab.loading ? 'Loading ' + tab.title : '');
  scheduleLayout();
}

function updateSecurityIndicator(url) {
  const indicator = els.securityIndicator;
  indicator.classList.remove('secure', 'insecure', 'danger');
  if (isNewTabUrl(url)) {
    els.securityIcon.textContent = '⌂';
    els.securityText.textContent = 'New tab';
    indicator.title = 'InvictaTill new tab';
    return;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      indicator.classList.add('secure');
      els.securityIcon.textContent = '🔒';
      els.securityText.textContent = 'HTTPS';
      indicator.title = 'This page uses HTTPS: ' + parsed.hostname + ' (Click for site permissions)';
    } else if (parsed.protocol === 'http:') {
      indicator.classList.add('insecure');
      els.securityIcon.textContent = '⚠';
      els.securityText.textContent = 'Not secure';
      indicator.title = 'This page does not use HTTPS (Click for site permissions)';
    } else if (parsed.protocol === 'file:') {
      els.securityIcon.textContent = '▣';
      els.securityText.textContent = 'Local file';
      indicator.title = 'Local file';
    } else {
      els.securityIcon.textContent = 'ⓘ';
      els.securityText.textContent = parsed.protocol.replace(':', '') || 'Page';
      indicator.title = 'Page information';
    }
  } catch (error) {
    indicator.classList.add('danger');
    els.securityIcon.textContent = '!';
    els.securityText.textContent = 'Invalid';
    indicator.title = 'Invalid address';
  }
}

const PERM_METADATA = [
  { key: 'camera', label: 'Camera', icon: '📷' },
  { key: 'microphone', label: 'Microphone', icon: '🎙️' },
  { key: 'geolocation', label: 'Location', icon: '📍' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'display-capture', label: 'Screen sharing', icon: '🖥️' }
];

async function openSiteInfoModal() {
  const tab = activeTab();
  if (!tab || !tab.url || isNewTabUrl(tab.url)) return;
  let origin = '';
  let protocol = '';
  try {
    const parsed = new URL(tab.url);
    origin = parsed.origin;
    protocol = parsed.protocol;
  } catch (error) {
    return;
  }

  els.siteInfoOrigin.textContent = origin;
  if (protocol === 'https:') {
    els.siteInfoSecurityDetails.textContent = '🔒 Connection is secure. Your information (for example, passwords or camera access) is private when sent to this site.';
  } else if (protocol === 'http:') {
    els.siteInfoSecurityDetails.textContent = '⚠ Connection is not secure. You should not enter sensitive information on this site.';
  } else {
    els.siteInfoSecurityDetails.textContent = 'ⓘ Internal or local system address.';
  }

  clearNode(els.sitePermissionsList);

  let siteData = { origin, permissions: {} };
  try {
    if (typeof api.getSitePermissions === 'function') {
      siteData = await api.getSitePermissions(tab.url);
    }
  } catch (error) {}

  PERM_METADATA.forEach(function (perm) {
    const row = createElement('div', 'perm-row');
    const labelBox = createElement('div', 'perm-label');
    labelBox.append(
      createElement('span', 'perm-icon', perm.icon),
      createElement('span', '', perm.label)
    );

    const select = createElement('select', 'perm-select');
    select.dataset.permKey = perm.key;
    const currentState = siteData && siteData.permissions ? (siteData.permissions[perm.key] || 'ask') : 'ask';

    const optAsk = createElement('option', '', 'Ask (default)');
    optAsk.value = 'ask';
    const optAllow = createElement('option', '', 'Allow');
    optAllow.value = 'allow';
    const optDeny = createElement('option', '', 'Deny');
    optDeny.value = 'deny';

    if (currentState === 'allow') optAllow.selected = true;
    else if (currentState === 'deny') optDeny.selected = true;
    else optAsk.selected = true;

    select.append(optAsk, optAllow, optDeny);
    select.addEventListener('change', async function () {
      try {
        if (typeof api.setSitePermission === 'function') {
          await api.setSitePermission(tab.url, perm.key, select.value);
          notify(perm.label + ' set to ' + select.value + ' for ' + origin, 'success', 3000);
        }
      } catch (err) {
        notify('Failed to update permission: ' + errorMessage(err), 'error');
      }
    });

    row.append(labelBox, select);
    els.sitePermissionsList.appendChild(row);
  });

  setHidden(els.siteInfoModalBackdrop, false);
  state.modalOpen = true;
  scheduleLayout();
}

function closeSiteInfoModal() {
  setHidden(els.siteInfoModalBackdrop, true);
  state.modalOpen = false;
  scheduleLayout();
}

function renderWorkspaces() {
  if (!els.workspaceTabsContainer) return;
  const ws = state.workspaces && state.workspaces.length > 0 ? state.workspaces : [
    { id: 'default', name: 'Default', icon: '🌐', color: '#6366f1' },
    { id: 'work', name: 'Work', icon: '🏢', color: '#3b82f6' },
    { id: 'personal', name: 'Personal', icon: '🏠', color: '#10b981' }
  ];
  const activeWsId = state.activeWorkspaceId || ws[0].id;

  clearNode(els.workspaceTabsContainer);
  ws.forEach(function (w) {
    const pill = createElement('button', 'ws-tab-pill');
    pill.type = 'button';
    pill.setAttribute('role', 'tab');
    if (w.id === activeWsId) pill.classList.add('active');

    const dot = createElement('span', 'ws-dot');
    dot.style.background = w.color || '#6366f1';

    const text = createElement('span', '', (w.icon || '🌐') + ' ' + w.name);
    pill.append(dot, text);

    if (w.id !== 'default') {
      const closeBtn = createElement('button', 'ws-tab-close', '✕');
      closeBtn.type = 'button';
      closeBtn.title = 'Close workspace ' + w.name;
      closeBtn.addEventListener('click', async function (event) {
        event.stopPropagation();
        try {
          if (typeof api.deleteWorkspace === 'function') {
            const res = await api.deleteWorkspace(w.id);
            applyBrowserState(res);
            notify('Closed workspace: ' + w.name, 'info', 3000);
          }
        } catch (err) {
          notify('Could not close workspace: ' + errorMessage(err), 'error');
        }
      });
      pill.appendChild(closeBtn);
    }

    pill.addEventListener('click', async function () {
      if (w.id === activeWsId) return;
      try {
        if (typeof api.setActiveWorkspace === 'function') {
          const res = await api.setActiveWorkspace(w.id);
          applyBrowserState(res);
          notify('Switched to workspace: ' + w.name, 'success', 2500);
        }
      } catch (err) {
        notify('Failed to switch workspace: ' + errorMessage(err), 'error');
      }
    });

    els.workspaceTabsContainer.appendChild(pill);
  });
}

function openAddWorkspaceModal() {
  if (els.wsInputName) els.wsInputName.value = '';
  state.selectedWsIcon = '🏢';
  state.selectedWsColor = '#3b82f6';

  if (els.wsIconPicker) {
    els.wsIconPicker.querySelectorAll('.ws-icon-opt').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.icon === state.selectedWsIcon);
    });
  }
  if (els.wsColorPicker) {
    els.wsColorPicker.querySelectorAll('.ws-color-opt').forEach(function (btn) {
      btn.style.borderColor = btn.dataset.color === state.selectedWsColor ? '#fff' : 'transparent';
    });
  }

  setHidden(els.addWorkspaceModalBackdrop, false);
  state.modalOpen = true;
  scheduleLayout();
}

function closeAddWorkspaceModal() {
  setHidden(els.addWorkspaceModalBackdrop, true);
  state.modalOpen = false;
  scheduleLayout();
}

async function handleAddWorkspaceSubmit(event) {
  event.preventDefault();
  const name = els.wsInputName ? els.wsInputName.value.trim() : '';
  if (!name) return;

  try {
    if (typeof api.addWorkspace === 'function') {
      const res = await api.addWorkspace({
        name,
        icon: state.selectedWsIcon,
        color: state.selectedWsColor
      });
      closeAddWorkspaceModal();
      applyBrowserState(res);
      notify('Created workspace: ' + name + '! New tabs will use this session.', 'success', 4000);
    }
  } catch (err) {
    notify('Failed to create workspace: ' + errorMessage(err), 'error');
  }
}

async function zoomIn() {
  try {
    if (typeof api.zoomIn === 'function') {
      const res = await api.zoomIn();
      if (res && res.zoom) {
        state.zoomFactor = res.zoom;
        renderBrowserControls();
      }
    } else {
      setZoom(state.zoomFactor + 0.1);
    }
  } catch (err) {
    setZoom(state.zoomFactor + 0.1);
  }
}

async function zoomOut() {
  try {
    if (typeof api.zoomOut === 'function') {
      const res = await api.zoomOut();
      if (res && res.zoom) {
        state.zoomFactor = res.zoom;
        renderBrowserControls();
      }
    } else {
      setZoom(state.zoomFactor - 0.1);
    }
  } catch (err) {
    setZoom(state.zoomFactor - 0.1);
  }
}

async function resetZoom() {
  try {
    if (typeof api.resetZoom === 'function') {
      const res = await api.resetZoom();
      if (res && res.zoom) {
        state.zoomFactor = res.zoom;
        renderBrowserControls();
      }
    } else {
      setZoom(1.0);
    }
  } catch (err) {
    setZoom(1.0);
  }
}

async function resetSitePermissions() {
  const tab = activeTab();
  if (!tab || !tab.url) return;
  try {
    for (const perm of PERM_METADATA) {
      if (typeof api.setSitePermission === 'function') {
        await api.setSitePermission(tab.url, perm.key, 'ask');
      }
    }
    notify('Reset all site permissions', 'info', 3000);
    await openSiteInfoModal();
  } catch (error) {
    notify('Failed to reset permissions: ' + errorMessage(error), 'error');
  }
}

function searchUrl(query) {
  const encoded = encodeURIComponent(query);
  const engines = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    brave: 'https://search.brave.com/search?q='
  };
  return (engines[state.settings.searchEngine] || engines.google) + encoded;
}

function normalizeNavigationInput(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return 'about:blank';
  if (isNewTabUrl(value)) return 'about:blank';
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i);
  const allowed = ['http', 'https'];
  if (scheme && allowed.includes(scheme[1].toLowerCase())) {
    try { return new URL(value).href; } catch (error) { return searchUrl(value); }
  }
  const hasSpace = /\s/.test(value);
  const looksLikeIp = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#]|$)/.test(value);
  const looksLikeHost = /^(?:localhost(?::\d+)?|(?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]|$)/i.test(value);
  if (!hasSpace && (looksLikeIp || looksLikeHost)) {
    const prefix = /^localhost(?::|\/|$)/i.test(value) || looksLikeIp ? 'http://' : 'https://';
    try { return new URL(prefix + value).href; } catch (error) { return searchUrl(value); }
  }
  if (scheme) return searchUrl(value);
  return searchUrl(value);
}

async function navigate(rawValue) {
  const url = normalizeNavigationInput(rawValue);
  closeMenu();
  try {
    await invoke('navigate', url);
    if (isNewTabUrl(url)) await refreshBrowserState();
  } catch (error) {
    notify('Could not open address: ' + errorMessage(error), 'error', 4800);
  }
}

async function newTab(url) {
  try {
    await invoke('newTab', url || 'about:blank');
    await refreshBrowserState();
    if (!url || isNewTabUrl(url)) {
      window.setTimeout(function () {
        const search = $('ntp-search');
        if (search) search.focus();
      }, 0);
    }
  } catch (error) {
    notify(errorMessage(error), 'error');
  }
}

async function closeTab(id) {
  try {
    await invoke('closeTab', id);
    state.tabs = state.tabs.filter(function (tab) { return !sameId(tab.id, id); });
    state.closedTabCount += 1;
    if (!state.tabs.length) {
      await newTab();
      return;
    }
    await refreshBrowserState();
  } catch (error) {
    notify('Could not close tab: ' + errorMessage(error), 'error');
  }
}

async function switchTab(id) {
  if (sameId(id, state.activeTabId)) return;
  try {
    await invoke('switchTab', id);
    state.activeTabId = id;
    renderTabs();
    renderBrowserControls();
  } catch (error) {
    notify('Could not switch tab: ' + errorMessage(error), 'error');
  }
}

async function duplicateTab(id) {
  try {
    await invoke('duplicateTab', id);
    closeMenu();
    await refreshBrowserState();
  } catch (error) {
    notify('Could not duplicate tab: ' + errorMessage(error), 'error');
  }
}

async function reopenClosedTab() {
  try {
    const result = await invoke('reopenClosedTab');
    closeMenu();
    if (result === false) notify('No recently closed tab', 'info');
    await refreshBrowserState();
  } catch (error) {
    notify('Could not reopen tab: ' + errorMessage(error), 'error');
  }
}

async function goBack() {
  try { await invoke('goBack'); } catch (error) { notify(errorMessage(error), 'error'); }
}

async function goForward() {
  try { await invoke('goForward'); } catch (error) { notify(errorMessage(error), 'error'); }
}

async function reloadOrStop() {
  const tab = activeTab();
  try {
    if (tab && tab.loading) await invoke('stop');
    else await invoke('reload');
  } catch (error) {
    notify(errorMessage(error), 'error');
  }
}

async function toggleMute(tabId, desiredMuted) {
  try {
    let result;
    if (tabId !== undefined && tabId !== null && typeof api.muteTabById === 'function') {
      result = await api.muteTabById(tabId, desiredMuted);
    } else {
      result = await invoke('muteTab', desiredMuted);
    }
    if (result && result.success === false) throw new Error(result.error || 'Mute was not applied');
    const tab = state.tabs.find(function (item) { return sameId(item.id, tabId || state.activeTabId); });
    if (tab) tab.muted = desiredMuted;
    renderTabs();
    renderBrowserControls();
  } catch (error) {
    notify('Could not change audio: ' + errorMessage(error), 'error');
  }
}

async function toggleSplitScreen() {
  if (state.splitScreen) {
    try {
      await invoke('setSplitScreen', { enabled: false, secondaryTabId: null });
      state.splitScreen = false;
      state.secondaryTabId = null;
      renderBrowserControls();
    } catch (error) {
      notify('Could not close split view: ' + errorMessage(error), 'error');
    }
    return;
  }
  const otherTabs = state.tabs.filter(function (tab) {
    return !sameId(tab.id, state.activeTabId) && !isNewTabUrl(tab.url);
  });
  if (!otherTabs.length) {
    notify('Open another page before starting split view.', 'warning');
    return;
  }
  const secondary = otherTabs[0];
  try {
    await invoke('setSplitScreen', { enabled: true, secondaryTabId: secondary.id });
    state.splitScreen = true;
    state.secondaryTabId = secondary.id;
    renderBrowserControls();
    notify('Split view opened with ' + secondary.title, 'success');
  } catch (error) {
    notify('Could not open split view: ' + errorMessage(error), 'error');
  }
}

async function takeScreenshot() {
  try {
    const result = await invoke('screenshot');
    if (result && result.success === false) throw new Error(result.error || 'Screenshot failed');
    const path = result && (result.path || result.filePath);
    notify(path ? 'Screenshot saved to ' + path : 'Screenshot saved', 'success', 5000);
  } catch (error) {
    notify('Screenshot failed: ' + errorMessage(error), 'error');
  }
}

function updateZoomDisplay() {
  if (els.zoomDisplay) els.zoomDisplay.textContent = Math.round(state.zoomFactor * 100) + '%';
}

async function setZoom(factor) {
  const next = clamp(factor, 0.5, 2);
  try {
    const result = await invoke('setZoom', next);
    if (result && Number.isFinite(Number(result.zoomFactor))) state.zoomFactor = Number(result.zoomFactor);
    else state.zoomFactor = next;
    updateZoomDisplay();
  } catch (error) {
    notify('Could not change zoom: ' + errorMessage(error), 'error');
  }
}

function openFindBar() {
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url)) return;
  state.findOpen = true;
  document.body.classList.add('find-open');
  setHidden(els.findBar, false);
  els.findInput.focus();
  els.findInput.select();
  scheduleLayout();
}

async function closeFindBar() {
  state.findOpen = false;
  document.body.classList.remove('find-open');
  setHidden(els.findBar, true);
  els.findResults.textContent = '0/0';
  els.findInput.value = '';
  try { await invokeOptional('stopFind'); } catch (error) {}
  scheduleLayout();
}

async function findInPage(forward, findNext) {
  const query = els.findInput.value.trim();
  if (!query) {
    els.findResults.textContent = '0/0';
    try { await invokeOptional('stopFind'); } catch (error) {}
    return;
  }
  try {
    await invoke('findInPage', query, {
      forward: forward !== false,
      findNext: findNext !== false,
      matchCase: false
    });
  } catch (error) {
    els.findResults.textContent = 'Unavailable';
  }
}

function handleFindResult(result) {
  const details = result || {};
  const matches = Number(details.matches || details.totalMatches || 0);
  const active = Number(details.activeMatchOrdinal || details.activeMatch || 0);
  els.findResults.textContent = matches ? active + '/' + matches : 'No results';
}

function currentPageUrl() {
  const tab = activeTab();
  return tab && !isNewTabUrl(tab.url) ? tab.url : '';
}

function updateBookmarkButton() {
  const url = currentPageUrl();
  const bookmarked = Boolean(url && state.bookmarks.some(function (bookmark) { return bookmark.url === url; }));
  els.bookmarkButton.disabled = !url;
  els.bookmarkButton.setAttribute('aria-pressed', bookmarked ? 'true' : 'false');
  els.bookmarkButton.setAttribute('aria-label', bookmarked ? 'Remove bookmark' : 'Bookmark this page');
  const path = $('bookmark-star-path');
  if (path) path.setAttribute('fill', bookmarked ? 'currentColor' : 'none');
}

async function loadBookmarks() {
  try {
    const bookmarks = await invokeFirst(['getBookmarks']);
    state.bookmarks = Array.isArray(bookmarks) ? bookmarks : [];
  } catch (error) {
    state.bookmarks = [];
  }
  renderBookmarks();
}

async function saveBookmarks() {
  await invokeFirst(['saveBookmarks'], state.bookmarks);
}

function renderBookmarks() {
  clearNode(els.bookmarksGrid);
  state.bookmarks.slice(0, 12).forEach(function (bookmark, index) {
    const row = createElement('div', 'bookmark-row');
    const openButton = createElement('button', 'row-main-button');
    openButton.type = 'button';
    openButton.setAttribute('aria-label', 'Open ' + (bookmark.title || bookmark.url));
    const icon = createElement('span', 'row-icon', '★');
    icon.setAttribute('aria-hidden', 'true');
    const copy = createElement('span', 'row-copy');
    copy.append(
      createElement('span', 'row-title', bookmark.title || bookmark.url),
      createElement('span', 'row-meta', bookmark.url)
    );
    openButton.append(icon, copy);
    openButton.addEventListener('click', function () { navigate(bookmark.url); });
    const removeButton = createElement('button', 'row-action', '✕');
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', 'Remove ' + (bookmark.title || 'bookmark'));
    removeButton.addEventListener('click', async function () {
      state.bookmarks.splice(index, 1);
      try { await saveBookmarks(); } catch (error) { notify(errorMessage(error), 'error'); }
      renderBookmarks();
      updateBookmarkButton();
    });
    row.append(openButton, removeButton);
    els.bookmarksGrid.appendChild(row);
  });
  setHidden(els.bookmarksEmpty, state.bookmarks.length > 0);
  updateBookmarkButton();
}

async function toggleBookmark() {
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url)) return;
  const index = state.bookmarks.findIndex(function (bookmark) { return bookmark.url === tab.url; });
  if (index >= 0) {
    state.bookmarks.splice(index, 1);
    notify('Bookmark removed', 'info');
  } else {
    state.bookmarks.unshift({
      id: String(Date.now()),
      title: tab.title || tab.url,
      url: tab.url,
      createdAt: Date.now()
    });
    notify('Page bookmarked', 'success');
  }
  try {
    await saveBookmarks();
    renderBookmarks();
  } catch (error) {
    notify('Could not save bookmarks: ' + errorMessage(error), 'error');
  }
}

async function clearBookmarks() {
  if (!state.bookmarks.length) return;
  if (!window.confirm('Remove all bookmarks? This cannot be undone.')) return;
  const previous = state.bookmarks.slice();
  state.bookmarks = [];
  try {
    await saveBookmarks();
    renderBookmarks();
    notify('Bookmarks cleared', 'success');
  } catch (error) {
    state.bookmarks = previous;
    renderBookmarks();
    notify(errorMessage(error), 'error');
  }
}

function historyTimestamp(item) {
  return Number(item.timestamp || item.lastVisitTime || item.visitedAt || item.date || 0);
}

function historyTitle(item) {
  return String(item.title || item.domain || item.url || 'Untitled page');
}

function historyUrl(item) {
  return String(item.url || '');
}

async function loadHistory() {
  let history;
  try {
    if (typeof api.getHistory === 'function') {
      history = await api.getHistory({ range: state.historyRange, query: state.historyQuery });
    } else if (typeof api.getActivityRecords === 'function') {
      history = await api.getActivityRecords(state.historyRange === 'all' ? 'year' : state.historyRange);
    }
  } catch (error) {
    history = [];
  }
  state.history = Array.isArray(history) ? history.slice().sort(function (a, b) {
    return historyTimestamp(b) - historyTimestamp(a);
  }) : [];
  renderHistory();
  renderRecentHistory();
}

function filteredHistory() {
  const query = state.historyQuery.trim().toLowerCase();
  if (!query) return state.history;
  return state.history.filter(function (item) {
    return historyTitle(item).toLowerCase().includes(query) || historyUrl(item).toLowerCase().includes(query);
  });
}

function formatDateTime(value) {
  const date = new Date(Number(value) || value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function renderHistory() {
  clearNode(els.historyList);
  const history = filteredHistory();
  history.slice(0, 200).forEach(function (item) {
    const button = createElement('button', 'data-item history-button');
    button.type = 'button';
    const main = createElement('span', 'data-item-main');
    main.append(
      createElement('span', 'data-item-title', historyTitle(item)),
      createElement('span', 'data-item-meta', historyUrl(item) + (historyTimestamp(item) ? ' • ' + formatDateTime(historyTimestamp(item)) : ''))
    );
    button.appendChild(main);
    button.addEventListener('click', function () {
      const url = historyUrl(item);
      if (url) navigate(url);
    });
    els.historyList.appendChild(button);
  });
  setHidden(els.historyEmpty, history.length > 0);
}

function renderRecentHistory() {
  clearNode(els.recentList);
  state.history.slice(0, 5).forEach(function (item) {
    const button = createElement('button', 'recent-row');
    button.type = 'button';
    const icon = createElement('span', 'row-icon', '↗');
    icon.setAttribute('aria-hidden', 'true');
    const copy = createElement('span', 'row-copy');
    copy.append(
      createElement('span', 'row-title', historyTitle(item)),
      createElement('span', 'row-meta', historyUrl(item))
    );
    button.append(icon, copy);
    button.addEventListener('click', function () {
      const url = historyUrl(item);
      if (url) navigate(url);
    });
    els.recentList.appendChild(button);
  });
  setHidden(els.recentEmpty, state.history.length > 0);
}

async function clearHistory() {
  if (!window.confirm('Clear browsing history? This cannot be undone.')) return;
  try {
    if (typeof api.clearHistory === 'function') await api.clearHistory();
    else await invokeFirst(['clearActivityRecords']);
    state.history = [];
    renderHistory();
    renderRecentHistory();
    notify('Browsing history cleared', 'success');
  } catch (error) {
    notify('Could not clear history: ' + errorMessage(error), 'error');
  }
}

async function loadTasks() {
  try {
    const tasks = await invokeFirst(['getPendingTasks', 'getTasks']);
    state.tasks = Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    state.tasks = [];
  }
  renderTasks();
}

async function saveTasks() {
  if (typeof api.savePendingTasks === 'function') return api.savePendingTasks(state.tasks);
  return invokeFirst(['savePendingTasks', 'saveTasks'], state.tasks);
}

function taskText(task) {
  return String(task.text || task.title || '');
}

function renderTasks() {
  clearNode(els.taskList);
  const pendingCount = state.tasks.filter(function (task) { return !task.done; }).length;
  els.taskBadge.textContent = String(pendingCount);
  els.taskSummary.textContent = pendingCount + (pendingCount === 1 ? ' open task' : ' open tasks');
  state.tasks.forEach(function (task, index) {
    const item = createElement('div', 'data-item');
    item.classList.toggle('done', Boolean(task.done));
    const checkbox = createElement('input', 'task-check');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(task.done);
    checkbox.setAttribute('aria-label', (task.done ? 'Mark incomplete: ' : 'Mark complete: ') + taskText(task));
    checkbox.addEventListener('change', async function () {
      state.tasks[index].done = checkbox.checked;
      try { await saveTasks(); } catch (error) { notify(errorMessage(error), 'error'); }
      renderTasks();
    });
    const main = createElement('div', 'data-item-main');
    main.append(
      createElement('p', 'data-item-title', taskText(task)),
      createElement('p', 'data-item-meta', task.sourceTitle || task.sourceUrl || task.date || '')
    );
    const remove = createElement('button', 'row-action', '✕');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Delete task: ' + taskText(task));
    remove.addEventListener('click', async function () {
      state.tasks.splice(index, 1);
      try { await saveTasks(); } catch (error) { notify(errorMessage(error), 'error'); }
      renderTasks();
    });
    item.append(checkbox, main, remove);
    els.taskList.appendChild(item);
  });
  setHidden(els.tasksEmpty, state.tasks.length > 0);
}

async function addTask(textValue, source) {
  const text = String(textValue || '').trim();
  if (!text) return;
  state.tasks.unshift({
    id: String(Date.now()),
    text: text,
    done: false,
    createdAt: Date.now(),
    date: new Date().toLocaleDateString(),
    sourceUrl: source && source.url ? source.url : '',
    sourceTitle: source && source.title ? source.title : ''
  });
  try {
    await saveTasks();
    renderTasks();
    notify('Task added', 'success');
  } catch (error) {
    state.tasks.shift();
    renderTasks();
    notify('Could not save task: ' + errorMessage(error), 'error');
  }
}

function downloadId(item) {
  return item && (item.id || item.guid || item.url || item.filePath || item.filename);
}

function normalizeDownload(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const item = source.download && typeof source.download === 'object'
    ? source.download
    : source.item && typeof source.item === 'object'
      ? source.item
      : source;
  const total = Number(item.totalBytes || item.total || 0);
  const received = Number(item.receivedBytes || item.received || 0);
  let percent = Number(item.percent || item.progress || 0);
  if (percent <= 1 && percent > 0) percent *= 100;
  if (!percent && total > 0) percent = received / total * 100;
  return Object.assign({}, item, {
    id: downloadId(item),
    filename: String(item.filename || item.fileName || item.name || 'Download'),
    state: String(item.state || item.status || 'progressing'),
    percent: clamp(percent, 0, 100),
    filePath: item.filePath || item.savePath || item.path || ''
  });
}

async function loadDownloads() {
  try {
    const downloads = await invokeFirst(['getDownloads']);
    state.downloads = Array.isArray(downloads) ? downloads.map(normalizeDownload) : [];
  } catch (error) {
    state.downloads = [];
  }
  renderDownloads();
}

function upsertDownload(raw) {
  const next = normalizeDownload(raw);
  const index = state.downloads.findIndex(function (item) { return sameId(downloadId(item), next.id); });
  if (index >= 0) state.downloads[index] = Object.assign({}, state.downloads[index], next);
  else state.downloads.unshift(next);
  renderDownloads();
}

function isDownloadActive(item) {
  return ['progressing', 'downloading', 'paused'].includes(String(item.state).toLowerCase());
}

function isDownloadDone(item) {
  return ['completed', 'complete', 'done'].includes(String(item.state).toLowerCase());
}

async function runDownloadAction(names, item) {
  try {
    const result = await invokeFirst(names, downloadId(item));
    if (result === undefined) throw new Error('Download action unavailable');
    await loadDownloads();
  } catch (error) {
    notify(errorMessage(error), 'error');
  }
}

async function performDownloadAction(item, action, aliases) {
  try {
    let result;
    if (typeof api.downloadAction === 'function') {
      result = await api.downloadAction(downloadId(item), action);
    } else {
      result = await invokeFirst(aliases || [], downloadId(item));
    }
    if (result && result.success === false) throw new Error(result.error || 'Download action failed');
    await loadDownloads();
  } catch (error) {
    notify(errorMessage(error), 'error');
  }
}

function renderDownloads() {
  clearNode(els.downloadsList);
  const activeCount = state.downloads.filter(isDownloadActive).length;
  els.downloadsSummary.textContent = activeCount ? activeCount + ' active download' + (activeCount === 1 ? '' : 's') : 'No active downloads';
  els.downloadBadge.textContent = String(activeCount);
  setHidden(els.downloadBadge, activeCount === 0);
  state.downloads.forEach(function (item) {
    const row = createElement('div', 'data-item');
    const main = createElement('div', 'data-item-main');
    main.append(
      createElement('p', 'data-item-title', item.filename),
      createElement('p', 'data-item-meta', item.state + (item.filePath ? ' • ' + item.filePath : ''))
    );
    if (isDownloadActive(item)) {
      const progress = createElement('progress', 'download-progress');
      progress.max = 100;
      progress.value = item.percent;
      progress.textContent = Math.round(item.percent) + '%';
      main.appendChild(progress);
    }
    const actions = createElement('div', 'message-actions');
    if (isDownloadDone(item)) {
      const open = createElement('button', '', 'Open');
      open.type = 'button';
      open.addEventListener('click', function () { runDownloadAction(['openDownload', 'showDownload'], item); });
      const folder = createElement('button', '', 'Folder');
      folder.type = 'button';
      folder.addEventListener('click', function () { runDownloadAction(['showDownloadInFolder', 'showItemInFolder'], item); });
      actions.append(open, folder);
    } else if (isDownloadActive(item)) {
      const pauseResume = createElement('button', '', item.paused ? 'Resume' : 'Pause');
      pauseResume.type = 'button';
      pauseResume.addEventListener('click', function () {
        performDownloadAction(item, item.paused ? 'resume' : 'pause', item.paused ? ['resumeDownload'] : ['pauseDownload']);
      });
      const cancel = createElement('button', '', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { performDownloadAction(item, 'cancel', ['cancelDownload']); });
      actions.append(pauseResume, cancel);
    } else if (String(item.state).toLowerCase() === 'failed' || item.error) {
      const retry = createElement('button', '', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', function () { performDownloadAction(item, 'retry', ['retryDownload']); });
      actions.appendChild(retry);
    }
    main.appendChild(actions);
    row.appendChild(main);
    els.downloadsList.appendChild(row);
  });
  setHidden(els.downloadsEmpty, state.downloads.length > 0);
}

async function clearFinishedDownloads() {
  try {
    if (typeof api.clearDownloads === 'function') {
      await api.clearDownloads({ finishedOnly: true });
    } else if (typeof api.removeDownload === 'function') {
      const completed = state.downloads.filter(isDownloadDone);
      await Promise.all(completed.map(function (item) { return api.removeDownload(downloadId(item)); }));
    }
    state.downloads = state.downloads.filter(function (item) { return !isDownloadDone(item); });
    renderDownloads();
  } catch (error) {
    notify('Could not clear downloads: ' + errorMessage(error), 'error');
  }
}

function setDrawerPanel(panelName, focusTab) {
  const tabs = Array.from(document.querySelectorAll('.drawer-tab'));
  const panels = Array.from(document.querySelectorAll('.drawer-panel'));
  tabs.forEach(function (tab) {
    const selected = tab.dataset.panel === panelName;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focusTab) tab.focus();
  });
  panels.forEach(function (panel) {
    const selected = panel.dataset.panel === panelName;
    panel.classList.toggle('active', selected);
    panel.hidden = !selected;
  });
  if (panelName === 'tasks') loadTasks();
  if (panelName === 'history') loadHistory();
  if (panelName === 'downloads') loadDownloads();
  if (panelName === 'settings') {
    populateBrowserSettings();
    loadAiConfig();
  }
}

function openDrawer(panelName) {
  state.drawerOpen = true;
  setHidden(els.drawer, false);
  els.drawer.setAttribute('aria-hidden', 'false');
  els.aiButton.setAttribute('aria-expanded', 'true');
  const targetPanel = panelName || 'chat';
  setDrawerPanel(targetPanel, false);
  scheduleLayout();
  window.setTimeout(function () {
    const tab = document.querySelector('.drawer-tab[data-panel="' + targetPanel + '"]');
    if (tab) tab.focus();
  }, 0);
}

function closeDrawer(restoreFocus) {
  state.drawerOpen = false;
  setHidden(els.drawer, true);
  els.drawer.setAttribute('aria-hidden', 'true');
  els.aiButton.setAttribute('aria-expanded', 'false');
  scheduleLayout();
  if (restoreFocus) els.aiButton.focus();
}

function toggleDrawer() {
  if (state.drawerOpen) closeDrawer(true);
  else openDrawer('chat');
}

function openMenu() {
  state.menuOpen = true;
  setHidden(els.menu, false);
  els.menuButton.setAttribute('aria-expanded', 'true');
  scheduleLayout();
  const first = els.menu.querySelector('[role="menuitem"]');
  if (first) first.focus();
}

function closeMenu(restoreFocus) {
  if (!state.menuOpen) return;
  state.menuOpen = false;
  setHidden(els.menu, true);
  els.menuButton.setAttribute('aria-expanded', 'false');
  scheduleLayout();
  if (restoreFocus) els.menuButton.focus();
}

function toggleMenu() {
  if (state.menuOpen) closeMenu(true);
  else openMenu();
}

function createMessage(content, sender, options) {
  const message = createElement('div', 'chat-message ' + sender);
  const avatar = createElement('span', 'message-avatar', sender === 'user' ? 'You' : '✦');
  avatar.setAttribute('aria-hidden', 'true');
  const bubble = createElement('div', 'message-bubble');
  const copy = createElement('p', '', content || '');
  bubble.appendChild(copy);
  if (options && (options.copy || options.retry)) {
    const actions = createElement('div', 'message-actions');
    if (options.copy) {
      const copyButton = createElement('button', '', 'Copy');
      copyButton.type = 'button';
      copyButton.addEventListener('click', async function () {
        try {
          await navigator.clipboard.writeText(String(content || ''));
          notify('Response copied', 'success');
        } catch (error) {
          notify('Could not copy response', 'error');
        }
      });
      actions.appendChild(copyButton);
    }
    if (options.retry) {
      const retryButton = createElement('button', '', 'Retry');
      retryButton.type = 'button';
      retryButton.addEventListener('click', function () {
        sendAiMessage(options.retry.prompt, options.retry.includePageContext, false);
      });
      actions.appendChild(retryButton);
    }
    bubble.appendChild(actions);
  }
  message.append(avatar, bubble);
  els.aiMessages.appendChild(message);
  els.aiMessages.scrollTop = els.aiMessages.scrollHeight;
  return message;
}

function setAiBusy(busy) {
  state.aiBusy = busy;
  els.aiSend.disabled = busy;
  els.aiInput.disabled = busy;
  setHidden(els.aiStop, !busy);
  els.aiStatus.textContent = busy ? 'Invicta AI is responding…' : '';
}

function timeoutPromise(milliseconds) {
  return new Promise(function (_, reject) {
    window.setTimeout(function () {
      reject(new Error('The AI request timed out. Check the provider and try again.'));
    }, milliseconds);
  });
}

async function maybeSaveExtractedTask(extracted) {
  if (!extracted) return;
  const task = typeof extracted === 'string' ? { text: extracted } : extracted;
  const text = taskText(task);
  if (!text) return;
  if (!window.confirm('Add this AI-suggested task?\n\n' + text)) return;
  const tab = activeTab();
  await addTask(text, { url: tab ? tab.url : '', title: tab ? tab.title : '' });
}

async function sendAiMessage(promptValue, includePageContext, echoUser) {
  if (state.aiBusy) return;
  const prompt = String(promptValue !== undefined ? promptValue : els.aiInput.value).trim();
  if (!prompt) return;
  const includeContext = includePageContext !== undefined ? Boolean(includePageContext) : Boolean(els.aiContext.checked);
  const shouldEcho = echoUser !== false;
  if (shouldEcho) createMessage(prompt, 'user');
  els.aiInput.value = '';
  state.lastAiRequest = { prompt: prompt, includePageContext: includeContext };
  els.aiContext.checked = false;
  updateAiContextNote();
  const requestId = state.aiRequestId + 1;
  const ipcRequestId = 'renderer-ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  state.aiRequestId = requestId;
  state.activeAiRequestId = ipcRequestId;
  setAiBusy(true);
  const thinking = createMessage('Thinking…', 'assistant');
  try {
    const request = invoke('askInvictaAI', prompt, {
      includePageContext: includeContext,
      requestId: ipcRequestId,
      timeoutMs: 55000
    });
    const result = await Promise.race([request, timeoutPromise(60000)]);
    if (requestId !== state.aiRequestId) return;
    thinking.remove();
    if (result && result.success === false) throw new Error(result.error || (result.cancelled ? 'Request cancelled' : 'AI request failed'));
    const response = typeof result === 'string' ? result : result && (result.response || result.text || result.message);
    if (!response) throw new Error('Invicta AI returned an empty response.');
    createMessage(String(response), 'assistant', {
      copy: true,
      retry: { prompt: prompt, includePageContext: includeContext }
    });
    if (result && result.provider) {
      state.aiConfig.provider = result.provider;
      updateAiProviderBadge();
    }
    await maybeSaveExtractedTask(result && result.taskExtracted);
  } catch (error) {
    if (requestId !== state.aiRequestId) return;
    thinking.remove();
    createMessage('I could not complete that request. ' + errorMessage(error), 'assistant', {
      retry: { prompt: prompt, includePageContext: includeContext }
    });
  } finally {
    if (requestId === state.aiRequestId) {
      state.activeAiRequestId = null;
      setAiBusy(false);
    }
  }
}

function stopAiRequest() {
  if (!state.aiBusy) return;
  const activeRequestId = state.activeAiRequestId;
  state.aiRequestId += 1;
  state.activeAiRequestId = null;
  setAiBusy(false);
  if (activeRequestId) invokeOptional('cancelAiRequest', activeRequestId).catch(function () {});
  createMessage('Response stopped.', 'assistant');
}

function updateAiContextNote() {
  els.aiContextNote.textContent = els.aiContext.checked
    ? 'This message may include text from the active page. Turn this off before sending if the page is sensitive.'
    : 'Page context is off. Invicta AI receives only what you type.';
}

function updateAiProviderBadge() {
  const provider = state.aiConfig.provider;
  const cloud = provider === 'cloud';
  const invicta = provider === 'invicta';
  els.aiProviderBadge.textContent = cloud ? 'OpenAI' : (invicta ? 'Invicta' : 'Local');
  els.aiProviderBadge.classList.toggle('cloud', cloud);
  els.aiProviderBadge.classList.toggle('invicta', invicta);
  els.aiProviderBadge.classList.toggle('local', !cloud && !invicta);
}

async function loadAiConfig() {
  try {
    const config = await invokeOptional('getAiConfig');
    if (config && typeof config === 'object') {
      state.aiConfig = {
        provider: config.provider === 'cloud'
          ? 'cloud'
          : (config.provider === 'invicta' ? 'invicta' : 'local'),
        endpoint: String(config.endpoint || ''),
        model: String(config.model || '')
      };
    }
  } catch (error) {}
  $('setting-ai-provider').value = state.aiConfig.provider;
  $('setting-ai-endpoint').value = state.aiConfig.endpoint;
  $('setting-ai-model').value = state.aiConfig.model;
  $('setting-ai-key').value = '';
  syncAiConfigFormAvailability();
  updateAiProviderBadge();
}

function syncAiConfigFormAvailability(applyProviderDefault) {
  const provider = $('setting-ai-provider').value;
  const local = provider === 'local';
  const endpoint = $('setting-ai-endpoint');
  if (applyProviderDefault && provider === 'invicta' &&
      (!endpoint.value || endpoint.value.includes('api.openai.com'))) {
    endpoint.value = 'http://127.0.0.1:7860/api/v1';
  }
  if (applyProviderDefault && provider === 'cloud' &&
      (!endpoint.value || /127\.0\.0\.1|localhost/i.test(endpoint.value))) {
    endpoint.value = 'https://api.openai.com/v1';
  }
  endpoint.placeholder = provider === 'invicta'
    ? 'https://ai.invictatill.shop/api/v1 (or http://127.0.0.1:7860/api/v1)'
    : 'https://api.openai.com/v1';
  $('setting-ai-endpoint').disabled = local;
  $('setting-ai-model').disabled = provider !== 'cloud';
  $('setting-ai-key').disabled = local;
}

function aiConfigFromForm() {
  const selected = $('setting-ai-provider').value;
  const provider = selected === 'cloud'
    ? 'cloud'
    : (selected === 'invicta' ? 'invicta' : 'local');
  const config = { provider: provider };
  if (provider !== 'local') {
    config.endpoint = $('setting-ai-endpoint').value.trim();
  }
  if (provider === 'cloud') {
    config.model = $('setting-ai-model').value.trim();
  }
  const key = $('setting-ai-key').value.trim();
  if (key) config.apiKey = key;
  return config;
}

async function saveAiSettings(event) {
  event.preventDefault();
  const status = $('ai-settings-status');
  const config = aiConfigFromForm();
  status.textContent = 'Saving…';
  try {
    const result = await invoke('saveAiConfig', config);
    if (result && result.success === false) throw new Error(result.error || 'Could not save AI settings');
    state.aiConfig = {
      provider: result && result.provider ? result.provider : config.provider,
      endpoint: result && result.endpoint
        ? String(result.endpoint)
        : (config.endpoint || state.aiConfig.endpoint || ''),
      model: result && result.model
        ? String(result.model)
        : (config.model || state.aiConfig.model || '')
    };
    $('setting-ai-key').value = '';
    updateAiProviderBadge();
    status.textContent = 'AI settings saved.';
  } catch (error) {
    status.textContent = 'Save failed: ' + errorMessage(error);
  }
}

async function testAiSettings() {
  const status = $('ai-settings-status');
  const button = $('btn-test-ai-settings');
  button.disabled = true;
  status.textContent = 'Testing connection…';
  try {
    const result = await Promise.race([
      invoke('testAiConfig', aiConfigFromForm()),
      timeoutPromise(20000)
    ]);
    if (result && result.success === false) throw new Error(result.error || 'Connection failed');
    status.textContent = result && result.message ? String(result.message) : 'Connection successful.';
  } catch (error) {
    status.textContent = 'Test failed: ' + errorMessage(error);
  } finally {
    button.disabled = false;
  }
}

async function loadSettings() {
  try {
    const settings = await invokeFirst(['getSettings']);
    if (settings && typeof settings === 'object') {
      state.settings = Object.assign({}, state.settings, {
        searchEngine: settings.searchEngine || state.settings.searchEngine,
        homepage: String(settings.homepage || ''),
        restoreSession: settings.restoreSession !== false,
        activityTracking: settings.activityTracking === true
      });
    }
  } catch (error) {}
  populateBrowserSettings();
  configureActivityTracking();
}

function populateBrowserSettings() {
  $('setting-search-engine').value = state.settings.searchEngine;
  $('setting-homepage').value = state.settings.homepage;
  $('setting-restore-session').checked = Boolean(state.settings.restoreSession);
  $('setting-activity-tracking').checked = Boolean(state.settings.activityTracking);
}

async function saveBrowserSettings(event) {
  event.preventDefault();
  const next = Object.assign({}, state.settings, {
    searchEngine: $('setting-search-engine').value,
    homepage: $('setting-homepage').value.trim(),
    restoreSession: $('setting-restore-session').checked,
    activityTracking: $('setting-activity-tracking').checked
  });
  try {
    const result = await invoke('saveSettings', next);
    if (result && result.success === false) throw new Error(result.error || 'Settings were not saved');
    state.settings = next;
    configureActivityTracking();
    notify('Browser settings saved', 'success');
  } catch (error) {
    notify('Could not save settings: ' + errorMessage(error), 'error');
  }
}

function redactUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch (error) {
    return '';
  }
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

async function logActivityTick() {
  if (!state.settings.activityTracking || state.isPrivate || document.visibilityState !== 'visible') return;
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url) || tab.loading) return;
  const redacted = redactUrl(tab.url);
  if (!redacted) return;
  try {
    const parsed = new URL(redacted);
    await invokeOptional('logActivity', {
      timestamp: Date.now(),
      dateStr: localDateKey(new Date()),
      title: tab.title,
      url: redacted,
      domain: parsed.hostname,
      durationSec: 60,
      category: 'Browsing',
      mode: 'Workspace'
    });
  } catch (error) {}
}

function configureActivityTracking() {
  if (state.activityTimer) {
    window.clearInterval(state.activityTimer);
    state.activityTimer = null;
  }
  if (state.settings.activityTracking && !state.isPrivate) {
    state.activityTimer = window.setInterval(logActivityTick, 60000);
  }
}

async function clearBrowsingData() {
  if (!window.confirm('Clear browsing data, including cache, cookies, and history? You may be signed out of websites.')) return;
  try {
    if (typeof api.clearBrowsingData === 'function') {
      const result = await api.clearBrowsingData({ cache: true, cookies: true, history: true });
      if (result && result.success === false) throw new Error(result.error || 'Browsing data was not cleared');
    } else {
      await invokeFirst(['clearCache']);
      await invokeFirst(['clearHistory', 'clearActivityRecords']);
    }
    state.history = [];
    renderHistory();
    renderRecentHistory();
    notify('Browsing data cleared', 'success');
  } catch (error) {
    notify('Could not clear browsing data: ' + errorMessage(error), 'error');
  }
}

async function openPrivateWindow() {
  try {
    await invoke('launchPrivateWindow');
    closeMenu();
  } catch (error) {
    notify('Could not open private window: ' + errorMessage(error), 'error');
  }
}

async function printPage() {
  try {
    const result = await invoke('printPage');
    if (result && result.success === false) throw new Error(result.error || 'Print failed');
    closeMenu();
  } catch (error) {
    notify('Could not print page: ' + errorMessage(error), 'error');
  }
}

async function savePagePdf() {
  try {
    const result = await invoke('savePagePdf');
    if (result && result.success === false) throw new Error(result.error || 'PDF save failed');
    closeMenu();
    if (!result || result.canceled !== true) {
      notify(result && result.path ? 'PDF saved to ' + result.path : 'Page saved as PDF', 'success', 5000);
    }
  } catch (error) {
    notify('Could not save PDF: ' + errorMessage(error), 'error');
  }
}

function setUpdateBannerVisible(visible) {
  state.updateBannerVisible = Boolean(visible);
  setHidden(els.updateBanner, !visible);
  scheduleLayout();
}

function handleUpdateAvailable(info) {
  const version = info && info.version ? ' v' + info.version : '';
  state.updateReady = false;
  setUpdateBannerVisible(true);
  els.updateTitle.textContent = 'Update' + version + ' available';
  els.updateSub.textContent = 'Downloading in the background…';
  els.updateProgress.value = 0;
  setHidden(els.updateProgress, false);
  els.installUpdateButton.disabled = true;
  setHidden(els.installUpdateButton, true);
  els.modalInstall.disabled = true;
  setHidden(els.modalInstall, true);
}

function syncUpdateStateUI(ready, versionText) {
  state.updateReady = Boolean(ready);
  const btnSettings = $('btn-settings-install-update');
  if (btnSettings) {
    btnSettings.disabled = !state.updateReady;
    setHidden(btnSettings, !state.updateReady);
  }
  if (els.installUpdateButton) {
    els.installUpdateButton.disabled = !state.updateReady;
    setHidden(els.installUpdateButton, !state.updateReady);
  }
  if (els.modalInstall) {
    els.modalInstall.disabled = !state.updateReady;
    setHidden(els.modalInstall, !state.updateReady);
  }
}

function handleUpdateProgress(progressInfo) {
  const percent = clamp(progressInfo && progressInfo.percent, 0, 100);
  setUpdateBannerVisible(true);
  setHidden(els.updateProgress, false);
  els.updateProgress.value = percent;
  els.updateProgress.textContent = Math.round(percent) + '%';
  els.updateSub.textContent = 'Downloading… ' + Math.round(percent) + '%';
}

function handleUpdateDownloaded(info) {
  const version = info && info.version ? ' v' + info.version : '';
  syncUpdateStateUI(true, version);
  setUpdateBannerVisible(true);
  els.updateTitle.textContent = 'Update' + version + ' ready to install';
  els.updateSub.textContent = 'Click Install & Restart below to finish updating.';
  els.updateProgress.value = 100;
  setHidden(els.updateProgress, true);
  notify('Browser update' + version + ' is ready! Click Install & Restart to finish.', 'success', 10000);
}

async function installUpdate() {
  try {
    const res = await invoke('installUpdate');
    if (res && res.success === false) {
      notify('Could not install update: ' + (res.error || 'Update not ready'), 'error');
    }
  } catch (error) {
    notify('Could not install update: ' + errorMessage(error), 'error');
  }
}

async function trigger24HReport() {
  openDrawer('chat');
  appendChatMessage('user', 'Generate 24H WFH Productivity & Activity Report');
  setAiBusy(true);
  try {
    let result = null;
    if (typeof api.get24HReport === 'function') {
      result = await api.get24HReport();
    }
    const reportText = result && (result.response || result.report) ? (result.response || result.report) : 'Generating report failed';
    appendChatMessage('assistant', reportText);
  } catch (err) {
    appendChatMessage('assistant', 'Could not generate WFH report: ' + errorMessage(err));
  } finally {
    setAiBusy(false);
  }
}

async function triggerEmailTaskExtraction() {
  openDrawer('chat');
  appendChatMessage('user', 'Extract tasks and action items from active email/page');
  setAiBusy(true);
  try {
    let result = null;
    if (typeof api.extractEmailTasks === 'function') {
      result = await api.extractEmailTasks();
    }
    const summaryText = result && (result.response || result.summary) ? (result.response || result.summary) : 'Task extraction complete';
    appendChatMessage('assistant', summaryText);
    await loadTasks();
  } catch (err) {
    appendChatMessage('assistant', 'Could not extract email tasks: ' + errorMessage(err));
  } finally {
    setAiBusy(false);
  }
}

function populateList(listNode, values) {
  clearNode(listNode);
  const items = Array.isArray(values) ? values : [];
  items.forEach(function (value) {
    listNode.appendChild(createElement('li', '', typeof value === 'string' ? value : String(value && (value.text || value.title) || '')));
  });
}

async function openUpdateModal() {
  let notes = {};
  try {
    notes = await invokeOptional('getReleaseNotes') || {};
  } catch (error) {}
  els.modalVersion.textContent = notes.version ? 'Version ' + notes.version : 'Release notes';
  els.modalTitle.textContent = notes.title || 'InvictaTill Browser update';
  els.modalIntro.textContent = notes.intro || notes.description || 'Review what changed in this release.';
  populateList(els.modalFeatures, notes.features);
  populateList(els.modalFixes, notes.bugFixes || notes.fixes);
  els.modalInstall.disabled = !state.updateReady;
  setHidden(els.modalInstall, !state.updateReady);
  state.previousModalFocus = document.activeElement;
  state.modalOpen = true;
  setHidden(els.updateModalBackdrop, false);
  scheduleLayout();
  window.setTimeout(function () { els.updateModal.focus(); }, 0);
}

function closeUpdateModal() {
  if (!state.modalOpen) return;
  state.modalOpen = false;
  setHidden(els.updateModalBackdrop, true);
  scheduleLayout();
  if (state.previousModalFocus && typeof state.previousModalFocus.focus === 'function') {
    state.previousModalFocus.focus();
  }
}

function trapModalFocus(event) {
  if (!state.modalOpen || event.key !== 'Tab') return;
  const focusable = Array.from(els.updateModal.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'));
  if (!focusable.length) {
    event.preventDefault();
    els.updateModal.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function registerEvent(channel, callback) {
  if (typeof api.on !== 'function') return;
  try { api.on(channel, callback); } catch (error) {}
}

function registerBrowserEvents() {
  ['tab-created', 'tab-update', 'tab-navigated', 'tab-audio-state'].forEach(function (channel) {
    registerEvent(channel, function (payload) {
      upsertTab(tabFromPayload(payload));
      if (channel === 'tab-navigated') {
        loadHistory();
        updateBookmarkButton();
      }
    });
  });
  registerEvent('tab-switched', function (payload) {
    const tab = tabFromPayload(payload);
    if (tab && tab.id !== undefined) {
      upsertTab(tab);
      state.activeTabId = tab.id;
      renderTabs();
      renderBrowserControls();
    } else {
      refreshBrowserState();
    }
  });
  registerEvent('tab-closed', function (payload) {
    const closedId = payload && typeof payload === 'object' ? payload.id : payload;
    state.tabs = state.tabs.filter(function (tab) { return !sameId(tab.id, closedId); });
    state.closedTabCount += 1;
    refreshBrowserState();
  });
  registerEvent('open-url-in-new-tab', function (payload) {
    const url = payload && typeof payload === 'object' ? payload.url : payload;
    if (url) newTab(url);
  });
  registerEvent('focus-address-bar', function () {
    els.addressBar.focus();
    els.addressBar.select();
  });
  registerEvent('show-find-bar', openFindBar);
  registerEvent('found-in-page-result', handleFindResult);
  registerEvent('download-created', upsertDownload);
  registerEvent('download-updated', upsertDownload);
  registerEvent('fullscreen-change', function (isFullscreen) {
    state.isFullscreen = Boolean(isFullscreen);
    document.body.classList.toggle('fullscreen', state.isFullscreen);
    scheduleLayout();
  });
  registerEvent('update-available', handleUpdateAvailable);
  registerEvent('update-progress', handleUpdateProgress);
  registerEvent('update-downloaded', handleUpdateDownloaded);
}

function bindClick(id, handler) {
  const node = $(id);
  if (node) node.addEventListener('click', handler);
}

function wireUi() {
  bindClick('btn-minimize', function () { invokeOptional('minimize'); });
  bindClick('btn-maximize', function () { invokeOptional('maximize'); });
  bindClick('btn-close', function () { invokeOptional('closeWindow'); });
  bindClick('btn-new-tab', function () { newTab(); });
  bindClick('btn-reopen-tab', reopenClosedTab);
  bindClick('btn-back', goBack);
  bindClick('btn-forward', goForward);
  bindClick('btn-reload', reloadOrStop);
  bindClick('btn-home', function () { navigate(state.settings.homepage || 'about:blank'); });
  bindClick('btn-bookmark-star', toggleBookmark);
  bindClick('btn-mute', function () {
    const tab = activeTab();
    if (tab) toggleMute(tab.id, !tab.muted);
  });
  bindClick('btn-split-screen', toggleSplitScreen);
  bindClick('btn-screenshot', takeScreenshot);
  bindClick('btn-ai-drawer', toggleDrawer);
  bindClick('btn-close-drawer', function () { closeDrawer(true); });
  bindClick('btn-menu', toggleMenu);
  bindClick('btn-error-reload', reloadOrStop);
  bindClick('btn-error-new-tab', function () { newTab(); });

  els.addressBar.addEventListener('focus', function () { els.addressBar.select(); });
  els.addressBar.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      navigate(els.addressBar.value);
      els.addressBar.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const tab = activeTab();
      els.addressBar.value = tab && !isNewTabUrl(tab.url) ? tab.url : '';
      els.addressBar.blur();
    }
  });

  $('ntp-search-form').addEventListener('submit', function (event) {
    event.preventDefault();
    navigate($('ntp-search').value);
  });
  document.querySelectorAll('.quick-link').forEach(function (button) {
    button.addEventListener('click', function () { navigate(button.dataset.url); });
  });
  bindClick('clear-bookmarks-btn', clearBookmarks);
  bindClick('open-history-btn', function () { openDrawer('history'); });

  els.findInput.addEventListener('input', function () { findInPage(true, false); });
  els.findInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      findInPage(!event.shiftKey, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeFindBar();
    }
  });
  bindClick('find-prev', function () { findInPage(false, true); });
  bindClick('find-next', function () { findInPage(true, true); });
  bindClick('find-close', closeFindBar);

  document.querySelectorAll('.drawer-tab').forEach(function (tab) {
    tab.addEventListener('click', function () { setDrawerPanel(tab.dataset.panel, false); });
    tab.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const tabs = Array.from(document.querySelectorAll('.drawer-tab'));
      const index = tabs.indexOf(tab);
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      setDrawerPanel(next.dataset.panel, true);
    });
  });

  $('task-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const input = $('new-task-input');
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    await addTask(value);
  });

  let historySearchTimer = 0;
  els.historySearch.addEventListener('input', function () {
    window.clearTimeout(historySearchTimer);
    historySearchTimer = window.setTimeout(function () {
      state.historyQuery = els.historySearch.value;
      renderHistory();
    }, 160);
  });
  document.querySelectorAll('[data-history-range]').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('[data-history-range]').forEach(function (candidate) {
        const selected = candidate === button;
        candidate.classList.toggle('active', selected);
        candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      state.historyRange = button.dataset.historyRange;
      loadHistory();
    });
  });
  bindClick('btn-clear-history', clearHistory);
  bindClick('btn-clear-downloads', clearFinishedDownloads);

  els.aiContext.addEventListener('change', updateAiContextNote);
  bindClick('btn-send-ai', function () { sendAiMessage(); });
  bindClick('btn-stop-ai', stopAiRequest);
  els.aiInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendAiMessage();
    }
  });
  document.querySelectorAll('[data-ai-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!els.aiContext.checked) {
        notify('Enable “Share this page” before using a page action.', 'warning', 4500);
        els.aiContext.focus();
        return;
      }
      sendAiMessage(button.dataset.aiAction, els.aiContext.checked);
    });
  });

  $('browser-settings-form').addEventListener('submit', saveBrowserSettings);
  $('ai-settings-form').addEventListener('submit', saveAiSettings);
  $('setting-ai-provider').addEventListener('change', function () {
    syncAiConfigFormAvailability(true);
  });
  bindClick('btn-test-ai-settings', testAiSettings);
  bindClick('btn-private-window', openPrivateWindow);
  bindClick('btn-print-page', printPage);
  bindClick('btn-save-pdf', savePagePdf);
  bindClick('btn-clear-browsing-data', clearBrowsingData);

  bindClick('menu-new-tab', function () { newTab(); closeMenu(); });
  bindClick('menu-duplicate-tab', function () {
    const tab = activeTab();
    if (tab) duplicateTab(tab.id);
  });
  bindClick('menu-reopen-tab', reopenClosedTab);
  bindClick('menu-print', printPage);
  bindClick('menu-save-pdf', savePagePdf);
  bindClick('menu-devtools', async function () {
    try { await invoke('openDevTools'); } catch (error) { notify(errorMessage(error), 'error'); }
    closeMenu();
  });
  bindClick('menu-zoom-out', function () { setZoom(state.zoomFactor - 0.1); });
  bindClick('menu-zoom-in', function () { setZoom(state.zoomFactor + 0.1); });
  bindClick('menu-zoom-reset', function () { setZoom(1); });
  bindClick('menu-private-window', openPrivateWindow);
  bindClick('menu-settings', function () { closeMenu(); openDrawer('settings'); });
  bindClick('menu-release-notes', function () { closeMenu(); openUpdateModal(); });

  bindClick('btn-ai-gmail-tasks', triggerEmailTaskExtraction);
  bindClick('btn-ai-24h-report', trigger24HReport);
  bindClick('btn-tasks-24h-report', trigger24HReport);
  bindClick('btn-zoom-out', zoomOut);
  bindClick('btn-zoom-in', zoomIn);
  bindClick('btn-zoom-reset', resetZoom);

  bindClick('btn-add-workspace-open', openAddWorkspaceModal);
  bindClick('btn-close-add-ws', closeAddWorkspaceModal);
  bindClick('btn-cancel-add-ws', closeAddWorkspaceModal);
  $('add-workspace-form').addEventListener('submit', handleAddWorkspaceSubmit);

  if (els.wsIconPicker) {
    els.wsIconPicker.addEventListener('click', function (event) {
      const btn = event.target.closest('.ws-icon-opt');
      if (!btn) return;
      state.selectedWsIcon = btn.dataset.icon || '🏢';
      els.wsIconPicker.querySelectorAll('.ws-icon-opt').forEach(function (opt) {
        opt.classList.toggle('active', opt === btn);
      });
    });
  }

  if (els.wsColorPicker) {
    els.wsColorPicker.addEventListener('click', function (event) {
      const btn = event.target.closest('.ws-color-opt');
      if (!btn) return;
      state.selectedWsColor = btn.dataset.color || '#3b82f6';
      els.wsColorPicker.querySelectorAll('.ws-color-opt').forEach(function (opt) {
        opt.style.borderColor = opt === btn ? '#fff' : 'transparent';
      });
    });
  }

  bindClick('security-indicator', openSiteInfoModal);
  bindClick('btn-close-site-info', closeSiteInfoModal);
  bindClick('btn-close-site-info-done', closeSiteInfoModal);
  bindClick('btn-reset-site-permissions', resetSitePermissions);
  bindClick('btn-dismiss-update', function () { setUpdateBannerVisible(false); });
  bindClick('btn-install-update', installUpdate);
  bindClick('btn-close-update-modal', closeUpdateModal);
  bindClick('btn-modal-later', closeUpdateModal);
  bindClick('btn-modal-install', installUpdate);

  document.addEventListener('click', function (event) {
    if (state.menuOpen && !els.menu.contains(event.target) && !els.menuButton.contains(event.target)) closeMenu();
    if (event.target === els.siteInfoModalBackdrop) closeSiteInfoModal();
    if (event.target === els.addWorkspaceModalBackdrop) closeAddWorkspaceModal();
  });
  els.menu.addEventListener('keydown', function (event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(els.menu.querySelectorAll('button:not(:disabled)'));
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement);
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    else if (event.key === 'ArrowDown') nextIndex = (current + 1 + items.length) % items.length;
    else nextIndex = (current - 1 + items.length) % items.length;
    items[nextIndex].focus();
  });
  document.addEventListener('keydown', handleGlobalShortcuts, true);
  document.addEventListener('keydown', trapModalFocus);
  window.addEventListener('resize', scheduleLayout);
}

function handleGlobalShortcuts(event) {
  const ctrl = event.ctrlKey || event.metaKey;
  const key = String(event.key || '').toLowerCase();
  if (event.key === 'Escape') {
    if (!els.siteInfoModalBackdrop.classList.contains('hidden')) {
      event.preventDefault();
      closeSiteInfoModal();
    } else if (state.modalOpen) {
      event.preventDefault();
      closeUpdateModal();
    } else if (state.menuOpen) {
      event.preventDefault();
      closeMenu(true);
    } else if (state.findOpen) {
      event.preventDefault();
      closeFindBar();
    } else if (state.aiBusy) {
      event.preventDefault();
      stopAiRequest();
    } else if (state.drawerOpen) {
      event.preventDefault();
      closeDrawer(true);
    } else if (activeTab() && activeTab().loading) {
      event.preventDefault();
      invokeOptional('stop');
    } else if (state.isFullscreen) {
      event.preventDefault();
      invokeOptional('toggleFullscreen');
    }
    return;
  }
  if (ctrl && key === 't' && !event.shiftKey) {
    event.preventDefault();
    newTab();
  } else if (ctrl && key === 'w') {
    event.preventDefault();
    if (state.activeTabId !== null) closeTab(state.activeTabId);
  } else if (ctrl && event.shiftKey && key === 't') {
    event.preventDefault();
    reopenClosedTab();
  } else if (ctrl && key === 'l') {
    event.preventDefault();
    els.addressBar.focus();
    els.addressBar.select();
  } else if (ctrl && key === 'r') {
    event.preventDefault();
    reloadOrStop();
  } else if (ctrl && key === 'f') {
    event.preventDefault();
    openFindBar();
  } else if (ctrl && key === 'd') {
    event.preventDefault();
    toggleBookmark();
  } else if (ctrl && key === 'm') {
    event.preventDefault();
    const tab = activeTab();
    if (tab) toggleMute(tab.id, !tab.muted);
  } else if (ctrl && key === 'p') {
    event.preventDefault();
    printPage();
  } else if (ctrl && event.shiftKey && key === 's') {
    event.preventDefault();
    takeScreenshot();
  } else if (ctrl && (key === '+' || key === '=')) {
    event.preventDefault();
    setZoom(state.zoomFactor + 0.1);
  } else if (ctrl && key === '-') {
    event.preventDefault();
    setZoom(state.zoomFactor - 0.1);
  } else if (ctrl && key === '0') {
    event.preventDefault();
    setZoom(1);
  } else if (ctrl && key === 'tab') {
    event.preventDefault();
    const current = state.tabs.findIndex(function (tab) { return sameId(tab.id, state.activeTabId); });
    const direction = event.shiftKey ? -1 : 1;
    const next = state.tabs[(current + direction + state.tabs.length) % state.tabs.length];
    if (next) switchTab(next.id);
  } else if (ctrl && /^[1-9]$/.test(key)) {
    event.preventDefault();
    const index = key === '9' ? state.tabs.length - 1 : Number(key) - 1;
    if (state.tabs[index]) switchTab(state.tabs[index].id);
  } else if (event.altKey && event.key === 'ArrowLeft') {
    event.preventDefault();
    goBack();
  } else if (event.altKey && event.key === 'ArrowRight') {
    event.preventDefault();
    goForward();
  } else if (event.key === 'F5') {
    event.preventDefault();
    reloadOrStop();
  } else if (event.key === 'F11') {
    event.preventDefault();
    invokeOptional('toggleFullscreen');
  }
}

async function loadVersion() {
  try {
    const version = await invokeOptional('getVersion');
    if (version) $('about-version').textContent = 'v' + version;
  } catch (error) {}
}

async function initialize() {
  wireUi();
  registerBrowserEvents();
  updateAiContextNote();
  setDrawerPanel('chat', false);
  closeDrawer(false);
  closeMenu(false);
  setHidden(els.findBar, true);
  setHidden(els.updateModalBackdrop, true);
  setHidden(els.siteInfoModalBackdrop, true);
  setHidden(els.updateBanner, true);
  await Promise.all([
    loadSettings(),
    loadAiConfig(),
    loadBookmarks(),
    loadTasks(),
    loadHistory(),
    loadDownloads(),
    loadVersion(),
    refreshBrowserState()
  ]);
  try {
    const privateState = await invokeOptional('isPrivateInstance');
    if (privateState !== undefined) {
      state.isPrivate = Boolean(privateState);
      setMode(state.isPrivate ? 'private' : state.engineMode);
      configureActivityTracking();
    }
  } catch (error) {}
  updateViewLayout();
}

initialize().catch(function (error) {
  notify('Renderer initialization failed: ' + errorMessage(error), 'error', 8000);
});
