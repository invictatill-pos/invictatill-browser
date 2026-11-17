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

test('sidebar sites use validated HTTP(S) addresses and the trusted shell bridge', () => {
  const main = read('main.js');
  const preload = read('preload.js');

  assert.match(main, /'https:\/\/chatgpt\.com\/'/);
  assert.match(main, /const url = safeRemoteUrl\(payload\.url\)/);
  assert.match(main, /if \(!parsed \|\| parsed\.username \|\| parsed\.password\)/);
  assert.match(main, /registerHandler\('set-sidebar-panel'/);
  assert.match(main, /registerHandler\('open-sidebar-panel-tab'/);
  assert.match(preload, /setSidebarPanel: \(details\) => ipcRenderer\.invoke\('set-sidebar-panel', details\)/);
  assert.match(preload, /openSidebarPanelTab: \(id\) => ipcRenderer\.invoke\('open-sidebar-panel-tab', id\)/);
  assert.doesNotMatch(main + preload, /api\.openai\.com|ask-invicta-ai|ai_config_v2|invicta-sk-|hf\.space\/api/);
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

test('normal tabs expose modern Chromium compatibility without weakening isolation', () => {
  const main = read('main.js');

  assert.match(main, /sess\.setUserAgent\(chromeCompatibilityUserAgent\(\)/);
  assert.match(main, /browserSession\.setUserAgent\(chromeCompatibilityUserAgent\(\)/);
  assert.match(main, /configureSessionClientHints/);
  assert.match(main, /"Google Chrome";v=/);
  assert.match(main, /autoplay-policy/);
  assert.match(main, /enable-gpu-rasterization/);
  assert.match(main, /isHtmlFullscreen/);
  assert.match(main, /plugins:\s*true/);
  assert.match(main, /javascript:\s*true/);
  assert.match(main, /images:\s*true/);
  assert.match(main, /webgl:\s*true/);
  assert.match(main, /webSecurity:\s*true/);
  assert.match(main, /isAllowedFileUrl/);
  assert.match(main, /isAllowedDataUrl/);
  assert.match(main, /isAllowedBlobUrl/);
  assert.match(main, /confirmOpenExternalUrl/);
  assert.match(main, /remoteToLocal/);
});

test('login popups, passkeys, hardware, and certificates have explicit browser flows', () => {
  const main = read('main.js');

  assert.match(main, /did-create-window/);
  assert.match(main, /popupOwnerTabIds/);
  assert.match(main, /overrideBrowserWindowOptions:[\s\S]+preload:\s*REMOTE_PRELOAD_FILE/);
  assert.match(main, /candidateUrl = \(!requestedUrl \|\| requestedUrl === 'about:blank'\)/);
  assert.match(main, /nestedPopup/);
  assert.match(main, /select-webauthn-account/);
  assert.match(main, /select-hid-device/);
  assert.match(main, /select-usb-device/);
  assert.match(main, /select-serial-port/);
  assert.match(main, /select-bluetooth-device/);
  assert.match(main, /select-client-certificate/);
  assert.match(main, /app\.on\('certificate-error'/);
  assert.match(main, /Continue \(unsafe\)/);
  assert.doesNotMatch(main, /ignore-certificate-errors|allow-insecure-localhost/);
});

test('password handling covers multi-step and shadow-DOM logins plus HTTP auth reuse', () => {
  const main = read('main.js');
  const preload = read('preload.js');
  const remotePreload = read('remote-preload.js');

  assert.match(remotePreload, /querySelectorAllDeep/);
  assert.match(remotePreload, /shadowRoot\.mode === 'open'/);
  assert.match(remotePreload, /credential-username-observed/);
  assert.match(main, /recentCredentialUsernames/);
  assert.match(main, /savedCredentialId/);
  assert.match(preload, /credentialId/);
  assert.match(main, /credential\.domain === entry\.domain/);
  assert.match(main, /generatedStrongPassword/);
  assert.match(main, /Use a generated strong password/);
  assert.match(main, /crypto\.randomBytes/);
});

test('ChatGPT selection action copies text on command and excludes password fields', () => {
  const main = read('main.js');
  const remotePreload = read('remote-preload.js');

  assert.match(main, /params\.formControlType === 'input-password'\) return;/);
  assert.match(main, /label: 'Copy selection and open ChatGPT',[\s\S]*?clipboard\.writeText\(selection\)/);
  assert.doesNotMatch(main + remotePreload, /request-live-writing-suggestion|get-live-writing-preference/);
  assert.doesNotMatch(remotePreload, /open-chatgpt|contextBridge|exposeInMainWorld|Authorization\s*:/i);
});

test('WhatsApp compatibility is isolated to its sandboxed persistent surface', () => {
  const main = read('main.js');
  const preload = read('preload.js');

  assert.match(main, /persist:invictatill-whatsapp/);
  assert.match(main, /function chromeCompatibilityUserAgent/);
  assert.match(main, /function isWhatsAppWebUrl/);
  assert.match(main, /Chrome\/' \+ chromeVersion \+ ' Safari\/537\.36/);
  assert.match(main, /isWhatsApp \? getWhatsappSession\(\) : getWorkspaceSession\(workspaceId\)/);
  assert.match(main, /function ensureSidebarSurface[\s\S]*?sandbox: true,[\s\S]*?contextIsolation: true,[\s\S]*?nodeIntegration: false/);
  assert.doesNotMatch(main, /appendSwitch\(['"]user-agent/);
  assert.match(preload, /set-sidebar-panel/);
  assert.match(preload, /reload-sidebar-panel/);
});
