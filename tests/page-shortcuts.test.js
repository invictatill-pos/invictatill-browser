'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
const implementation = (source, name) => {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'Missing ' + name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};

test('the shortcut layer leaves find keys for page handlers and the native accelerator', () => {
  const sent = [];
  const state = { sendToShell: (...args) => sent.push(args) };
  vm.createContext(state);
  vm.runInContext(implementation(read('main.js'), 'handleShortcut'), state);
  let prevented = 0;
  const event = { preventDefault: () => { prevented += 1; } };
  state.handleShortcut(event, { type: 'keyDown', control: true, key: 'f' }, 1);
  state.handleShortcut(event, { type: 'keyDown', control: true, shift: true, key: 'f' }, 1);
  assert.equal(prevented, 0);
  assert.equal(sent.length, 0);
});

test('native find targets the focused visible pane or the active tab from browser chrome', () => {
  const sent = [];
  let primaryFocused = false;
  let secondaryFocused = true;
  let shellFocused = false;
  const primary = { id: 1, view: { webContents: { isDestroyed: () => false, isFocused: () => primaryFocused } } };
  const secondary = { id: 2, view: { webContents: { isDestroyed: () => false, isFocused: () => secondaryFocused } } };
  const state = {
    getActiveTab: () => primary,
    splitSecondaryTab: () => secondary,
    mainWindow: { isDestroyed: () => false, webContents: { isFocused: () => shellFocused } },
    sendToShell: (channel, payload) => sent.push({ channel, tabId: payload.tabId }),
  };
  vm.createContext(state);
  vm.runInContext(implementation(read('main.js'), 'showFindForFocusedPage'), state);
  state.showFindForFocusedPage();
  assert.equal(sent[0].tabId, 2);
  secondaryFocused = false;
  primaryFocused = true;
  state.showFindForFocusedPage();
  assert.equal(sent[1].tabId, 1);
  primaryFocused = false;
  state.showFindForFocusedPage();
  assert.equal(sent.length, 2, 'An unrelated popup must not search the underlying tab');
  shellFocused = true;
  state.showFindForFocusedPage();
  assert.equal(sent[2].tabId, 1);
});

test('browser find searches its requested visible split pane and clears the owning tab', () => {
  const searches = [];
  const stopped = [];
  const makeTab = (id) => ({ id, view: { webContents: {
    findInPage: (query, options) => searches.push({ id, query, options }),
    stopFindInPage: () => stopped.push(id),
  } } });
  const primary = makeTab(1);
  const secondary = makeTab(2);
  const hidden = makeTab(3);
  const state = {
    boundedString: (text) => text,
    assertPlainObject: (value) => value,
    getActiveTab: () => primary,
    splitSecondaryTab: () => secondary,
    tabs: new Map([[1, primary], [2, secondary], [3, hidden]]),
  };
  vm.createContext(state);
  for (const name of ['findInActivePage', 'stopFindActive']) {
    vm.runInContext(implementation(read('main.js'), name), state);
  }
  state.findInActivePage('needle', { tabId: 2, findNext: true });
  assert.equal(searches[0].id, 2);
  assert.equal(searches[0].options.findNext, true);
  assert.equal(state.findInActivePage('needle', { tabId: 3 }), null);
  state.stopFindActive(2);
  assert.deepEqual(stopped, [2]);
});
