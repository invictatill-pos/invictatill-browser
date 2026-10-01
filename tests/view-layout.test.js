'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { chooseRememberedTab } = require('../workspace-state');

// Run the real layout and tab handlers against lightweight native-view doubles.
// This catches competing bounds updates without starting the user's browser.
const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8').replace(/\r\n/g, '\n');
const functionNames = [
  'getWorkspaceTabs', 'rememberWorkspaceTab', 'activateWorkspace',
  'safeViewSetVisible', 'splitSecondaryTab', 'resizeTabViewToCurrentLayout',
  'minimumViewLayout', 'normalizeViewLayout', 'viewBoundsForLayout', 'resizeViews',
  'setViewLayout', 'setViewVisible', 'setSplitScreen', 'switchTab', 'attachTabEvents',
  'hasPendingHttpAuthForTab', 'completeHttpAuthRequest', 'cancelHttpAuthRequestsForTab',
  'cancelHttpAuthRequestsForContents', 'attachHttpAuthLifecycle',
];
const implementations = functionNames.map((name) => {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Missing function ' + name);
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, 'Missing function end ' + name);
  return source.slice(start, end + 2);
}).join('\n');

function nativeView() {
  const contents = new EventEmitter();
  contents.isDestroyed = () => false;
  contents.setZoomFactor = () => {};
  contents.setWindowOpenHandler = () => {};
  return {
    webContents: contents,
    visible: false,
    bounds: null,
    setVisible(value) { this.visible = value; },
    setBounds(value) { this.bounds = { ...value }; },
  };
}

function fixture() {
  const state = {
    width: 1400, height: 900, fullscreen: false,
    mainWindow: {
      isDestroyed: () => false,
      isFullScreen: () => state.fullscreen,
      getContentSize: () => [state.width, state.height],
      getContentBounds: () => ({ x: 0, y: 0, width: state.width, height: state.height }),
    },
    DEFAULT_VIEW_LAYOUT: { top: 128, left: 48, right: 0, bottom: 0 },
    FULLSCREEN_VIEW_LAYOUT: { top: 0, left: 0 },
    viewLayout: { top: 128, left: 48, right: 0, bottom: 0 },
    tabs: new Map(), activeTabId: 1, activeWorkspaceId: 'default',
    splitScreen: { enabled: false, secondaryTabId: null },
    shellLayoutReady: true, tabsVisible: true,
    pendingHttpAuthCallbacks: new Map(), clearTimeout,
    whatsappSurface: { view: nativeView() },
    workspaceList: [{ id: 'default' }, { id: 'work' }],
    lastActiveTabByWorkspace: new Map(),
    chooseRememberedTab,
    getActiveTab: () => state.tabs.get(state.activeTabId),
    getTab: (id) => {
      const tab = state.tabs.get(id);
      if (!tab) throw new Error('Tab not found');
      return tab;
    },
    publicTab: (tab) => tab,
    getBrowserState: () => ({ ...state.splitScreen, activeWorkspaceId: state.activeWorkspaceId }),
    resizeWhatsappView: () => state.whatsappSurface.view.setVisible(true),
    isPlainObject: (value) => value && typeof value === 'object' && !Array.isArray(value),
    assertPlainObject: (value) => assert.ok(value && typeof value === 'object'),
    boundedNumber: (value, name, min, max) => {
      assert.ok(Number.isFinite(value) && value >= min && value <= max, name);
      return value;
    },
    scheduleSessionSave: () => {}, emitTab: () => {}, sendToShell: () => {},
    attachNavigationGuards: () => {}, attachBluetoothPicker: () => {},
  };
  [
    { id: 1, workspaceId: 'default' },
    { id: 2, workspaceId: 'default' },
    { id: 3, workspaceId: 'work' },
    { id: 4, workspaceId: 'work' },
  ].forEach((tab) => state.tabs.set(tab.id, {
    ...tab, url: 'https://example.test/' + tab.id, zoom: 1,
    isHtmlFullscreen: false, view: nativeView(),
  }));
  vm.createContext(state);
  vm.runInContext(implementations, state, { filename: 'main-layout-handlers.js' });
  return state;
}

test('fullscreen in either split pane survives repeated native and shell layout updates', () => {
  for (const ownerId of [1, 2]) {
    const state = fixture();
    state.setSplitScreen({ enabled: true, secondaryTabId: 2 });
    const owner = state.tabs.get(ownerId);
    state.attachTabEvents(owner);
    owner.view.webContents.emit('enter-html-full-screen');
    assert.deepEqual(owner.view.bounds, { x: 0, y: 0, width: 1400, height: 900 });
    state.width = 1920;
    state.height = 1080;
    state.fullscreen = true;
    state.resizeViews();
    state.setViewLayout({ top: 0, left: 0, right: 304, bottom: 60 });
    assert.deepEqual(owner.view.bounds, { x: 0, y: 0, width: 1920, height: 1080 });
    assert.equal(owner.view.visible, true);
    for (const tab of state.tabs.values()) {
      if (tab.id !== ownerId) assert.equal(tab.view.visible, false);
    }
    assert.equal(state.whatsappSurface.view.visible, false);

    // A shell modal must remain able to hide the fullscreen native surface.
    state.setViewVisible(false);
    assert.equal(owner.view.visible, false);
    state.setViewVisible(true);
    assert.equal(owner.view.visible, true);

    state.width = 1400;
    state.height = 900;
    state.fullscreen = false;
    state.setViewLayout({ top: 128, left: 48, right: 0, bottom: 0 });
    owner.view.webContents.emit('leave-html-full-screen');
    assert.deepEqual(state.tabs.get(1).view.bounds, { x: 48, y: 128, width: 676, height: 772 });
    assert.deepEqual(state.tabs.get(2).view.bounds, { x: 724, y: 128, width: 676, height: 772 });
    assert.equal(state.tabs.get(1).view.visible, true);
    assert.equal(state.tabs.get(2).view.visible, true);
    assert.equal(state.whatsappSurface.view.visible, true);
  }
});

test('switching workspaces through either entry point clears the previous split pane', () => {
  for (const switchWorkspace of [
    (state) => state.switchTab(3),
    (state) => state.activateWorkspace('work'),
    (state) => { state.activeWorkspaceId = 'work'; state.switchTab(3); },
  ]) {
    const state = fixture();
    state.setSplitScreen({ enabled: true, secondaryTabId: 2 });
    switchWorkspace(state);
    assert.equal(state.activeWorkspaceId, 'work');
    assert.equal(state.splitScreen.enabled, false);
    assert.equal(state.splitScreen.secondaryTabId, null);
    assert.equal(state.tabs.get(2).view.visible, false);
    assert.deepEqual(state.tabs.get(3).view.bounds, { x: 48, y: 128, width: 1352, height: 772 });
  }
});

test('split selection stays within the active workspace and stale foreign panes stay hidden', () => {
  const state = fixture();
  state.switchTab(3);
  state.setSplitScreen({ enabled: true });
  assert.equal(state.splitScreen.secondaryTabId, 4);
  assert.throws(() => state.setSplitScreen({ enabled: true, secondaryTabId: 1 }), /same workspace/);
  state.splitScreen = { enabled: true, secondaryTabId: 1 };
  state.tabs.get(1).isHtmlFullscreen = true;
  state.resizeViews();
  assert.equal(state.tabs.get(1).view.visible, false);
  assert.deepEqual(state.tabs.get(3).view.bounds, { x: 48, y: 128, width: 1352, height: 772 });
});

test('page-owned about:blank documents remain visible in either split pane', () => {
  const state = fixture();
  state.tabs.get(1).url = 'about:blank';
  state.tabs.get(1).pageOwned = true;
  state.tabs.get(2).url = 'about:blank';
  state.tabs.get(2).pageOwned = true;
  state.setSplitScreen({ enabled: true, secondaryTabId: 2 });
  assert.equal(state.tabs.get(1).view.visible, true);
  assert.equal(state.tabs.get(2).view.visible, true);
  state.tabs.get(1).pageOwned = false;
  state.resizeViews();
  assert.equal(state.tabs.get(1).view.visible, false);
  assert.equal(state.tabs.get(2).view.visible, true);
});

test('pending authentication hides only its native tab across split and workspace switches', () => {
  const state = fixture();
  state.pendingHttpAuthCallbacks.set('auth-1', { tabId: 1 });
  state.setSplitScreen({ enabled: true, secondaryTabId: 2 });
  assert.equal(state.tabs.get(1).view.visible, false);
  assert.equal(state.tabs.get(2).view.visible, true);
  assert.equal(state.whatsappSurface.view.visible, true);
  state.switchTab(2);
  assert.equal(state.tabs.get(2).view.visible, true);
  assert.equal(state.tabs.get(1).view.visible, false);
  state.activateWorkspace('work');
  assert.equal(state.tabs.get(3).view.visible, true);
  assert.equal(state.pendingHttpAuthCallbacks.has('auth-1'), true);
  state.activateWorkspace('default');
  state.switchTab(1);
  assert.equal(state.tabs.get(1).view.visible, false);
  state.pendingHttpAuthCallbacks.delete('auth-1');
  state.resizeViews();
  assert.equal(state.tabs.get(1).view.visible, true);
});

test('auth lifecycle cancels only superseded requests and resolves each callback once', () => {
  const state = fixture();
  const first = state.tabs.get(1).view.webContents;
  const second = state.tabs.get(2).view.webContents;
  first.id = 11;
  second.id = 12;
  state.attachHttpAuthLifecycle(first);
  state.attachHttpAuthLifecycle(second);
  const callbacks = [];
  const closed = [];
  const timers = [];
  state.clearTimeout = (timeout) => timers.push(timeout);
  state.sendToShell = (channel, data) => closed.push({ channel, ...data });
  first.emit('did-start-navigation', {}, 'https://example.test/auth', false, true);
  state.pendingHttpAuthCallbacks.set('auth-1', {
    tabId: 1, contentsId: 11, timeout: 1,
    callback: (...args) => callbacks.push(['auth-1', ...args]),
  });
  state.pendingHttpAuthCallbacks.set('auth-2', {
    tabId: 2, contentsId: 12, timeout: 2,
    callback: (...args) => callbacks.push(['auth-2', ...args]),
  });
  first.emit('did-start-navigation', {}, 'https://example.test/auth#hash', true, true);
  first.emit('did-start-navigation', {}, 'https://example.test/frame', false, false);
  assert.equal(state.pendingHttpAuthCallbacks.size, 2);
  first.emit('did-start-navigation', {}, 'https://example.test/other', false, true);
  assert.equal(state.pendingHttpAuthCallbacks.has('auth-1'), false);
  assert.equal(state.pendingHttpAuthCallbacks.has('auth-2'), true);
  assert.deepEqual(callbacks, [['auth-1', '', '']]);
  state.completeHttpAuthRequest('auth-1', 'late-user', 'late-password', 'responded');
  assert.equal(callbacks.length, 1);
  second.emit('destroyed');
  assert.equal(state.pendingHttpAuthCallbacks.size, 0);
  assert.deepEqual(callbacks, [['auth-1', '', ''], ['auth-2', '', '']]);
  assert.deepEqual(timers, [1, 2]);
  assert.deepEqual(closed.map((item) => [item.channel, item.tabId, item.reason]), [
    ['http-auth-closed', 1, 'navigation'], ['http-auth-closed', 2, 'destroyed'],
  ]);
});
