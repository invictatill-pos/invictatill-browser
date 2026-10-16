'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8').replace(/\r\n/g, '\n');

function implementation(name) {
  const match = source.match(new RegExp('^function ' + name + '\\([^]*?^\\}', 'm'));
  assert.ok(match, 'Missing main function: ' + name);
  return match[0];
}

function ipcImplementation(channel) {
  const start = source.indexOf("  registerHandler('" + channel + "',");
  assert.notEqual(start, -1, 'Missing IPC handler: ' + channel);
  const end = source.indexOf('\n  });', start);
  assert.notEqual(end, -1, 'Missing IPC handler end: ' + channel);
  return source.slice(start, end + '\n  });'.length);
}

const credentialFunctions = [
  'secureStorageAvailable', 'normalizeCredentialOrigin', 'normalizeCredentialDomain',
  'findSavedCredential', 'latestSavedCredential', 'rememberCredentialUsername',
  'recentCredentialUsername', 'saveCredential', 'credentialForOrigin',
  'publicSavedPasswords', 'queueCredentialSavePrompt', 'resolveCredentialSavePrompt',
  'loadSavedPasswords', 'savePasswordsToStore', 'completeHttpAuthRequest',
].map(implementation).join('\n');

function fixture(raw = []) {
  const persisted = new Map([['workspace_passwords_v1', raw]]);
  const notifications = [];
  const handlers = new Map();
  const contents = { id: 1, getURL: () => 'https://example.test/login' };
  const tab = { id: 1, view: { webContents: contents } };
  const context = vm.createContext({
    URL, Date, Math, Number, String, Boolean, Buffer,
    privateInstance: false,
    savedPasswords: [],
    recentCredentialUsernames: new Map(),
    pendingCredentialPrompts: new Map(),
    pendingHttpAuthCallbacks: new Map(),
    tabs: new Map([[tab.id, tab]]),
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from('encrypted:' + value),
      decryptString: (value) => value.toString().replace(/^encrypted:/, ''),
    },
    store: {
      get: (key, fallback) => persisted.has(key) ? persisted.get(key) : fallback,
      set: (key, value) => persisted.set(key, value),
    },
    boundedString: (value, name, maxLength, allowEmpty) => {
      assert.equal(typeof value, 'string', name);
      assert.ok(value.length <= maxLength && (allowEmpty || value.length > 0), name);
      return value;
    },
    assertPlainObject: (value) => assert.ok(value && typeof value === 'object' && !Array.isArray(value)),
    isPlainObject: (value) => value && typeof value === 'object' && !Array.isArray(value),
    setTimeout: () => ({ unref() {} }), clearTimeout: () => {},
    setImmediate: (callback) => callback(),
    sendToShell: (channel, payload) => notifications.push({ channel, payload }),
    resizeTabViewToCurrentLayout: () => {}, resizeViews: () => {},
    registerHandler: (channel, handler) => handlers.set(channel, handler),
    getActiveTab: () => tab,
    tabForRemoteContents: (candidate) => candidate === contents ? tab : null,
    app: new EventEmitter(),
  });
  vm.runInContext(credentialFunctions, context);
  vm.runInContext(ipcImplementation('autofill-credentials'), context);
  vm.runInContext(ipcImplementation('respond-http-auth'), context);
  const loginStart = source.indexOf("app.on('login',");
  const loginEnd = source.indexOf('\n});', loginStart);
  assert.ok(loginStart >= 0 && loginEnd > loginStart, 'Missing login listener');
  vm.runInContext(source.slice(loginStart, loginEnd + '\n});'.length), context);
  return { context, persisted, notifications, handlers, contents, tab };
}

function save(context, origin = 'https://example.test', password = 'https-secret') {
  context.saveCredential({ origin, username: 'reader', password });
  return context.savedPasswords.find((item) => item.origin === origin);
}

test('password lookup and updates keep scheme, hostname, and port isolated', () => {
  const { context, persisted } = fixture();
  save(context);
  assert.equal(context.credentialForOrigin('https://EXAMPLE.test:443/login').password, 'https-secret');
  for (const other of ['http://example.test', 'https://www.example.test', 'https://example.test:8443']) {
    assert.equal(context.credentialForOrigin(other), null, other);
  }
  save(context, 'http://example.test', 'http-secret');
  save(context, 'https://www.example.test', 'www-secret');
  save(context, 'https://example.test', 'updated-https-secret');
  assert.equal(context.savedPasswords.length, 3);
  assert.equal(context.credentialForOrigin('https://example.test').password, 'updated-https-secret');
  assert.equal(context.credentialForOrigin('http://example.test').password, 'http-secret');
  assert.equal(context.credentialForOrigin('https://www.example.test').password, 'www-secret');
  for (const item of persisted.get('workspace_passwords_v1')) {
    assert.ok(item.origin && item.encrypted);
    assert.equal(Object.hasOwn(item, 'password'), false);
  }
  assert.equal(context.publicSavedPasswords()[0].domain, 'example.test');
  assert.equal(Object.hasOwn(context.publicSavedPasswords()[0], 'password'), false);
});

test('legacy passwords migrate to HTTPS while explicit saved origins survive a reload', () => {
  const encrypted = Buffer.from('encrypted:legacy-secret').toString('hex');
  const { context, persisted } = fixture([
    { id: 'legacy', domain: 'example.test', username: 'reader', encrypted },
    { id: 'explicit-http', domain: 'other.test', origin: 'http://other.test', username: 'reader', encrypted },
    { id: 'explicit-www', domain: 'example.test', origin: 'https://www.example.test', username: 'reader', encrypted },
    { id: 'invalid', domain: 'example.test', origin: 'file:///passwords', username: 'reader', encrypted },
  ]);
  context.loadSavedPasswords();
  assert.equal(context.savedPasswords.length, 3);
  assert.equal(context.credentialForOrigin('https://example.test').password, 'legacy-secret');
  assert.equal(context.credentialForOrigin('http://example.test'), null);
  assert.equal(context.credentialForOrigin('http://other.test').password, 'legacy-secret');
  assert.equal(context.credentialForOrigin('https://www.example.test').password, 'legacy-secret');
  assert.equal(persisted.get('workspace_passwords_v1').find((item) => item.id === 'legacy').origin, 'https://example.test');
  context.savedPasswords = [];
  context.loadSavedPasswords();
  assert.equal(context.savedPasswords.find((item) => item.id === 'explicit-http').origin, 'http://other.test');
});

test('save prompts preserve exact origins and do not merge same-host credentials', () => {
  const { context, tab, notifications } = fixture();
  const payload = { username: 'reader', password: 'same-secret' };
  assert.equal(context.queueCredentialSavePrompt(payload, { tab, origin: 'https://example.test' }), true);
  assert.equal(context.queueCredentialSavePrompt(payload, { tab, origin: 'http://example.test' }), true);
  assert.equal(context.queueCredentialSavePrompt(payload, { tab, origin: 'https://example.test' }), false);
  const requests = notifications.filter((item) => item.channel === 'password-save-request');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].payload.origin, 'https://example.test');
  for (const request of requests) context.resolveCredentialSavePrompt(request.payload.requestId, 'save');
  assert.equal(context.savedPasswords.length, 2);
  assert.equal(context.credentialForOrigin('http://example.test').password, 'same-secret');
});

test('manual autofill rejects other origins and rechecks the executing document', async () => {
  const { context, contents, handlers } = fixture();
  const credential = save(context);
  const scripts = [];
  contents.executeJavaScript = (code) => { scripts.push(code); return Promise.resolve(); };
  const autofill = handlers.get('autofill-credentials');
  for (const other of ['http://example.test', 'https://www.example.test', 'https://example.test:8443']) {
    contents.getURL = () => other;
    assert.equal(autofill({}, { id: credential.id }), false, other);
  }
  assert.equal(scripts.length, 0);
  contents.getURL = () => 'https://example.test/login';
  assert.equal(autofill({}, { id: credential.id }), true);
  assert.equal(scripts.length, 1);
  const changedDocument = vm.createContext({
    location: { origin: 'http://example.test' },
    document: { querySelectorAll: () => assert.fail('Autofill touched a different origin') },
  });
  assert.equal(vm.runInContext(scripts[0], changedDocument), false);
});

function challenge(fx, url, isProxy = false) {
  const responses = [];
  let prevented = false;
  fx.context.app.emit('login', { preventDefault: () => { prevented = true; } }, fx.contents,
    { url }, { host: isProxy ? 'proxy.test' : 'example.test', port: 443, isProxy, scheme: 'basic' },
    (...args) => responses.push(args));
  assert.equal(prevented, true);
  const notification = fx.notifications.filter((item) => item.channel === 'http-auth-request').at(-1);
  return { request: notification.payload, responses };
}

test('HTTP authentication reuses only the challenge origin and never guesses a missing origin', () => {
  const fx = fixture();
  const credential = save(fx.context);
  const secure = challenge(fx, 'https://example.test/private');
  assert.equal(secure.request.savedCredentialId, credential.id);
  fx.handlers.get('respond-http-auth')({}, { requestId: secure.request.requestId, credentialId: credential.id });
  assert.deepEqual(secure.responses, [['reader', 'https-secret']]);
  for (const url of ['http://example.test/private', 'https://www.example.test/private', '']) {
    const other = challenge(fx, url);
    assert.equal(other.request.savedCredentialId, '', url);
    fx.handlers.get('respond-http-auth')({}, { requestId: other.request.requestId, credentialId: credential.id });
    assert.deepEqual(other.responses, [[]]);
  }
});

test('proxy authentication neither exposes nor saves destination credentials', () => {
  const fx = fixture();
  const credential = save(fx.context);
  const savedAttempt = challenge(fx, 'https://example.test/private', true);
  assert.equal(savedAttempt.request.savedCredentialId, '');
  const pending = fx.context.pendingHttpAuthCallbacks.get(savedAttempt.request.requestId);
  assert.equal(pending.origin, '');
  assert.equal(pending.isProxy, true);
  fx.handlers.get('respond-http-auth')({}, { requestId: savedAttempt.request.requestId, credentialId: credential.id });
  assert.deepEqual(savedAttempt.responses, [[]]);
  const manual = challenge(fx, 'https://example.test/private', true);
  fx.handlers.get('respond-http-auth')({}, {
    requestId: manual.request.requestId, username: 'proxy-user', password: 'proxy-secret',
  });
  assert.deepEqual(manual.responses, [['proxy-user', 'proxy-secret']]);
  assert.equal(fx.context.pendingCredentialPrompts.size, 0);
  assert.equal(fx.context.savedPasswords.length, 1);
  assert.equal(fx.notifications.some((item) => item.channel === 'password-save-request'), false);
});

test('WhatsApp camera and microphone use explicit permission decisions', async () => {
  const fx = fixture();
  const grants = {};
  const prompts = [];
  const sess = {
    setUserAgent() {}, setSpellCheckerEnabled() {}, setSpellCheckerLanguages() {},
    setPermissionCheckHandler(handler) { this.check = handler; },
    setPermissionRequestHandler(handler) { this.request = handler; },
  };
  Object.assign(fx.context, {
    whatsappSession: null,
    WHATSAPP_PARTITION: 'persist:invictatill-whatsapp',
    permissionGrants: grants,
    session: { fromPartition: () => sess },
    chromeCompatibilityUserAgent: () => 'test-agent',
    configureDeviceSelection: () => {}, configureScreenSharePicker: () => {},
    configureDownloads: () => {}, configureSessionClientHints: () => {},
    mainWindow: { isDestroyed: () => false },
    dialog: { showMessageBox: async (_window, options) => {
      prompts.push(options);
      return { response: 1 };
    } },
  });
  const permissionStart = source.indexOf('const PROMPTABLE_PERMISSIONS = new Set([');
  const permissionEnd = source.indexOf('\n]);', permissionStart);
  vm.runInContext(source.slice(permissionStart, permissionEnd + '\n]);'.length), fx.context);
  vm.runInContext([
    'permissionOrigin', 'permissionKeys', 'permissionLabel', 'savePermissionGrants',
    'configurePermissions', 'getWhatsappSession',
  ].map(implementation).join('\n'), fx.context);
  assert.equal(fx.context.getWhatsappSession(), sess);
  assert.deepEqual(grants, {});
  const origin = 'https://web.whatsapp.com';
  assert.equal(sess.check(null, 'camera', origin, {}), false);
  let allowed = null;
  await sess.request(null, 'camera', (value) => { allowed = value; }, { requestingUrl: origin });
  assert.equal(allowed, true);
  assert.equal(prompts.length, 1);
  assert.equal(sess.check(null, 'camera', origin, {}), true);
  grants[origin + '|microphone'] = false;
  await sess.request(null, 'microphone', (value) => { allowed = value; }, { requestingUrl: origin });
  assert.equal(allowed, false);
  assert.equal(prompts.length, 1);
  fx.context.whatsappSession = null;
  fx.context.getWhatsappSession();
  assert.equal(grants[origin + '|camera'], true);
  assert.equal(grants[origin + '|microphone'], false);
});
