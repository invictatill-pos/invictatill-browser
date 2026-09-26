'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const functionNames = [
  'workspacePartitionName', 'getWorkspaceSession', 'sanitizeFilename', 'uniquePath',
  'publicDownload', 'updateDownloadRecord', 'configureDownloads', 'getDownloads',
  'downloadAction', 'sanitizeDownloadRecord',
];
const functions = functionNames.map((name) => {
  const match = source.match(new RegExp('^function ' + name + '\\([^]*?^\\}', 'm'));
  assert.ok(match, 'Missing main function: ' + name);
  return match[0];
}).join('\n');

function fakeSession() {
  const session = new EventEmitter();
  session.downloads = [];
  session.downloadURL = (url) => session.downloads.push(url);
  session.setUserAgent = () => {};
  session.setSpellCheckerEnabled = () => {};
  session.setSpellCheckerLanguages = () => {};
  return session;
}

function harness(options = {}) {
  const browserSession = fakeSession();
  const whatsappSession = fakeSession();
  const partitions = [];
  const remoteTabs = new Map();
  const cleanedContents = [];
  const safeRemoteUrl = (url) => /^https?:\/\//.test(url || '') ? url : '';
  const context = vm.createContext({
    Date, Math, Number, Boolean, String, URL, path,
    fs: { existsSync: () => false },
    app: { getPath: () => path.join(__dirname, 'downloads') },
    privateInstance: Boolean(options.privateInstance),
    activeWorkspaceId: 'default',
    workspaceList: [{ id: 'default' }, { id: 'work' }, { id: 'personal' }],
    workspaceSessionsMap: new Map(),
    configuredDownloadSessions: new WeakSet(),
    session: { fromPartition: (name, partitionOptions) => {
      const created = fakeSession();
      partitions.push({ name, options: partitionOptions, session: created });
      return created;
    } },
    browserSession,
    getWhatsappSession: () => whatsappSession,
    extensionManager: null,
    chromeCompatibilityUserAgent: () => 'test-agent',
    configurePermissions: () => {},
    configureDeviceSelection: () => {},
    configureScreenSharePicker: () => {},
    configureSessionClientHints: () => {},
    downloadRecords: [],
    liveDownloads: new Map(),
    MAX_DOWNLOADS: 500,
    MAX_URL_LENGTH: 8192,
    scheduleDownloadsSave: () => {},
    sendToShell: () => {},
    safeRemoteUrl,
    isAllowedRemoteUrl: (url) => Boolean(safeRemoteUrl(url)),
    isAllowedDownloadUrl: (url) => /^(https?:|blob:|data:)/.test(url || '') ? url : '',
    isPlainObject: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    boundedString: (value) => String(value),
    tabForRemoteContents: (contents) => remoteTabs.get(contents) || null,
    cleanupDownloadTab: (contents) => {
      assert.equal(context.liveDownloads.size, 1, 'Download tracked before its empty tab closes');
      cleanedContents.push(contents);
    },
  });
  vm.runInContext(functions, context);
  return { context, browserSession, whatsappSession, partitions, remoteTabs, cleanedContents };
}

function startDownload(session, contents, url = 'https://reports.example/export') {
  const item = new EventEmitter();
  item.getURL = () => url;
  item.getFilename = () => 'report.xlsx';
  item.getMimeType = () => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  item.getTotalBytes = () => 100;
  item.getReceivedBytes = () => 25;
  item.isPaused = () => false;
  item.canResume = () => false;
  item.setSavePath = (value) => { item.savePath = value; };
  session.emit('will-download', { preventDefault: () => { item.prevented = true; } }, item, contents);
  return item;
}

test('workspace download retries keep the authenticated session after switching workspace', () => {
  const { context, browserSession, partitions, cleanedContents } = harness();
  const originalSession = context.getWorkspaceSession('work');
  const contents = { id: 12 };
  const item = startDownload(originalSession, contents);
  const original = context.downloadRecords[0];
  assert.equal(original.sessionKind, 'workspace');
  assert.equal(original.workspaceId, 'work');
  assert.equal(original.canRetry, true);
  assert.equal(cleanedContents[0], contents);
  item.emit('done', {}, 'interrupted');
  context.activeWorkspaceId = 'personal';
  context.downloadAction(original.id, 'retry');
  assert.deepEqual(originalSession.downloads, [original.url]);
  assert.deepEqual(browserSession.downloads, []);
  assert.equal(partitions.length, 1);
});

test('saved download metadata restores its workspace and stopped state', () => {
  const { context, partitions } = harness();
  const saved = context.sanitizeDownloadRecord({
    id: 'saved', url: 'https://reports.example/export', sessionKind: 'workspace',
    workspaceId: 'work', filename: 'report.xlsx', state: 'progressing',
  });
  assert.equal(saved.state, 'interrupted');
  assert.match(saved.error, /browser closed/);
  context.downloadRecords.push(saved);
  context.downloadAction(saved.id, 'retry');
  assert.equal(partitions[0].name, 'persist:workspace_work');
  assert.deepEqual(partitions[0].session.downloads, [saved.url]);
  assert.equal(context.getDownloads()[0].workspaceId, 'work');
});

test('legacy records and removed workspaces never borrow another login session', () => {
  const { context, browserSession, partitions } = harness();
  context.downloadRecords.push(context.sanitizeDownloadRecord({
    id: 'legacy', url: 'https://reports.example/export',
  }));
  assert.throws(() => context.downloadAction('legacy', 'retry'), /no session information/);
  const removed = context.sanitizeDownloadRecord({
    id: 'removed', url: 'https://reports.example/export',
    sessionKind: 'workspace', workspaceId: 'removed-workspace',
  });
  context.downloadRecords.push(removed);
  assert.throws(() => context.downloadAction('removed', 'retry'), /workspace was removed/);
  assert.equal(context.publicDownload(removed).canRetry, false);
  assert.deepEqual(browserSession.downloads, []);
  assert.deepEqual(partitions, []);
});

test('WhatsApp and browser downloads retry their own sessions', () => {
  const { context, browserSession, whatsappSession } = harness();
  context.configureDownloads(whatsappSession, { sessionKind: 'whatsapp' });
  const item = startDownload(whatsappSession, { id: 31 });
  const whatsappDownload = context.downloadRecords[0];
  item.emit('done', {}, 'cancelled');
  context.downloadAction(whatsappDownload.id, 'retry');
  assert.deepEqual(whatsappSession.downloads, [whatsappDownload.url]);
  assert.deepEqual(browserSession.downloads, []);
  context.configureDownloads(browserSession);
  startDownload(browserSession, { id: 32 });
  const browserDownload = context.downloadRecords[1];
  context.downloadAction(browserDownload.id, 'retry');
  assert.deepEqual(browserSession.downloads, [browserDownload.url]);
});

test('private retries reuse their in-memory workspace partition', () => {
  const { context, partitions } = harness({ privateInstance: true });
  const originalSession = context.getWorkspaceSession('work');
  const item = startDownload(originalSession, { id: 41 });
  item.emit('done', {}, 'interrupted');
  context.activeWorkspaceId = 'personal';
  context.downloadAction(context.downloadRecords[0].id, 'retry');
  assert.equal(partitions.length, 1);
  assert.equal(partitions[0].name, 'workspace_priv_work');
  assert.equal(partitions[0].options.inMemory, true);
  assert.equal(originalSession.downloads.length, 1);
});

test('POST exports retain their original submission requirement across saves', () => {
  const { context, remoteTabs } = harness();
  const workspaceSession = context.getWorkspaceSession('work');
  const contents = { id: 51 };
  remoteTabs.set(contents, { pendingInitialNavigation: true, openedWithPost: true });
  const item = startDownload(workspaceSession, contents);
  item.emit('done', {}, 'interrupted');
  const saved = context.sanitizeDownloadRecord(context.downloadRecords[0]);
  context.downloadRecords = [saved];
  assert.equal(saved.requestMethod, 'POST');
  const displayed = context.publicDownload(saved);
  assert.equal(displayed.canRetry, false);
  assert.match(displayed.retryUnavailableReason, /export again/);
  assert.throws(() => context.downloadAction(saved.id, 'retry'), /original form submission/);
  assert.deepEqual(workspaceSession.downloads, []);
});

test('session setup is idempotent and generated file URLs cannot be retried as remote URLs', () => {
  const { context } = harness();
  const workspaceSession = context.getWorkspaceSession('work');
  context.configureDownloads(workspaceSession, { sessionKind: 'workspace', workspaceId: 'work' });
  const item = startDownload(workspaceSession, { id: 61 }, 'blob:https://reports.example/generated-file');
  assert.equal(context.downloadRecords.length, 1);
  item.emit('done', {}, 'interrupted');
  const download = context.downloadRecords[0];
  assert.equal(download.canRetry, false);
  assert.throws(() => context.downloadAction(download.id, 'retry'), /original page/);
  assert.deepEqual(workspaceSession.downloads, []);
});

test('download cleanup retains explicitly blank report pages and only closes unused attachment tabs', () => {
  const closed = [];
  const deferred = [];
  const contents = { getURL: () => 'about:blank', isDestroyed: () => false };
  const tab = {
    id: 71, url: 'about:blank', pageOwned: true,
    pendingInitialNavigation: true, view: { webContents: contents },
  };
  const context = vm.createContext({
    tabs: new Map([[tab.id, tab]]),
    setImmediate: (callback) => deferred.push(callback),
    closeTab: (id, options) => closed.push({ id, skipHistory: options.skipHistory }),
  });
  const cleanup = source.match(/^function cleanupDownloadTab\([^]*?^\}/m);
  assert.ok(cleanup, 'Missing download tab cleanup');
  vm.runInContext(cleanup[0], context);

  // document.write can populate about:blank without a committed navigation.
  context.cleanupDownloadTab(contents);
  assert.equal(deferred.length, 0);
  assert.deepEqual(closed, []);

  tab.url = 'https://reports.example/attachment';
  context.cleanupDownloadTab(contents);
  assert.equal(deferred.length, 1);
  assert.deepEqual(closed, [], 'Attachment tab closes only after the transfer is handed off');
  deferred.shift()();
  assert.deepEqual(closed, [{ id: tab.id, skipHistory: true }]);

  closed.length = 0;
  context.cleanupDownloadTab(contents);
  tab.pendingInitialNavigation = false;
  deferred.shift()();
  assert.deepEqual(closed, [], 'A newly committed page is kept during deferred cleanup');
});
