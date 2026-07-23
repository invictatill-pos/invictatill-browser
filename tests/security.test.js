'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('the browser core keeps Chromium security boundaries enabled', () => {
  const main = read('main.js');
  const banned = [
    'disable-web-security',
    'disable-gpu-sandbox',
    'allow-running-insecure-content',
    'shared-array-buffer-unrestricted',
    'disable-ipc-flooding-protection',
    'taskkill ',
    'netsh ',
    'reg add ',
    'sc stop ',
    "delete headers['content-security-policy']",
  ];

  for (const token of banned) {
    assert.ok(!main.toLowerCase().includes(token), `Unsafe browser token remains: ${token}`);
  }

  assert.match(main, /WebContentsView/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /setPermissionCheckHandler/);
  assert.match(main, /'camera'/);
  assert.match(main, /'microphone'/);
  assert.match(main, /setDisplayMediaRequestHandler/);
  assert.match(main, /pendingScreenShareRequest/);
  assert.match(main, /isDisplayMediaPipeline/);
  assert.match(main, /details\.mediaTypes\.length === 0/);
  assert.match(main, /enableLocalEcho/);
  assert.match(main, /setWindowOpenHandler/);
});

test('the privileged renderer has a strict script policy and no guest webview', () => {
  const html = read(path.join('renderer', 'index.html'));
  assert.ok(!html.includes('unsafe-eval'));
  assert.ok(!/<webview\b/i.test(html));
  assert.match(html, /object-src\s+'none'/);
  assert.match(html, /base-uri\s+'none'/);
});

test('InvictaTill AI secrets and writing access stay behind the main-process bridge', () => {
  const main = read('main.js');
  const preload = read('preload.js');
  const renderer = read(path.join('renderer', 'renderer.js'));

  assert.match(main, /safeStorage/);
  assert.match(main, /\/api\/v1\/chat/);
  assert.match(main, /\/api\/v1\/writing/);
  assert.match(main, /writingReplacementScript/);
  assert.match(main, /The text changed while InvictaTill AI was working/);
  assert.doesNotMatch(main, /api\.openai\.com|callOpenAi|responsesEndpoint/);
  assert.ok(!/Authorization\s*:/i.test(preload));
  assert.ok(!/Authorization\s*:/i.test(renderer));
  assert.ok(!/invicta_sk_[A-Za-z0-9_-]+/.test(main), 'Embedded InvictaTill service credential remains');
});

test('saved passwords never fall back to plaintext persistence', () => {
  const main = read('main.js');
  assert.match(main, /Secure OS key storage is not available; passwords/);
  assert.doesNotMatch(main, /password:\s*encrypted\s*\?/);
  assert.doesNotMatch(main, /password:\s*item\.password/);
});

test('automatic password capture uses an isolated origin-checked page bridge', () => {
  const main = read('main.js');
  const preload = read('preload.js');
  const remotePreload = read('remote-preload.js');

  assert.match(main, /preload:\s*REMOTE_PRELOAD_FILE/);
  assert.match(main, /trustedCredentialSender/);
  assert.match(main, /new URL\(claimedOrigin\)\.origin !== parsed\.origin/);
  assert.match(main, /pendingCredentialPrompts/);
  assert.match(remotePreload, /credential-submitted/);
  assert.match(remotePreload, /get-page-credential/);
  assert.match(remotePreload, /autocomplete === 'new-password'/);
  assert.doesNotMatch(remotePreload, /contextBridge|exposeInMainWorld/);
  assert.match(preload, /resolve-password-save-request/);
  assert.match(main, /get-saved-passwords[^\n]+publicSavedPasswords/);
  assert.match(main, /autofill payload[\s\S]+credentialId[\s\S]+credential\.domain !== activeDomain/);
});

test('live writing suggestions stay origin-checked, reviewed, and away from sensitive fields', () => {
  const main = read('main.js');
  const remotePreload = read('remote-preload.js');

  assert.match(main, /trustedWritingSender/);
  assert.match(main, /request-live-writing-suggestion/);
  assert.match(main, /new URL\(claimedOrigin\)\.origin !== parsed\.origin/);
  assert.match(main, /if \(privateInstance \|\| !event/);
  assert.match(remotePreload, /get-live-writing-preference/);
  assert.match(remotePreload, /request-live-writing-suggestion/);
  assert.match(remotePreload, /event\.isTrusted/);
  assert.match(remotePreload, /setRangeText/);
  assert.match(remotePreload, /password\|passcode\|login/);
  assert.match(remotePreload, /payment\|card\|cvv\|cvc/);
  assert.match(remotePreload, /search\|query\|find/);
  assert.match(remotePreload, /currentSentence|CurrentSentence|Current Sentence|Current sentence/);
  assert.doesNotMatch(remotePreload, /contextBridge|exposeInMainWorld|Authorization\s*:/i);
});

test('WhatsApp compatibility is isolated to its sandboxed persistent surface', () => {
  const main = read('main.js');
  const preload = read('preload.js');

  assert.match(main, /persist:invictatill-whatsapp/);
  assert.match(main, /function chromeCompatibilityUserAgent/);
  assert.match(main, /function isWhatsAppWebUrl/);
  assert.match(main, /Chrome\/' \+ chromeVersion \+ ' Safari\/537\.36/);
  assert.match(main, /function ensureWhatsappSurface/);
  assert.match(main, /backgroundThrottling:\s*false/);
  assert.doesNotMatch(main, /appendSwitch\(['"]user-agent/);
  assert.match(preload, /set-whatsapp-panel/);
  assert.match(preload, /reload-whatsapp-panel/);
});
