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

test('cloud AI secrets stay behind the main-process bridge', () => {
  const main = read('main.js');
  const preload = read('preload.js');
  const renderer = read(path.join('renderer', 'renderer.js'));

  assert.match(main, /safeStorage/);
  assert.match(main, /\/responses/);
  assert.match(main, /\/api\/v1\/chat/);
  assert.match(main, /raw\.provider === 'openai' \? 'openai' : 'local'|raw\.provider === 'openai'/);
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
