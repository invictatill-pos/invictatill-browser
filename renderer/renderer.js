'use strict';

const api = window.electronAPI || {};
const $ = function (id) { return document.getElementById(id); };

const els = {
  browserChrome: $('browser-chrome'),
  tabsContainer: $('tabs-container'),
  addressBar: $('address-bar'),
  addressSuggestions: $('address-suggestions'),
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
  commandBackdrop: $('command-backdrop'),
  commandPalette: $('command-palette'),
  commandInput: $('command-input'),
  commandResults: $('command-results'),
  commandResultCount: $('command-result-count'),
  findBar: $('find-bar'),
  findInput: $('find-input'),
  findResults: $('find-results'),
  notificationStack: $('notification-stack'),
  modeBadgeText: $('mode-badge-text'),
  titlebarStatus: $('titlebar-status'),
  focusStatusPill: $('focus-status-pill'),
  focusStatusPillText: $('focus-status-pill-text'),
  focusHero: $('focus-hero'),
  focusClock: $('focus-clock'),
  focusModeLabel: $('focus-mode-label'),
  focusIntentionDisplay: $('focus-intention-display'),
  focusProgress: $('focus-progress'),
  focusForm: $('focus-form'),
  focusIntention: $('focus-intention'),
  focusDuration: $('focus-duration'),
  focusStartActions: $('focus-start-actions'),
  focusRunningActions: $('focus-running-actions'),
  pauseFocusButton: $('btn-pause-focus'),
  focusSessionsToday: $('focus-sessions-today'),
  focusMinutesToday: $('focus-minutes-today'),
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
  updateSettingsCard: $('update-settings-card'),
  updateSettingsIcon: $('update-settings-icon'),
  updateSettingsTitle: $('update-settings-title'),
  updateSettingsStatus: $('update-settings-status'),
  checkUpdatesButton: $('btn-check-updates'),
  settingsInstallUpdateButton: $('btn-settings-install-update'),
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
  btnPasswords: $('btn-passwords'),
  passwordsModalBackdrop: $('passwords-modal-backdrop'),
  passwordsModal: $('passwords-modal'),
  btnClosePasswords: $('btn-close-passwords'),
  btnClosePasswordsDone: $('btn-close-passwords-done'),
  savePasswordForm: $('save-password-form'),
  pwdInputDomain: $('pwd-input-domain'),
  pwdInputUsername: $('pwd-input-username'),
  pwdInputPassword: $('pwd-input-password'),
  passwordsList: $('passwords-list'),
  screenPickerBackdrop: $('screen-picker-modal-backdrop'),
  screenPickerModal: $('screen-picker-modal'),
  screenPickerTabs: $('screen-picker-tabs'),
  screenPickerListPane: $('screen-picker-list-pane'),
  screenPickerPreviewImg: $('screen-picker-preview-img'),
  screenPickerPreviewTitle: $('screen-picker-preview-title'),
  screenPickerPreviewPrompt: $('screen-picker-preview-prompt'),
  screenPickerOrigin: $('screen-picker-origin'),
  screenPickerAudioLabel: $('screen-picker-audio-label'),
  btnCancelScreenPicker: $('btn-cancel-screen-picker'),
  btnCancelScreenPickerX: $('btn-cancel-screen-picker-x'),
  btnSubmitScreenPicker: $('btn-submit-screen-picker'),
  chkShareAudio: $('chk-share-audio'),
};

const state = {
  screenPickerData: null,
  screenPickerCategory: 'tabs',
  selectedScreenSource: null,
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
  commandItems: [],
  commandFiltered: [],
  commandSelection: 0,
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
  updateStatus: 'idle',
  currentVersion: '',
  updateBannerVisible: false,
  previousModalFocus: null,
  activityTimer: null,
  focusState: null,
  focusTicker: null
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

function visibleModalSurface() {
  const surfaces = [
    [els.screenPickerBackdrop, els.screenPickerModal],
    [els.siteInfoModalBackdrop, els.siteInfoModal],
    [els.addWorkspaceModalBackdrop, els.addWorkspaceModal],
    [els.passwordsModalBackdrop, els.passwordsModal],
    [els.updateModalBackdrop, els.updateModal],
    [els.commandBackdrop, els.commandPalette],
  ];
  for (const surface of surfaces) {
    if (surface[0] && !surface[0].classList.contains('hidden')) return surface;
  }
  return null;
}

function openModalSurface(backdrop, dialog) {
  if (!backdrop || !dialog) return;
  if (!state.modalOpen) state.previousModalFocus = document.activeElement;
  setHidden(backdrop, false);
  state.modalOpen = true;
  scheduleLayout();
  window.setTimeout(function () { dialog.focus(); }, 0);
}

function closeModalSurface(backdrop) {
  if (!backdrop) return;
  setHidden(backdrop, true);
  state.modalOpen = Boolean(visibleModalSurface());
  scheduleLayout();
  if (!state.modalOpen && state.previousModalFocus && typeof state.previousModalFocus.focus === 'function') {
    state.previousModalFocus.focus();
  }
  if (!state.modalOpen) state.previousModalFocus = null;
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
    pinned: Boolean(tab.pinned),
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
  
  if (tab.workspaceId !== (state.activeWorkspaceId || 'default')) {
    return;
  }

  const index = state.tabs.findIndex(function (item) { return sameId(item.id, tab.id); });
  if (index >= 0) state.tabs[index] = Object.assign({}, state.tabs[index], tab);
  else state.tabs.push(tab);
  if (rawTab.active) state.activeTabId = rawTab.id;
  renderTabs();
  renderBrowserControls();
}

function formatTabTitle(tab) {
  if (tab && typeof tab.title === 'string' && tab.title.trim()) {
    return tab.title.trim();
  }
  if (tab && typeof tab.url === 'string' && tab.url && tab.url !== 'about:blank') {
    try {
      const parsed = new URL(tab.url);
      return parsed.hostname.replace(/^www\./, '') || parsed.pathname || tab.url;
    } catch (e) {
      return tab.url;
    }
  }
  return 'New Tab';
}

function tabButtonLabel(tab) {
  let label = tab.muted ? 'Unmute ' : 'Mute ';
  label += formatTabTitle(tab);
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
    item.classList.toggle('pinned', tab.pinned);
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

    const displayTitle = formatTabTitle(tab);
    const title = createElement('span', 'tab-title', displayTitle);
    selectButton.setAttribute('title', displayTitle);
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
    closeButton.setAttribute('aria-label', 'Close ' + displayTitle);
    closeButton.title = 'Close tab';
    closeButton.addEventListener('click', function (event) {
      event.stopPropagation();
      closeTab(tab.id);
    });

    if (tab.workspaceColor) {
      const wsDot = createElement('span', 'tab-ws-dot');
      wsDot.dataset.color = String(tab.workspaceColor).toLowerCase();
      wsDot.title = 'Workspace: ' + (tab.workspaceName || 'Default');
      selectButton.prepend(wsDot);
    }
    if (tab.pinned) {
      const pin = createElement('span', 'tab-pin-indicator', '•');
      pin.setAttribute('aria-hidden', 'true');
      selectButton.append(faviconWrap, pin, title);
    } else {
      selectButton.append(faviconWrap, title);
    }
    item.append(selectButton, audioButton, closeButton);

    item.draggable = true;
    item.addEventListener('dragstart', function (event) {
      event.dataTransfer.setData('text/plain', String(tab.id));
      event.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', function () {
      item.classList.remove('dragging');
    });
    item.addEventListener('dragover', function (event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    item.addEventListener('drop', async function (event) {
      event.preventDefault();
      const draggedId = event.dataTransfer.getData('text/plain');
      if (!draggedId || sameId(draggedId, tab.id)) return;
      const ids = state.tabs.map(function (t) { return t.id; });
      const fromIdx = ids.findIndex(function (id) { return sameId(id, draggedId); });
      const toIdx = ids.findIndex(function (id) { return sameId(id, tab.id); });
      if (fromIdx >= 0 && toIdx >= 0) {
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, draggedId);
        try {
          if (typeof api.reorderTabs === 'function') {
            const res = await api.reorderTabs(ids);
            applyBrowserState(res);
          }
        } catch (err) {
          notify('Could not reorder tabs', 'error');
        }
      }
    });
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
  $('menu-pin-tab').disabled = !tab;
  $('menu-pin-tab').textContent = tab && tab.pinned ? 'Unpin tab' : 'Pin tab';
  $('menu-copy-link').disabled = !hasPage;
  $('menu-close-other-tabs').disabled = state.tabs.length < 2;
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

  openModalSurface(els.siteInfoModalBackdrop, els.siteInfoModal);
}

function closeSiteInfoModal() {
  closeModalSurface(els.siteInfoModalBackdrop);
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
    const pill = createElement('div', 'ws-tab-pill');
    pill.setAttribute('role', 'tab');
    pill.tabIndex = w.id === activeWsId ? 0 : -1;
    pill.setAttribute('aria-selected', w.id === activeWsId ? 'true' : 'false');
    if (w.id === activeWsId) pill.classList.add('active');

    const dot = createElement('span', 'ws-dot');
    dot.dataset.color = String(w.color || '#6366f1').toLowerCase();

    const text = createElement('span', 'ws-tab-label', (w.icon || '🌐') + ' ' + w.name);
    const editBtn = createElement('button', 'ws-edit-btn', '✏️');
    editBtn.type = 'button';
    editBtn.title = 'Rename workspace ' + w.name;
    editBtn.setAttribute('aria-label', 'Rename workspace ' + w.name);

    const startRename = function (event) {
      if (event) event.stopPropagation();
      const currentName = w.name || 'Workspace';
      const input = createElement('input', 'ws-rename-input');
      input.type = 'text';
      input.value = currentName;

      let finished = false;
      const saveRename = async function () {
        if (finished) return;
        finished = true;
        const newName = input.value ? input.value.trim() : '';
        if (newName && newName !== currentName) {
          try {
            if (typeof api.renameWorkspace === 'function') {
              const res = await api.renameWorkspace(w.id, newName);
              applyBrowserState(res);
              notify('Renamed workspace to: ' + newName, 'success', 2500);
            }
          } catch (err) {
            notify('Could not rename workspace: ' + errorMessage(err), 'error');
          }
        } else {
          renderWorkspaces();
        }
      };

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveRename();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finished = true;
          renderWorkspaces();
        }
      });
      input.addEventListener('blur', saveRename);

      text.replaceWith(input);
      input.focus();
      input.select();
    };

    editBtn.addEventListener('click', startRename);
    text.addEventListener('dblclick', startRename);
    pill.append(dot, text, editBtn);

    if (w.id !== 'default') {
      const closeBtn = createElement('button', 'ws-tab-close', '✕');
      closeBtn.type = 'button';
      closeBtn.title = 'Close workspace ' + w.name;
      closeBtn.setAttribute('aria-label', 'Close workspace ' + w.name);
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
    pill.addEventListener('keydown', function (event) {
      if (event.target !== pill || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      pill.click();
    });

    pill.draggable = true;
    pill.addEventListener('dragstart', function (event) {
      event.dataTransfer.setData('text/plain', w.id);
      event.dataTransfer.effectAllowed = 'move';
      pill.classList.add('dragging');
    });
    pill.addEventListener('dragend', function () {
      pill.classList.remove('dragging');
    });
    pill.addEventListener('dragover', function (event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    pill.addEventListener('drop', async function (event) {
      event.preventDefault();
      const draggedId = event.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === w.id) return;
      const ids = state.workspaces.map(function (item) { return item.id; });
      const fromIdx = ids.indexOf(draggedId);
      const toIdx = ids.indexOf(w.id);
      if (fromIdx >= 0 && toIdx >= 0) {
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, draggedId);
        try {
          if (typeof api.reorderWorkspaces === 'function') {
            const res = await api.reorderWorkspaces(ids);
            applyBrowserState(res);
          }
        } catch (err) {
          notify('Could not reorder workspaces', 'error');
        }
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
      const selected = btn.dataset.color === state.selectedWsColor;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  openModalSurface(els.addWorkspaceModalBackdrop, els.addWorkspaceModal);
}

function closeAddWorkspaceModal() {
  closeModalSurface(els.addWorkspaceModalBackdrop);
}

async function renderPasswordsList() {
  if (!els.passwordsList) return;
  clearNode(els.passwordsList);
  try {
    const list = typeof api.getSavedPasswords === 'function' ? await api.getSavedPasswords() : [];
    if (!list || !list.length) {
      els.passwordsList.appendChild(createElement('p', 'empty-text', 'No saved logins yet. Add a domain and login above to auto-fill across all workspaces!'));
      return;
    }
    list.forEach(function (item) {
      const row = createElement('div', 'pwd-item');
      const info = createElement('div', 'pwd-info');
      const domainSpan = createElement('span', 'pwd-domain', item.domain);
      const userSpan = createElement('span', 'pwd-username', item.username || 'No username');
      info.append(domainSpan, userSpan);

      const actions = createElement('div', 'pwd-actions');
      const fillBtn = createElement('button', 'secondary-button pwd-fill-button', '⚡ Autofill');
      fillBtn.type = 'button';
      fillBtn.addEventListener('click', async function () {
        try {
          if (typeof api.autofillCredentials === 'function') {
            await api.autofillCredentials({ username: item.username, password: item.password });
            notify('Autofilled credentials for ' + item.domain, 'success', 2500);
            closePasswordsModal();
          }
        } catch (err) {
          notify('Autofill failed: ' + errorMessage(err), 'error');
        }
      });

      const delBtn = createElement('button', 'icon-button pwd-delete-button', '✕');
      delBtn.type = 'button';
      delBtn.title = 'Delete saved login for ' + item.domain;
      delBtn.setAttribute('aria-label', 'Delete saved login for ' + item.domain);
      delBtn.addEventListener('click', async function () {
        try {
          if (typeof api.deletePassword === 'function') {
            await api.deletePassword(item.id);
            renderPasswordsList();
            notify('Deleted saved password', 'info', 2000);
          }
        } catch (err) {
          notify('Delete failed: ' + errorMessage(err), 'error');
        }
      });

      actions.append(fillBtn, delBtn);
      row.append(info, actions);
      els.passwordsList.appendChild(row);
    });
  } catch (err) {
    els.passwordsList.appendChild(createElement('p', 'empty-text', 'Failed to load passwords'));
  }
}

function openPasswordsModal() {
  if (!els.passwordsModalBackdrop) return;
  const tab = activeTab();
  if (tab && tab.url && tab.url !== 'about:blank' && els.pwdInputDomain) {
    try {
      const parsed = new URL(tab.url);
      els.pwdInputDomain.value = parsed.hostname.replace(/^www\./, '');
    } catch (e) {}
  }
  renderPasswordsList();
  openModalSurface(els.passwordsModalBackdrop, els.passwordsModal);
}

function closePasswordsModal() {
  if (!els.passwordsModalBackdrop) return;
  closeModalSurface(els.passwordsModalBackdrop);
}

function renderScreenPickerList() {
  if (!els.screenPickerListPane || !state.screenPickerData) return;
  clearNode(els.screenPickerListPane);

  let items = [];
  const cat = state.screenPickerCategory || 'tabs';

  if (cat === 'tabs') {
    items = (state.screenPickerData.tabs || []).map((t) => {
      return {
        id: t.id,
        title: t.title || t.url,
        subtitle: 'Workspace: ' + (t.workspaceName || t.workspaceId || 'Default'),
        thumbnail: null,
        type: 'tab',
      };
    });
  } else if (cat === 'windows') {
    items = (state.screenPickerData.windows || []).map((w) => ({
      id: w.id,
      title: w.name,
      subtitle: 'Application Window',
      thumbnail: w.thumbnail,
      type: 'window',
    }));
  } else {
    items = (state.screenPickerData.screens || []).map((s) => ({
      id: s.id,
      title: s.name,
      subtitle: 'Entire Screen Display',
      thumbnail: s.thumbnail,
      type: 'screen',
    }));
  }

  if (!items.length) {
    const discovering = cat !== 'tabs' && state.screenPickerData.desktopSourcesLoading;
    els.screenPickerListPane.appendChild(createElement(
      'p',
      'empty-text',
      discovering ? 'Finding available screens and windows…' : 'No items available in this section'
    ));
    return;
  }

  items.forEach(function (item) {
    const isSelected = state.selectedScreenSource && state.selectedScreenSource.id === item.id;
    const card = createElement('button', 'screen-picker-item');
    card.type = 'button';
    card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    card.title = item.title;

    const icon = createElement('span', 'screen-picker-item-icon', item.type === 'tab' ? '🌐' : item.type === 'window' ? '💻' : '🖥️');
    icon.setAttribute('aria-hidden', 'true');

    const info = createElement('div', 'screen-picker-item-copy');
    const titleSpan = createElement('span', 'screen-picker-item-title', item.title);
    const subSpan = createElement('span', 'screen-picker-item-subtitle', item.subtitle);
    info.append(titleSpan, subSpan);
    card.append(icon, info);

    card.addEventListener('click', function () {
      state.selectedScreenSource = item;
      renderScreenPickerList();
      updateScreenPickerPreview();
    });

    els.screenPickerListPane.appendChild(card);
  });
}

function updateScreenPickerAudioOption() {
  const requested = Boolean(state.screenPickerData && state.screenPickerData.audioRequested);
  if (els.chkShareAudio) {
    els.chkShareAudio.disabled = !requested;
    if (!requested) els.chkShareAudio.checked = false;
  }
  if (els.screenPickerAudioLabel) {
    if (!requested) els.screenPickerAudioLabel.textContent = 'The site did not request shared audio';
    else if (state.screenPickerCategory === 'tabs') els.screenPickerAudioLabel.textContent = 'Also share this tab’s audio';
    else els.screenPickerAudioLabel.textContent = 'Also share system audio';
  }
}

function updateScreenPickerPreview() {
  const item = state.selectedScreenSource;
  if (!item) {
    setHidden(els.screenPickerPreviewPrompt, false);
    setHidden(els.screenPickerPreviewImg, true);
    if (els.screenPickerPreviewImg) els.screenPickerPreviewImg.removeAttribute('src');
    if (els.screenPickerPreviewPrompt) els.screenPickerPreviewPrompt.textContent = 'Select an item on the left to preview';
    if (els.screenPickerPreviewTitle) els.screenPickerPreviewTitle.textContent = '';
    if (els.btnSubmitScreenPicker) els.btnSubmitScreenPicker.disabled = true;
    return;
  }

  if (els.btnSubmitScreenPicker) els.btnSubmitScreenPicker.disabled = false;
  if (els.screenPickerPreviewTitle) els.screenPickerPreviewTitle.textContent = item.title;

  if (item.thumbnail && els.screenPickerPreviewImg) {
    els.screenPickerPreviewImg.src = item.thumbnail;
    setHidden(els.screenPickerPreviewImg, false);
    setHidden(els.screenPickerPreviewPrompt, true);
  } else {
    if (els.screenPickerPreviewImg) els.screenPickerPreviewImg.removeAttribute('src');
    setHidden(els.screenPickerPreviewImg, true);
    setHidden(els.screenPickerPreviewPrompt, false);
    if (els.screenPickerPreviewPrompt) els.screenPickerPreviewPrompt.textContent = item.title;
  }
}

function openScreenPickerModal(data) {
  if (!els.screenPickerBackdrop || !data || !data.requestId) return;
  state.screenPickerData = data;
  state.screenPickerCategory = 'tabs';
  state.selectedScreenSource = null;
  if (els.screenPickerOrigin) {
    els.screenPickerOrigin.textContent = data.origin
      ? 'Request from ' + data.origin
      : 'Request from the active page';
  }
  if (els.chkShareAudio) els.chkShareAudio.checked = Boolean(data.audioRequested);
  updateScreenPickerAudioOption();

  if (els.screenPickerTabs) {
    els.screenPickerTabs.querySelectorAll('.screen-picker-tab-btn').forEach(function (btn) {
      const isAct = btn.dataset.target === state.screenPickerCategory;
      btn.classList.toggle('active', isAct);
      btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
  }

  renderScreenPickerList();
  updateScreenPickerPreview();
  openModalSurface(els.screenPickerBackdrop, els.screenPickerModal);
}

function closeScreenPickerModal(requestId) {
  if (!els.screenPickerBackdrop) return;
  if (requestId && state.screenPickerData && requestId !== state.screenPickerData.requestId) return;
  state.screenPickerData = null;
  state.selectedScreenSource = null;
  closeModalSurface(els.screenPickerBackdrop);
}

async function cancelScreenPickerModal() {
  const requestId = state.screenPickerData && state.screenPickerData.requestId;
  try {
    if (typeof api.cancelScreenShare === 'function') await api.cancelScreenShare(requestId);
  } catch (error) {}
  closeScreenPickerModal(requestId);
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
      const search = $('ntp-search');
      const suggestions = $('ntp-suggestions');
      if (search) search.value = '';
      if (suggestions) {
        clearNode(suggestions);
        setHidden(suggestions, true);
      }
      window.setTimeout(function () {
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
    const result = await invoke('switchTab', id);
    if (result && result.workspaceId && result.workspaceId !== state.activeWorkspaceId) {
      await refreshBrowserState();
      return;
    }
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

async function togglePinnedTab(id, pinned) {
  try {
    const result = await invoke('setTabPinned', id, pinned);
    closeMenu();
    if (result) applyBrowserState(result);
    notify(pinned ? 'Tab pinned to this workspace.' : 'Tab unpinned.', 'success', 2500);
  } catch (error) {
    notify('Could not update pinned tab: ' + errorMessage(error), 'error');
  }
}

async function closeOtherWorkspaceTabs(id) {
  try {
    const result = await invoke('closeOtherTabs', id);
    closeMenu();
    if (result) applyBrowserState(result);
    notify('Other tabs in this workspace were closed.', 'success', 2500);
  } catch (error) {
    notify('Could not close other tabs: ' + errorMessage(error), 'error');
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

function focusRemainingSeconds(data) {
  if (!data) return 25 * 60;
  if (data.status === 'active' && Number.isFinite(Number(data.endsAt))) {
    return Math.max(0, Math.ceil((Number(data.endsAt) - Date.now()) / 1000));
  }
  if (data.status === 'paused') return Math.max(0, Number(data.remainingSeconds) || 0);
  return Math.max(0, Math.round((Number(data.durationMinutes) || 25) * 60));
}

function formatFocusTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, '0');
  return String(minutes).padStart(2, '0') + ':' + remainder;
}

function renderFocusCountdown() {
  const data = state.focusState || { status: 'idle', mode: 'focus', durationMinutes: 25, stats: {} };
  const remaining = focusRemainingSeconds(data);
  const durationSeconds = Math.max(60, (Number(data.durationMinutes) || 25) * 60);
  const progress = data.status === 'idle' ? 0 : clamp(((durationSeconds - remaining) / durationSeconds) * 100, 0, 100);
  const timeText = formatFocusTime(remaining);
  els.focusClock.textContent = timeText;
  els.focusClock.setAttribute('datetime', 'PT' + Math.ceil(remaining / 60) + 'M');
  els.focusProgress.value = progress;
  els.focusProgress.textContent = Math.round(progress) + '%';
  if (data.status === 'active' || data.status === 'paused') {
    const label = data.mode === 'break' ? 'Break' : 'Focus';
    els.focusStatusPillText.textContent = label + ' ' + timeText;
    setHidden(els.focusStatusPill, false);
  } else {
    setHidden(els.focusStatusPill, true);
  }
}

function applyFocusState(info) {
  const data = info && typeof info === 'object' ? info : {};
  const status = ['active', 'paused'].includes(data.status) ? data.status : 'idle';
  const mode = data.mode === 'break' ? 'break' : 'focus';
  state.focusState = { ...data, status, mode };
  els.focusHero.dataset.status = status;
  els.focusHero.dataset.mode = mode;
  const running = status === 'active' || status === 'paused';
  const phase = mode === 'break' ? 'Break' : 'Focus';
  els.focusModeLabel.textContent = status === 'paused'
    ? phase + ' session paused'
    : status === 'active'
      ? phase + ' session in progress'
      : 'Ready for focused work';
  els.focusIntentionDisplay.textContent = running
    ? (data.intention || (mode === 'break' ? 'Step away, hydrate, and reset.' : 'Focused work session'))
    : 'Choose one clear outcome for this session.';
  els.focusIntention.disabled = running;
  els.focusDuration.disabled = running;
  setHidden(els.focusStartActions, running);
  setHidden(els.focusRunningActions, !running);
  els.pauseFocusButton.textContent = status === 'paused' ? 'Resume' : 'Pause';
  const focusStats = data.stats || {};
  els.focusSessionsToday.textContent = String(Number(focusStats.sessionsToday) || 0);
  els.focusMinutesToday.textContent = String(Number(focusStats.minutesToday) || 0);
  renderFocusCountdown();
  if (data.completedMode) {
    notify(data.completedMode === 'break'
      ? 'Break complete. Ready for the next work block.'
      : 'Focus session complete' + (data.completedIntention ? ': ' + data.completedIntention : '.'), 'success', 7000);
  }
}

async function loadFocusState() {
  try {
    const result = await invokeOptional('getFocusState');
    if (result) applyFocusState(result);
  } catch (error) {
    notify('Could not load focus session: ' + errorMessage(error), 'error');
  }
}

async function startFocusSession(mode, durationMinutes) {
  try {
    const result = await invoke('startFocusSession', {
      mode,
      durationMinutes,
      intention: String(els.focusIntention.value || '').trim(),
    });
    applyFocusState(result);
    notify(mode === 'break' ? 'Recovery break started.' : 'Focus session started.', 'success', 3000);
  } catch (error) {
    notify('Could not start focus session: ' + errorMessage(error), 'error');
  }
}

async function toggleFocusPause() {
  try {
    const paused = state.focusState && state.focusState.status === 'paused';
    const result = await invoke(paused ? 'resumeFocusSession' : 'pauseFocusSession');
    applyFocusState(result);
  } catch (error) {
    notify('Could not update focus session: ' + errorMessage(error), 'error');
  }
}

async function endFocusSession() {
  try {
    const result = await invoke('cancelFocusSession');
    applyFocusState(result);
    notify('Focus session ended.', 'info', 2500);
  } catch (error) {
    notify('Could not end focus session: ' + errorMessage(error), 'error');
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
  if (panelName === 'focus') loadFocusState();
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

function browserCommandItems() {
  const tab = activeTab();
  return [
    { kind: 'command', id: 'new-tab', title: 'New tab', meta: 'Browser', shortcut: 'Ctrl+T', keywords: 'create open page', run: newTab },
    { kind: 'command', id: 'reopen-tab', title: 'Reopen closed tab', meta: 'Browser', shortcut: 'Ctrl+Shift+T', keywords: 'restore recent closed', run: reopenClosedTab },
    { kind: 'command', id: 'private', title: 'New private window', meta: 'Privacy', keywords: 'incognito private session', run: openPrivateWindow },
    { kind: 'command', id: 'focus', title: 'Open focus sessions', meta: 'Work from home', keywords: 'timer pomodoro deep work break', run: function () { openDrawer('focus'); } },
    { kind: 'command', id: 'tasks', title: 'Open pending tasks', meta: 'Work from home', keywords: 'todo action items', run: function () { openDrawer('tasks'); } },
    { kind: 'command', id: 'history', title: 'Search browsing history', meta: 'Browser', keywords: 'recent pages', run: function () { openDrawer('history'); } },
    { kind: 'command', id: 'downloads', title: 'Open downloads', meta: 'Browser', keywords: 'files download', run: function () { openDrawer('downloads'); } },
    { kind: 'command', id: 'settings', title: 'Open settings', meta: 'Browser', keywords: 'preferences update', run: function () { openDrawer('settings'); } },
    { kind: 'command', id: 'copy-link', title: 'Copy current page link', meta: 'Page', keywords: 'url clipboard share', disabled: !tab || isNewTabUrl(tab.url), run: copyCurrentLink },
    { kind: 'command', id: 'pin-tab', title: tab && tab.pinned ? 'Unpin current tab' : 'Pin current tab', meta: 'Tabs', keywords: 'keep fixed favorite', disabled: !tab, run: function () { if (tab) return togglePinnedTab(tab.id, !tab.pinned); } },
    { kind: 'command', id: 'screenshot', title: 'Capture page screenshot', meta: 'Page', shortcut: 'Ctrl+Shift+S', keywords: 'image capture', disabled: !tab || isNewTabUrl(tab.url), run: takeScreenshot },
    { kind: 'command', id: 'print', title: 'Print current page', meta: 'Page', shortcut: 'Ctrl+P', keywords: 'pdf printer', disabled: !tab || isNewTabUrl(tab.url), run: printPage },
  ];
}

function commandSearchText(item) {
  return [item.title, item.meta, item.keywords, item.url, item.workspaceName].filter(Boolean).join(' ').toLowerCase();
}

function renderCommandResults() {
  const query = String(els.commandInput.value || '').trim().toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  state.commandFiltered = state.commandItems.filter(function (item) {
    if (item.disabled) return false;
    const haystack = commandSearchText(item);
    return tokens.every(function (token) { return haystack.includes(token); });
  }).slice(0, 24);
  state.commandSelection = Math.min(Math.max(state.commandSelection, 0), Math.max(0, state.commandFiltered.length - 1));
  clearNode(els.commandResults);

  if (!state.commandFiltered.length) {
    els.commandResults.appendChild(createElement('p', 'command-empty', 'No matching tabs or commands.'));
  } else {
    state.commandFiltered.forEach(function (item, index) {
      const button = createElement('button', 'command-result');
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', index === state.commandSelection ? 'true' : 'false');
      button.classList.toggle('selected', index === state.commandSelection);
      button.dataset.commandIndex = String(index);

      const icon = createElement('span', 'command-result-icon', item.kind === 'tab' ? (item.pinned ? '●' : '○') : '›');
      icon.setAttribute('aria-hidden', 'true');
      const copy = createElement('span', 'command-result-copy');
      copy.append(
        createElement('strong', '', item.title),
        createElement('span', '', item.kind === 'tab'
          ? (item.workspaceName || 'Workspace') + (item.url ? ' · ' + item.url : '')
          : item.meta)
      );
      button.append(icon, copy);
      if (item.shortcut) button.appendChild(createElement('kbd', '', item.shortcut));
      button.addEventListener('click', function () { executeCommandItem(index); });
      els.commandResults.appendChild(button);
    });
  }
  els.commandResultCount.textContent = state.commandFiltered.length + (state.commandFiltered.length === 1 ? ' result' : ' results');
}

async function executeCommandItem(index) {
  const item = state.commandFiltered[index];
  if (!item || item.disabled) return;
  closeCommandPalette(false);
  try {
    if (item.kind === 'tab') await switchTab(item.id);
    else if (typeof item.run === 'function') await item.run();
  } catch (error) {
    notify('Command failed: ' + errorMessage(error), 'error');
  }
}

async function openCommandPalette() {
  closeMenu(false);
  let allTabs = [];
  try {
    allTabs = await invokeOptional('getAllTabs') || state.tabs;
  } catch (error) {
    allTabs = state.tabs;
  }
  const tabItems = allTabs.map(normalizeTab).map(function (tab) {
    return {
      kind: 'tab',
      id: tab.id,
      title: formatTabTitle(tab),
      url: tab.url,
      workspaceName: tab.workspaceName,
      pinned: tab.pinned,
      keywords: 'open switch tab workspace',
    };
  });
  state.commandItems = tabItems.concat(browserCommandItems());
  state.commandSelection = 0;
  els.commandInput.value = '';
  renderCommandResults();
  openModalSurface(els.commandBackdrop, els.commandPalette);
  window.setTimeout(function () { els.commandInput.focus(); }, 0);
}

function closeCommandPalette(restoreFocus) {
  if (els.commandBackdrop.classList.contains('hidden')) return;
  closeModalSurface(els.commandBackdrop);
  state.commandItems = [];
  state.commandFiltered = [];
  if (restoreFocus) $('btn-command-center').focus();
}

function handleCommandPaletteKeydown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const count = state.commandFiltered.length;
    if (!count) return;
    state.commandSelection = (state.commandSelection + direction + count) % count;
    renderCommandResults();
    const selected = els.commandResults.querySelector('.command-result.selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter') {
    event.preventDefault();
    executeCommandItem(state.commandSelection);
  }
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

async function copyCurrentLink() {
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url)) return;
  try {
    await navigator.clipboard.writeText(tab.url);
    notify('Page link copied.', 'success', 2500);
  } catch (error) {
    notify('Could not copy page link: ' + errorMessage(error), 'error');
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

function applyUpdateState(info) {
  const data = info && typeof info === 'object' ? info : {};
  const allowedStatuses = new Set(['idle', 'disabled', 'checking', 'current', 'downloading', 'downloaded', 'installing', 'error']);
  const status = allowedStatuses.has(data.status) ? data.status : state.updateStatus;
  const currentVersion = data.currentVersion || state.currentVersion || '';
  const targetVersion = data.version || currentVersion;
  const percent = clamp(data.percent, 0, 100);
  state.updateStatus = status;
  state.currentVersion = currentVersion;

  if (els.updateSettingsCard) els.updateSettingsCard.dataset.status = status;
  if (els.updateSettingsIcon) {
    els.updateSettingsIcon.textContent = status === 'current' || status === 'downloaded'
      ? '✓'
      : status === 'error'
        ? '!'
        : status === 'disabled'
          ? '—'
          : '↻';
  }

  let title = 'Browser updates';
  let message = currentVersion ? 'Installed version ' + currentVersion + '.' : 'Update status is ready.';
  if (status === 'disabled') {
    title = 'Automatic updates unavailable';
    message = data.error || 'Updates are unavailable in this browser mode.';
  } else if (status === 'checking') {
    title = 'Checking for updates';
    message = currentVersion ? 'Comparing installed version ' + currentVersion + ' with the public release feed…' : 'Contacting the public release feed…';
  } else if (status === 'current') {
    title = 'You’re up to date';
    message = 'InvictaTill Browser ' + (currentVersion || targetVersion) + ' is the latest public version.';
  } else if (status === 'downloading') {
    title = 'Downloading update' + (targetVersion ? ' ' + targetVersion : '');
    message = 'Download in progress: ' + Math.round(percent) + '%.';
  } else if (status === 'downloaded') {
    title = 'Update ' + targetVersion + ' is ready';
    message = 'Restart InvictaTill Browser to finish installing the verified update.';
  } else if (status === 'installing') {
    title = 'Restarting to update';
    message = 'InvictaTill Browser is closing and applying update ' + targetVersion + '.';
  } else if (status === 'error') {
    title = 'Update check failed';
    message = data.error || 'The update service returned an unexpected error.';
  }

  if (els.updateSettingsTitle) els.updateSettingsTitle.textContent = title;
  if (els.updateSettingsStatus) els.updateSettingsStatus.textContent = message;
  if (els.checkUpdatesButton) {
    const busy = status === 'checking' || status === 'downloading' || status === 'installing';
    els.checkUpdatesButton.disabled = busy || status === 'disabled';
    els.checkUpdatesButton.textContent = status === 'checking'
      ? 'Checking…'
      : status === 'downloading'
        ? 'Downloading…'
        : status === 'disabled'
          ? 'Unavailable'
          : 'Check for updates';
    setHidden(els.checkUpdatesButton, status === 'downloaded' || status === 'installing');
  }
  syncUpdateStateUI(status === 'downloaded');
}

function handleUpdateChecking(info) {
  applyUpdateState({ ...(info || {}), status: 'checking' });
}

function handleUpdateNotAvailable(info) {
  applyUpdateState({ ...(info || {}), status: 'current' });
  if (info && info.interactive) {
    notify('InvictaTill Browser is up to date.', 'success', 3500);
  }
}

function handleUpdateAvailable(info) {
  const version = info && info.version ? ' v' + info.version : '';
  applyUpdateState({ ...(info || {}), status: 'downloading', percent: 0 });
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

function syncUpdateStateUI(ready) {
  state.updateReady = Boolean(ready);
  if (els.settingsInstallUpdateButton) {
    els.settingsInstallUpdateButton.disabled = !state.updateReady;
    setHidden(els.settingsInstallUpdateButton, !state.updateReady);
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
  applyUpdateState({ ...(progressInfo || {}), status: 'downloading', percent });
  setUpdateBannerVisible(true);
  setHidden(els.updateProgress, false);
  els.updateProgress.value = percent;
  els.updateProgress.textContent = Math.round(percent) + '%';
  els.updateSub.textContent = 'Downloading… ' + Math.round(percent) + '%';
}

function handleUpdateDownloaded(info) {
  const version = info && info.version ? ' v' + info.version : '';
  applyUpdateState({ ...(info || {}), status: 'downloaded', percent: 100 });
  setUpdateBannerVisible(true);
  els.updateTitle.textContent = 'Update' + version + ' ready to install';
  els.updateSub.textContent = 'Click Install & Restart below to finish updating.';
  els.updateProgress.value = 100;
  setHidden(els.updateProgress, true);
  notify('Browser update' + version + ' is ready! Click Install & Restart to finish.', 'success', 10000);
}

function handleUpdateError(info) {
  const data = { ...(info || {}), status: 'error' };
  applyUpdateState(data);
  if (data.interactive) {
    setUpdateBannerVisible(true);
    els.updateTitle.textContent = 'Update check failed';
    els.updateSub.textContent = data.error || 'The update service returned an unexpected error.';
    setHidden(els.updateProgress, true);
    syncUpdateStateUI(false);
    notify('Update check failed: ' + (data.error || 'Unknown update error'), 'error', 7000);
  }
}

function handleUpdateInstalling(info) {
  applyUpdateState({ ...(info || {}), status: 'installing' });
}

async function checkForBrowserUpdates() {
  applyUpdateState({ status: 'checking', currentVersion: state.currentVersion });
  try {
    const result = await invoke('checkUpdates');
    applyUpdateState(result);
    return result;
  } catch (error) {
    const data = { status: 'error', error: errorMessage(error), interactive: true };
    handleUpdateError(data);
    return data;
  }
}

async function loadUpdateState() {
  try {
    const result = await invokeOptional('getUpdateState');
    if (result) applyUpdateState(result);
  } catch (error) {
    applyUpdateState({ status: 'error', error: errorMessage(error), interactive: false });
  }
}

async function installUpdate() {
  try {
    const res = await invoke('installUpdate');
    if (res && res.success === false) {
      notify('Could not install update: ' + (res.error || 'Update not ready'), 'error');
    } else if (res) {
      applyUpdateState(res);
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
  openModalSurface(els.updateModalBackdrop, els.updateModal);
}

function closeUpdateModal() {
  closeModalSurface(els.updateModalBackdrop);
}

function trapModalFocus(event) {
  if (!state.modalOpen || event.key !== 'Tab') return;
  const surface = visibleModalSurface();
  const dialog = surface && surface[1];
  if (!dialog) return;
  const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'));
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
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
  registerEvent('open-command-palette', openCommandPalette);
  registerEvent('show-find-bar', openFindBar);
  registerEvent('found-in-page-result', handleFindResult);
  registerEvent('download-created', upsertDownload);
  registerEvent('download-updated', upsertDownload);
  registerEvent('fullscreen-change', function (isFullscreen) {
    state.isFullscreen = Boolean(isFullscreen);
    document.body.classList.toggle('fullscreen', state.isFullscreen);
    scheduleLayout();
  });
  registerEvent('update-checking', handleUpdateChecking);
  registerEvent('update-not-available', handleUpdateNotAvailable);
  registerEvent('update-available', handleUpdateAvailable);
  registerEvent('update-progress', handleUpdateProgress);
  registerEvent('update-downloaded', handleUpdateDownloaded);
  registerEvent('update-error', handleUpdateError);
  registerEvent('update-installing', handleUpdateInstalling);
  registerEvent('focus-state', applyFocusState);
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
  bindClick('btn-command-center', openCommandPalette);
  bindClick('focus-status-pill', function () { openDrawer('focus'); });
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
  els.focusForm.addEventListener('submit', function (event) {
    event.preventDefault();
    startFocusSession('focus', Number(els.focusDuration.value) || 25);
  });
  bindClick('btn-start-break', function () { startFocusSession('break', 5); });
  bindClick('btn-pause-focus', toggleFocusPause);
  bindClick('btn-end-focus', endFocusSession);
  document.querySelectorAll('[data-work-url]').forEach(function (button) {
    button.addEventListener('click', function () {
      const url = button.dataset.workUrl;
      if (url) newTab(url);
    });
  });
  els.commandInput.addEventListener('input', function () {
    state.commandSelection = 0;
    renderCommandResults();
  });
  els.commandInput.addEventListener('keydown', handleCommandPaletteKeydown);
  bindClick('btn-error-reload', reloadOrStop);
  bindClick('btn-error-new-tab', function () { newTab(); });

  els.addressBar.addEventListener('focus', function () { els.addressBar.select(); });
  let suggestionIndex = -1;
  let currentSuggestions = [];

  function renderSuggestions() {
    clearNode(els.addressSuggestions);
    if (currentSuggestions.length === 0) {
      setHidden(els.addressSuggestions, true);
      return;
    }
    setHidden(els.addressSuggestions, false);
    currentSuggestions.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item' + (index === suggestionIndex ? ' selected' : '');
      const icon = document.createElement('span');
      icon.className = 'suggestion-icon';
      icon.textContent = '🕒';
      const text = document.createElement('div');
      text.className = 'suggestion-text';
      const title = document.createElement('span');
      title.className = 'suggestion-title';
      title.textContent = item.title || item.url;
      const url = document.createElement('span');
      url.className = 'suggestion-url';
      url.textContent = item.url;
      text.appendChild(title);
      text.appendChild(url);
      div.appendChild(icon);
      div.appendChild(text);
      div.onmousedown = (e) => {
        e.preventDefault();
        navigate(item.url);
        els.addressBar.blur();
        setHidden(els.addressSuggestions, true);
      };
      els.addressSuggestions.appendChild(div);
    });
  }

  els.addressBar.addEventListener('input', async function () {
    const val = els.addressBar.value.trim().toLowerCase();
    suggestionIndex = -1;
    if (!val || val.startsWith('invicta://')) {
      currentSuggestions = [];
      renderSuggestions();
      return;
    }
    const history = await api.getHistory({ query: val, limit: 10 });
    const unique = [];
    const seen = new Set();
    for (const h of history) {
      if (!seen.has(h.url)) {
        seen.add(h.url);
        unique.push(h);
      }
    }
    currentSuggestions = unique.slice(0, 6);
    renderSuggestions();
  });

  els.addressBar.addEventListener('blur', function () {
    setTimeout(() => setHidden(els.addressSuggestions, true), 100);
  });

  els.addressBar.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (currentSuggestions.length > 0) {
        suggestionIndex = (suggestionIndex + 1) % currentSuggestions.length;
        renderSuggestions();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentSuggestions.length > 0) {
        suggestionIndex = suggestionIndex <= 0 ? currentSuggestions.length - 1 : suggestionIndex - 1;
        renderSuggestions();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestionIndex >= 0 && suggestionIndex < currentSuggestions.length) {
        navigate(currentSuggestions[suggestionIndex].url);
      } else {
        navigate(els.addressBar.value);
      }
      els.addressBar.blur();
      setHidden(els.addressSuggestions, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setHidden(els.addressSuggestions, true);
      const tab = activeTab();
      els.addressBar.value = tab && !isNewTabUrl(tab.url) ? tab.url : '';
      els.addressBar.blur();
    }
  });

  let ntpSuggestionIndex = -1;
  let currentNtpSuggestions = [];
  const ntpSearchInput = $('ntp-search');
  const ntpSuggestionsContainer = $('ntp-suggestions');

  function renderNtpSuggestions() {
    clearNode(ntpSuggestionsContainer);
    if (currentNtpSuggestions.length === 0) {
      setHidden(ntpSuggestionsContainer, true);
      return;
    }
    setHidden(ntpSuggestionsContainer, false);
    currentNtpSuggestions.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item' + (index === ntpSuggestionIndex ? ' selected' : '');
      const icon = document.createElement('span');
      icon.className = 'suggestion-icon';
      icon.textContent = '🕒';
      const text = document.createElement('div');
      text.className = 'suggestion-text';
      const title = document.createElement('span');
      title.className = 'suggestion-title';
      title.textContent = item.title || item.url;
      const url = document.createElement('span');
      url.className = 'suggestion-url';
      url.textContent = item.url;
      text.appendChild(title);
      text.appendChild(url);
      div.appendChild(icon);
      div.appendChild(text);
      div.onmousedown = (e) => {
        e.preventDefault();
        navigate(item.url);
        ntpSearchInput.blur();
        setHidden(ntpSuggestionsContainer, true);
      };
      ntpSuggestionsContainer.appendChild(div);
    });
  }

  ntpSearchInput.addEventListener('input', async function () {
    const val = ntpSearchInput.value.trim().toLowerCase();
    ntpSuggestionIndex = -1;
    if (!val || val.startsWith('invicta://')) {
      currentNtpSuggestions = [];
      renderNtpSuggestions();
      return;
    }
    const history = await api.getHistory({ query: val, limit: 10 });
    const unique = [];
    const seen = new Set();
    for (const h of history) {
      if (!seen.has(h.url)) {
        seen.add(h.url);
        unique.push(h);
      }
    }
    currentNtpSuggestions = unique.slice(0, 6);
    renderNtpSuggestions();
  });

  ntpSearchInput.addEventListener('blur', function () {
    setTimeout(() => setHidden(ntpSuggestionsContainer, true), 100);
  });

  ntpSearchInput.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (currentNtpSuggestions.length > 0) {
        ntpSuggestionIndex = (ntpSuggestionIndex + 1) % currentNtpSuggestions.length;
        renderNtpSuggestions();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (currentNtpSuggestions.length > 0) {
        ntpSuggestionIndex = ntpSuggestionIndex <= 0 ? currentNtpSuggestions.length - 1 : ntpSuggestionIndex - 1;
        renderNtpSuggestions();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setHidden(ntpSuggestionsContainer, true);
    }
  });

  $('ntp-search-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (ntpSuggestionIndex >= 0 && ntpSuggestionIndex < currentNtpSuggestions.length) {
      navigate(currentNtpSuggestions[ntpSuggestionIndex].url);
    } else {
      navigate(ntpSearchInput.value);
    }
    ntpSearchInput.blur();
    setHidden(ntpSuggestionsContainer, true);
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
  bindClick('menu-pin-tab', function () {
    const tab = activeTab();
    if (tab) togglePinnedTab(tab.id, !tab.pinned);
  });
  bindClick('menu-copy-link', function () {
    closeMenu();
    copyCurrentLink();
  });
  bindClick('menu-close-other-tabs', function () {
    const tab = activeTab();
    if (tab) closeOtherWorkspaceTabs(tab.id);
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
        const selected = opt === btn;
        opt.classList.toggle('active', selected);
        opt.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    });
  }

  bindClick('security-indicator', openSiteInfoModal);
  bindClick('btn-close-site-info', closeSiteInfoModal);
  bindClick('btn-close-site-info-done', closeSiteInfoModal);
  bindClick('btn-reset-site-permissions', resetSitePermissions);
  bindClick('btn-passwords', openPasswordsModal);
  bindClick('btn-close-passwords', closePasswordsModal);
  bindClick('btn-close-passwords-done', closePasswordsModal);
  if (els.savePasswordForm) {
    els.savePasswordForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const domain = els.pwdInputDomain ? els.pwdInputDomain.value.trim() : '';
      const username = els.pwdInputUsername ? els.pwdInputUsername.value.trim() : '';
      const password = els.pwdInputPassword ? els.pwdInputPassword.value : '';
      if (!domain || !password) {
        notify('Please provide a domain and password', 'error');
        return;
      }
      try {
        if (typeof api.savePassword === 'function') {
          await api.savePassword({ domain, username, password });
          if (els.pwdInputUsername) els.pwdInputUsername.value = '';
          if (els.pwdInputPassword) els.pwdInputPassword.value = '';
          renderPasswordsList();
          notify('Saved password for ' + domain + ' (available in all workspaces)', 'success', 3000);
        }
      } catch (err) {
        notify('Failed to save password: ' + errorMessage(err), 'error');
      }
    });
  }

  if (els.screenPickerTabs) {
    els.screenPickerTabs.addEventListener('click', function (event) {
      const btn = event.target.closest('.screen-picker-tab-btn');
      if (!btn) return;
      state.screenPickerCategory = btn.dataset.target || 'tabs';
      els.screenPickerTabs.querySelectorAll('.screen-picker-tab-btn').forEach(function (b) {
        const isAct = b === btn;
        b.classList.toggle('active', isAct);
        b.setAttribute('aria-selected', isAct ? 'true' : 'false');
      });
      state.selectedScreenSource = null;
      renderScreenPickerList();
      updateScreenPickerPreview();
      updateScreenPickerAudioOption();
    });
  }

  bindClick('btn-cancel-screen-picker', cancelScreenPickerModal);
  bindClick('btn-cancel-screen-picker-x', cancelScreenPickerModal);

  bindClick('btn-submit-screen-picker', async function () {
    if (!state.selectedScreenSource || !state.screenPickerData) return;
    const selection = state.selectedScreenSource;
    const requestId = state.screenPickerData.requestId;
    try {
      if (typeof api.selectScreenShareSource === 'function') {
        const shareAudio = els.chkShareAudio ? els.chkShareAudio.checked : false;
        const result = await api.selectScreenShareSource({
          requestId,
          sourceId: selection.id,
          audio: shareAudio,
        });
        if (!result || result.success !== true) {
          throw new Error(result && result.error ? result.error : 'The page rejected the selected source');
        }
        notify('Started screen share: ' + selection.title, 'success', 3000);
      }
    } catch (err) {
      notify('Screen share failed: ' + errorMessage(err), 'error');
    }
    closeScreenPickerModal(requestId);
  });

  if (typeof api.onShowScreenPicker === 'function') {
    api.onShowScreenPicker(function (data) {
      openScreenPickerModal(data);
    });
  }
  if (typeof api.onUpdateScreenPickerSources === 'function') {
    api.onUpdateScreenPickerSources(function (data) {
      if (!data || !state.screenPickerData || data.requestId !== state.screenPickerData.requestId) return;
      state.screenPickerData.desktopSourcesLoading = Boolean(data.desktopSourcesLoading);
      state.screenPickerData.screens = Array.isArray(data.screens) ? data.screens : [];
      state.screenPickerData.windows = Array.isArray(data.windows) ? data.windows : [];
      if (state.screenPickerCategory !== 'tabs') {
        state.selectedScreenSource = null;
        renderScreenPickerList();
        updateScreenPickerPreview();
      }
    });
  }
  if (typeof api.onCloseScreenPicker === 'function') {
    api.onCloseScreenPicker(function (data) {
      closeScreenPickerModal(data && data.requestId);
    });
  }

  bindClick('btn-dismiss-update', function () { setUpdateBannerVisible(false); });
  bindClick('btn-install-update', installUpdate);
  bindClick('btn-check-updates', checkForBrowserUpdates);
  bindClick('btn-settings-install-update', installUpdate);
  bindClick('btn-close-update-modal', closeUpdateModal);
  bindClick('btn-modal-later', closeUpdateModal);
  bindClick('btn-modal-install', installUpdate);

  document.addEventListener('click', function (event) {
    if (state.menuOpen && !els.menu.contains(event.target) && !els.menuButton.contains(event.target)) closeMenu();
    if (event.target === els.siteInfoModalBackdrop) closeSiteInfoModal();
    if (event.target === els.addWorkspaceModalBackdrop) closeAddWorkspaceModal();
    if (event.target === els.passwordsModalBackdrop) closePasswordsModal();
    if (event.target === els.commandBackdrop) closeCommandPalette(true);
    if (event.target === els.screenPickerBackdrop) {
      cancelScreenPickerModal();
    }
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
    if (!els.commandBackdrop.classList.contains('hidden')) {
      event.preventDefault();
      closeCommandPalette(true);
    } else if (!els.screenPickerBackdrop.classList.contains('hidden')) {
      event.preventDefault();
      cancelScreenPickerModal();
    } else if (!els.siteInfoModalBackdrop.classList.contains('hidden')) {
      event.preventDefault();
      closeSiteInfoModal();
    } else if (!els.addWorkspaceModalBackdrop.classList.contains('hidden')) {
      event.preventDefault();
      closeAddWorkspaceModal();
    } else if (!els.passwordsModalBackdrop.classList.contains('hidden')) {
      event.preventDefault();
      closePasswordsModal();
    } else if (!els.updateModalBackdrop.classList.contains('hidden')) {
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
  } else if (ctrl && event.shiftKey && key === 'a') {
    event.preventDefault();
    openCommandPalette();
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
    if (version) {
      state.currentVersion = version;
      $('about-version').textContent = 'v' + version;
    }
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
  setHidden(els.commandBackdrop, true);
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
    loadFocusState(),
    loadUpdateState(),
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
  if (!state.focusTicker) state.focusTicker = window.setInterval(renderFocusCountdown, 1000);
}

initialize().catch(function (error) {
  notify('Renderer initialization failed: ' + errorMessage(error), 'error', 8000);
});
