'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
if (process.env.INVICTA_E2E_DEBUG === '1') process.env.DEBUG = 'pw:browser*';
const { _electron: electron } = require('playwright-core');

const root = path.resolve(__dirname, '..');

async function poll(fn, predicate, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let value;
  while (Date.now() < deadline) {
    value = await fn();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(value)}`);
}

async function main() {
  const log = (message) => process.stdout.write(`→ ${message}\n`);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invictatill-e2e-'));
  const screenshotDir = process.env.INVICTA_E2E_SCREENSHOT_DIR
    ? path.resolve(process.env.INVICTA_E2E_SCREENSHOT_DIR)
    : null;
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  let whatsappRequestUserAgent = '';
  const server = http.createServer((request, response) => {
    if ((request.url === '/api/v1/status' || request.url === '/fallback/api/v1/status') &&
        request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (request.url === '/fallback/api/v1/chat' && request.method === 'POST') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        const payload = JSON.parse(body || '{}');
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Auth-Token': 'invicta-cloud-test-token',
        });
        response.end(JSON.stringify({
          reply: `Invicta cloud fallback received: ${payload.message || ''}`,
        }));
      });
      return;
    }
    if ((request.url === '/api/v1/writing' || request.url === '/fallback/api/v1/writing') &&
        request.method === 'POST') {
      const authorized = request.url.startsWith('/fallback/') ||
        request.headers.authorization === 'Bearer invicta-test-key';
      response.writeHead(authorized ? 200 : 401, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(authorized
        ? { text: 'I definitely receive the report.' }
        : { error: 'Unauthorized' }));
      return;
    }
    if (request.url === '/api/v1/chat' && request.method === 'POST') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        const payload = JSON.parse(body || '{}');
        const authorized = request.headers.authorization === 'Bearer invicta-test-key';
        response.writeHead(authorized ? 200 : 401, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(authorized
          ? { reply: `Invicta service received: ${payload.message || ''}` }
          : { error: 'Unauthorized' }));
      });
      return;
    }
    if (request.url === '/download-test') {
      const chunk = Buffer.alloc(32 * 1024, 'i');
      const totalChunks = 16;
      let sent = 0;
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="invicta-download-test.txt"',
        'Content-Length': String(chunk.length * totalChunks),
      });
      const timer = setInterval(() => {
        if (sent >= totalChunks || response.destroyed) {
          clearInterval(timer);
          if (!response.destroyed) response.end();
          return;
        }
        response.write(chunk);
        sent += 1;
      }, 60);
      return;
    }
    if (request.url === '/second') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Second test page</title><h1>Second page</h1>');
      return;
    }
    if (request.url === '/login-test') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
        <title>Credential test page</title>
        <main>
          <h1>Sign in</h1>
          <form id="login-test-form">
            <label>Email <input id="login-user" name="username" type="email" autocomplete="username"></label>
            <label>Password <input id="login-password" name="password" type="password" autocomplete="current-password"></label>
            <button type="submit">Sign in</button>
          </form>
        </main>
        <script>document.getElementById('login-test-form').addEventListener('submit', function (event) { event.preventDefault(); });</script>`);
      return;
    }
    if (request.url === '/writing-test') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
        <title>Live writing test page</title>
        <style>
          body{margin:40px;background:#eef4f7;color:#142231;font:16px system-ui}
          main{max-width:760px;margin:auto;padding:30px;border-radius:18px;background:white;box-shadow:0 14px 40px #24394d22}
          [contenteditable],input{box-sizing:border-box;width:100%;margin-top:8px;padding:14px;border:1px solid #8ba0ad;border-radius:10px;font:16px system-ui}
          [contenteditable]{min-height:180px;background:white;font-weight:400}
          label{display:block;margin-top:18px;font-weight:700}
        </style>
        <main>
          <h1>Draft a message</h1>
          <label>Message<div id="writing-draft" contenteditable="true" role="textbox" aria-label="Message draft"></div></label>
          <label>Private value<input id="writing-password" type="password" autocomplete="current-password"></label>
        </main>`);
      return;
    }
    if (request.url === '/whatsapp-test') {
      whatsappRequestUserAgent = String(request.headers['user-agent'] || '');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
        <title>WhatsApp panel test</title>
        <style>
          html,body{height:100%;margin:0;background:#0b141a;color:#e9edef;font:16px system-ui}
          main{height:100%;display:grid;place-content:center;text-align:center;background:radial-gradient(circle,#17372d,#0b141a 56%)}
          .mark{width:74px;height:74px;display:grid;place-items:center;margin:0 auto 18px;border:2px solid #25d366;border-radius:50%;color:#25d366;font-size:34px}
          p{color:#8696a0}
        </style>
        <main><div><div class="mark">W</div><h1>WhatsApp side panel</h1><p>Persistent workspace session ready</p><output id="ua"></output></div></main>
        <script>document.getElementById('ua').textContent = navigator.userAgent;</script>`);
      return;
    }
    if (request.url.startsWith('/visual-validation')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Visual validation page with an intentionally extensive descriptive title for overflow testing</title><h1>Long history entry</h1>');
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Invicta smoke page</title><main><h1>Verified browser content</h1><p>Orchid nebula is the unique summary phrase.</p><a href="/second">Next</a><a id="download-test" href="/download-test" download>Download</a></main>');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const pageUrl = `http://127.0.0.1:${address.port}/`;
  const electronEnvironment = {
    ...process.env,
    INVICTA_TEST_MODE: '1',
    INVICTA_TEST_DOWNLOAD_DIR: path.join(profileDir, 'downloads'),
    INVICTA_TEST_WHATSAPP_URL: `${pageUrl}whatsapp-test`,
    INVICTA_TEST_AI_FALLBACK_URL: `${pageUrl}fallback/api/v1`,
  };
  delete electronEnvironment.ELECTRON_RUN_AS_NODE;
  let electronApp;
  const cspStyleViolations = [];

  try {
    log('Launching isolated Electron profile');
    electronApp = await electron.launch({
      args: ['.', '--dev', '--test-mode', `--user-data-dir=${profileDir}`],
      cwd: root,
      env: electronEnvironment,
      timeout: 30_000,
    });
    electronApp.on('console', (message) => {
      process.stderr.write(`[electron:${message.type()}] ${message.text()}\n`);
      if (/Refused to apply inline style/i.test(message.text())) cspStyleViolations.push(message.text());
    });

    log('Waiting for browser shell window');
    await electronApp.firstWindow({ timeout: 30_000 });
    const window = await poll(
      () => Promise.resolve(electronApp.windows()),
      (pages) => pages.some((page) => /renderer[\\/]index\.html/i.test(decodeURIComponent(page.url()))),
      30_000,
    ).then((pages) => pages.find((page) => /renderer[\\/]index\.html/i.test(decodeURIComponent(page.url()))));
    await window.waitForLoadState('domcontentloaded');
    const capture = async (fileName) => {
      if (!screenshotDir) return;
      const screenshotPath = path.join(screenshotDir, fileName);
      await window.screenshot({ path: screenshotPath, animations: 'disabled' });
      log(`Saved UI QA screenshot to ${screenshotPath}`);
    };
    const captureRemotePage = async (targetUrl, fileName) => {
      if (!screenshotDir) return;
      const dataUrl = await electronApp.evaluate(async ({ webContents }, url) => {
        const target = webContents.getAllWebContents().find((contents) => contents.getURL() === url);
        if (!target) return '';
        return (await target.capturePage()).toDataURL();
      }, targetUrl);
      if (!dataUrl.startsWith('data:image/png;base64,')) return;
      const screenshotPath = path.join(screenshotDir, fileName);
      fs.writeFileSync(screenshotPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
      log(`Saved page-surface QA screenshot to ${screenshotPath}`);
    };
    const assertViewportContained = async (selectors, label) => {
      const geometry = await window.evaluate((requestedSelectors) => {
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        return {
          viewport,
          documentWidth: document.documentElement.scrollWidth,
          elements: requestedSelectors.map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return { selector, missing: true };
            const rect = element.getBoundingClientRect();
            return {
              selector,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            };
          }),
        };
      }, selectors);
      assert.ok(geometry.documentWidth <= geometry.viewport.width + 1,
        `${label} caused document overflow: ${JSON.stringify(geometry)}`);
      geometry.elements.forEach((item) => {
        assert.equal(item.missing, undefined, `${label} is missing ${item.selector}`);
        assert.ok(item.left >= -1 && item.right <= geometry.viewport.width + 1,
          `${label} pushed ${item.selector} outside the viewport: ${JSON.stringify(item)}`);
      });
      return geometry;
    };
    log('Browser shell loaded');
    assert.equal(await window.title(), 'InvictaTill Browser');
    assert.equal(await window.locator('#btn-ai-drawer').count(), 0,
      'The duplicate toolbar InvictaTill AI button is still present');
    await window.locator('#tabs-container').waitFor({ state: 'visible' });
    const modalParents = await window.evaluate(() => [
      'update-modal-backdrop',
      'site-info-modal-backdrop',
      'add-workspace-modal-backdrop',
      'passwords-modal-backdrop',
      'screen-picker-modal-backdrop',
      'command-backdrop',
    ].map((id) => ({ id, parent: document.getElementById(id).parentElement.tagName })));
    assert.ok(modalParents.every((item) => item.parent === 'BODY'),
      `Expected top-level modal backdrops, received ${JSON.stringify(modalParents)}`);
    const initialLayout = await assertViewportContained([
      '#titlebar', '#tabs-bar', '#nav-bar', '#app-rail', '#btn-whatsapp', '#btn-invicta-ai', '#new-tab-page', '.ntp-content', '#ntp-search-form', '#quick-links',
    ], 'Initial new-tab layout');
    assert.ok(initialLayout.elements.find((item) => item.selector === '.ntp-content').width >= 800,
      'Expected a usable desktop new-tab content width');
    await capture('01-new-tab.png');

    await window.locator('#btn-add-workspace-open').click();
    const workspaceModal = window.locator('#add-workspace-modal-backdrop');
    await workspaceModal.waitFor({ state: 'visible' });
    await assertViewportContained([
      '#add-workspace-modal', '#add-workspace-form', '#ws-input-name', '#ws-icon-picker', '#ws-color-picker',
    ], 'Workspace dialog');
    const colorOptions = await window.locator('#ws-color-picker .ws-color-opt').evaluateAll((options) => options.map((option) => {
      const rect = option.getBoundingClientRect();
      return { width: rect.width, height: rect.height, label: option.getAttribute('aria-label') };
    }));
    assert.ok(colorOptions.every((option) => option.width >= 28 && option.height >= 28 && option.label),
      `Workspace colors are not usable: ${JSON.stringify(colorOptions)}`);
    assert.ok((await window.locator('#ws-input-name').boundingBox()).width >= 480,
      'Workspace name field collapsed instead of filling the form');
    await capture('01a-workspace-dialog.png');
    await window.locator('#btn-close-add-ws').click();
    await workspaceModal.waitFor({ state: 'hidden' });

    await window.locator('#btn-passwords').click();
    const passwordsModal = window.locator('#passwords-modal-backdrop');
    await passwordsModal.waitFor({ state: 'visible' });
    await assertViewportContained([
      '#passwords-modal', '#save-password-form', '#pwd-input-domain', '#pwd-input-username', '#pwd-input-password', '#passwords-list',
    ], 'Password dialog');
    const passwordGridColumns = await window.locator('#save-password-form').evaluate((form) => getComputedStyle(form).gridTemplateColumns);
    assert.match(passwordGridColumns, /\S+\s+\S+/, 'Password dialog did not retain its desktop grid');
    await capture('01b-password-dialog.png');
    await window.locator('#btn-close-passwords').click();
    await passwordsModal.waitFor({ state: 'hidden' });

    await window.locator('#btn-menu').click();
    const browserMenu = window.locator('#browser-menu');
    await browserMenu.waitFor({ state: 'visible' });
    await assertViewportContained(['#browser-menu'], 'Browser menu');
    await window.keyboard.press('Escape');
    await browserMenu.waitFor({ state: 'hidden' });

    await window.locator('#btn-command-center').click();
    const commandPalette = window.locator('#command-backdrop');
    await commandPalette.waitFor({ state: 'visible' });
    await assertViewportContained(['#command-palette', '#command-input', '#command-results'], 'Tab and command search');
    await window.locator('#command-input').fill('open focus sessions');
    assert.equal(await window.locator('#command-results .command-result').count(), 1);
    await capture('06-command-center.png');
    await window.locator('#command-input').press('Enter');
    await window.locator('#drawer-panel-focus').waitFor({ state: 'visible' });
    await window.locator('#btn-close-drawer').click();
    await window.locator('#workspace-drawer').waitFor({ state: 'hidden' });
    log('Tab and command search verified');
    log('Core dialogs and browser menu geometry verified');

    const initial = await window.evaluate(() => window.electronAPI.getBrowserState());
    assert.ok(initial.tabs.length >= 1, 'Expected an initial browser tab');

    await window.locator('#btn-new-tab').click();
    log('Creating a second tab');
    const afterNewTab = await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (state) => state.tabs.length >= initial.tabs.length + 1,
    );
    assert.ok(afterNewTab.activeTabId);

    await window.evaluate((url) => window.electronAPI.navigate(url), pageUrl);
    log('Navigating active tab to controlled page');
    const loaded = await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (state) => state.tabs.some((tab) => tab.id === state.activeTabId && tab.title === 'Invicta smoke page' && !tab.isLoading),
    );
    const active = loaded.tabs.find((tab) => tab.id === loaded.activeTabId);
    assert.equal(active.url, pageUrl);
    assert.equal(active.canGoBack, false);

    const defaultLastTabId = loaded.activeTabId;
    const initialWorkState = await window.evaluate(() => window.electronAPI.setActiveWorkspace('work'));
    const firstWorkTabId = initialWorkState.activeTabId;
    const workMiddle = await window.evaluate((url) => window.electronAPI.newTab(url), pageUrl);
    const workLast = await window.evaluate((url) => window.electronAPI.newTab(url), `${pageUrl}second`);
    assert.notEqual(workMiddle.id, firstWorkTabId);
    assert.notEqual(workLast.id, workMiddle.id);
    await window.evaluate((id) => window.electronAPI.switchTab(id), workMiddle.id);
    const returnedDefault = await window.evaluate(() => window.electronAPI.setActiveWorkspace('default'));
    assert.equal(returnedDefault.activeTabId, defaultLastTabId, 'Default workspace did not restore its last tab');
    const returnedWork = await window.evaluate(() => window.electronAPI.setActiveWorkspace('work'));
    assert.equal(returnedWork.activeTabId, workMiddle.id, 'Work workspace opened its first tab instead of its last active tab');
    const allTabs = await window.evaluate(() => window.electronAPI.getAllTabs());
    assert.ok(allTabs.some((tab) => tab.id === workMiddle.id && tab.workspaceId === 'work'));
    const pinnedWork = await window.evaluate((id) => window.electronAPI.setTabPinned(id, true), workMiddle.id);
    assert.equal(pinnedWork.tabs[0].id, workMiddle.id);
    assert.equal(pinnedWork.tabs[0].pinned, true);
    await window.evaluate((id) => window.electronAPI.setTabPinned(id, false), workMiddle.id);
    await window.evaluate(() => window.electronAPI.setActiveWorkspace('default'));
    await window.evaluate((id) => window.electronAPI.switchTab(id), defaultLastTabId);
    await window.evaluate(() => window.electronAPI.getBrowserState()).then((browserState) => {
      assert.equal(browserState.activeWorkspaceId, 'default');
      assert.equal(browserState.activeTabId, defaultLastTabId);
    });
    log('Per-workspace last-active tab restoration and pinned tabs verified');

    const whatsappUrl = `${pageUrl}whatsapp-test`;
    const tabsBeforeWhatsapp = await window.evaluate(() => window.electronAPI.getAllTabs());
    await window.locator('#btn-whatsapp').click();
    const whatsappPanel = window.locator('#whatsapp-panel');
    await whatsappPanel.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await window.locator('#btn-whatsapp').getAttribute('aria-expanded'), 'true');
    assert.equal(await window.locator('#btn-whatsapp').evaluate((button) => button.classList.contains('active')), true);
    const whatsappState = await poll(
      () => window.evaluate(() => window.electronAPI.getWhatsappPanelState()),
      (panelState) => panelState.visible && panelState.status === 'ready' && panelState.url === whatsappUrl,
    );
    assert.equal(whatsappState.persistent, true);
    assert.ok(whatsappState.bounds.width >= 500 && whatsappState.bounds.height >= 300,
      `WhatsApp view bounds are too small: ${JSON.stringify(whatsappState.bounds)}`);
    const whatsappIdentity = await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) return null;
      return {
        id: target.id,
        userAgent: await target.executeJavaScript('navigator.userAgent', true),
      };
    }, whatsappUrl);
    assert.ok(whatsappIdentity, 'Dedicated WhatsApp surface was not created');
    assert.match(whatsappIdentity.userAgent, /Chrome\/\d+/);
    assert.doesNotMatch(whatsappIdentity.userAgent, /Electron|InvictaTill/i);
    assert.match(whatsappRequestUserAgent, /Chrome\/\d+/);
    assert.doesNotMatch(whatsappRequestUserAgent, /Electron|InvictaTill/i);
    const tabsWithWhatsappPanel = await window.evaluate(() => window.electronAPI.getAllTabs());
    assert.equal(tabsWithWhatsappPanel.length, tabsBeforeWhatsapp.length,
      'Opening the WhatsApp panel unexpectedly created a normal browser tab');
    const whatsappGeometry = await window.evaluate(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector).getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      };
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        rail: rect('#app-rail'),
        panel: rect('#whatsapp-panel'),
        host: rect('#whatsapp-panel-view-host'),
        stage: rect('#browser-stage'),
      };
    });
    assert.ok(Math.abs(whatsappGeometry.panel.left - whatsappGeometry.rail.right) <= 1,
      `WhatsApp panel is detached from its rail: ${JSON.stringify(whatsappGeometry)}`);
    assert.ok(whatsappGeometry.host.top > whatsappGeometry.panel.top
      && Math.abs(whatsappGeometry.host.width - whatsappGeometry.panel.width) <= 2,
      `WhatsApp host does not fill its panel: ${JSON.stringify(whatsappGeometry)}`);
    if (whatsappGeometry.viewport.width > 1100) {
      assert.ok(whatsappGeometry.stage.left >= whatsappGeometry.panel.right - 1,
        `Browser page did not make room for WhatsApp: ${JSON.stringify(whatsappGeometry)}`);
    }
    await capture('01c-whatsapp-panel.png');

    await window.evaluate(() => window.electronAPI.setActiveWorkspace('work'));
    const whatsappAcrossWorkspace = await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      return target ? { id: target.id, userAgent: await target.executeJavaScript('navigator.userAgent', true) } : null;
    }, whatsappUrl);
    assert.equal(whatsappAcrossWorkspace.id, whatsappIdentity.id,
      'Workspace switching recreated the WhatsApp session');
    assert.equal((await window.evaluate(() => window.electronAPI.getWhatsappPanelState())).visible, true);
    await window.evaluate(() => window.electronAPI.setActiveWorkspace('default'));
    await window.evaluate((id) => window.electronAPI.switchTab(id), defaultLastTabId);
    await window.locator('#btn-close-whatsapp').click();
    await whatsappPanel.waitFor({ state: 'hidden' });
    await poll(
      () => window.evaluate(() => window.electronAPI.getWhatsappPanelState()),
      (panelState) => panelState.visible === false,
    );
    await window.locator('#btn-whatsapp').click();
    await whatsappPanel.waitFor({ state: 'visible' });
    await window.locator('#btn-whatsapp-open-tab').click();
    await whatsappPanel.waitFor({ state: 'hidden' });
    const whatsappFullTabState = await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (browserState) => browserState.tabs.find((tab) => tab.id === browserState.activeTabId && tab.url === whatsappUrl),
    );
    const whatsappFullTab = whatsappFullTabState.tabs.find((tab) => tab.id === whatsappFullTabState.activeTabId);
    const whatsappFullTabIdentity = await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents()
        .filter((contents) => contents.getURL() === targetUrl)
        .sort((left, right) => right.id - left.id)[0];
      return target ? target.executeJavaScript('navigator.userAgent', true) : null;
    }, whatsappUrl);
    assert.match(whatsappFullTabIdentity, /Chrome\/\d+/);
    assert.doesNotMatch(whatsappFullTabIdentity, /Electron|InvictaTill/i);
    await window.evaluate((id) => window.electronAPI.closeTab(id), whatsappFullTab.id);
    await window.evaluate((id) => window.electronAPI.switchTab(id), defaultLastTabId);
    log('Opera-style persistent WhatsApp panel and supported full-tab browser identity verified');

    const loginUrl = `${pageUrl}login-test`;
    const loginUsername = 'workspace.user@example.test';
    const firstPassword = 'Invicta-workspace-secret-1!';
    const updatedPassword = 'Invicta-workspace-secret-2!';
    await window.evaluate((url) => window.electronAPI.navigate(url), loginUrl);
    await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (browserState) => browserState.tabs.some((tab) => tab.id === browserState.activeTabId
        && tab.url === loginUrl && tab.title === 'Credential test page' && !tab.isLoading),
    );
    await electronApp.evaluate(async ({ webContents }, details) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === details.url);
      if (!target) throw new Error('Credential test page was not found');
      return target.executeJavaScript(`(() => {
        document.getElementById('login-user').value = ${JSON.stringify(details.username)};
        document.getElementById('login-password').value = ${JSON.stringify(details.password)};
        document.getElementById('login-test-form').requestSubmit();
        return true;
      })()`, true);
    }, { url: loginUrl, username: loginUsername, password: firstPassword });
    const passwordPrompt = window.locator('#password-save-popout');
    await passwordPrompt.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await window.locator('#password-save-title').textContent()).trim(), 'Save password?');
    assert.match(await passwordPrompt.textContent(), /Available for autofill in every normal workspace/);
    assert.match(await window.locator('#password-save-domain').textContent(), /127\.0\.0\.1/);
    assert.equal((await window.locator('#password-save-username').textContent()).trim(), loginUsername);
    assert.doesNotMatch(await passwordPrompt.textContent(), /Invicta-workspace-secret/,
      'Password secret leaked into the shell prompt');
    await assertViewportContained(['#password-save-popout'], 'Password save prompt');
    await capture('01d-password-save-prompt.png');
    await window.locator('#btn-confirm-password-save').click();
    await passwordPrompt.waitFor({ state: 'hidden' });
    const credentialDomain = `127.0.0.1:${address.port}`;
    const savedCredentials = await poll(
      () => window.evaluate(() => window.electronAPI.getSavedPasswords()),
      (items) => items.some((item) => item.domain === credentialDomain && item.username === loginUsername),
    );
    assert.ok(savedCredentials.every((item) => !Object.hasOwn(item, 'password')),
      'Vault metadata exposed a plaintext password to the browser shell');

    await window.evaluate(() => window.electronAPI.setActiveWorkspace('work'));
    const workLoginTab = await window.evaluate((url) => window.electronAPI.newTab(url), loginUrl);
    await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (browserState) => browserState.activeTabId === workLoginTab.id
        && browserState.tabs.some((tab) => tab.id === workLoginTab.id && !tab.isLoading),
    );
    const autofilled = await poll(
      () => electronApp.evaluate(async ({ webContents }, targetUrl) => {
        const target = webContents.getAllWebContents()
          .filter((contents) => contents.getURL() === targetUrl)
          .sort((left, right) => right.id - left.id)[0];
        if (!target) return null;
        return target.executeJavaScript(`({
          username: document.getElementById('login-user').value,
          password: document.getElementById('login-password').value
        })`, true);
      }, loginUrl),
      (values) => values && values.username === loginUsername && values.password === firstPassword,
    );
    assert.deepEqual(autofilled, { username: loginUsername, password: firstPassword });

    await electronApp.evaluate(async ({ webContents }, details) => {
      const target = webContents.getAllWebContents()
        .filter((contents) => contents.getURL() === details.url)
        .sort((left, right) => right.id - left.id)[0];
      if (!target) throw new Error('Work credential page was not found');
      return target.executeJavaScript(`(() => {
        document.getElementById('login-password').value = ${JSON.stringify(details.password)};
        document.getElementById('login-test-form').requestSubmit();
        return true;
      })()`, true);
    }, { url: loginUrl, password: updatedPassword });
    await passwordPrompt.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await window.locator('#password-save-title').textContent()).trim(), 'Update password?');
    await window.locator('#btn-confirm-password-save').click();
    await passwordPrompt.waitFor({ state: 'hidden' });
    await window.evaluate(() => window.electronAPI.reload(true));
    const updatedAutofill = await poll(
      () => electronApp.evaluate(async ({ webContents }, targetUrl) => {
        const target = webContents.getAllWebContents()
          .filter((contents) => contents.getURL() === targetUrl)
          .sort((left, right) => right.id - left.id)[0];
        if (!target) return null;
        return target.executeJavaScript(`({
          username: document.getElementById('login-user') && document.getElementById('login-user').value,
          password: document.getElementById('login-password') && document.getElementById('login-password').value
        })`, true).catch(() => null);
      }, loginUrl),
      (values) => values && values.username === loginUsername && values.password === updatedPassword,
    );
    assert.deepEqual(updatedAutofill, { username: loginUsername, password: updatedPassword });
    log('Encrypted save, update, and cross-workspace password autofill verified');

    await window.evaluate(() => window.electronAPI.setActiveWorkspace('default'));
    await window.evaluate((id) => window.electronAPI.switchTab(id), defaultLastTabId);
    await window.evaluate((url) => window.electronAPI.navigate(url), pageUrl);
    await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (browserState) => browserState.activeWorkspaceId === 'default'
        && browserState.activeTabId === defaultLastTabId
        && browserState.tabs.some((tab) => tab.id === defaultLastTabId && tab.url === pageUrl && !tab.isLoading),
    );

    const longHistoryUrl = `${pageUrl}visual-validation?flow=signin&continue=${'workspace-browser-'.repeat(35)}`;
    await window.evaluate((url) => window.electronAPI.navigate(url), longHistoryUrl);
    await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (browserState) => browserState.tabs.some((tab) => tab.id === browserState.activeTabId
        && /Visual validation page/.test(tab.title) && !tab.isLoading),
    );
    await window.evaluate((url) => window.electronAPI.navigate(url), pageUrl);
    await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (browserState) => browserState.tabs.some((tab) => tab.id === browserState.activeTabId
        && tab.url === pageUrl && !tab.isLoading),
    );
    await window.evaluate(() => window.electronAPI.newTab());
    await window.locator('#ntp-search').fill('visual validation');
    const ntpSuggestion = window.locator('#ntp-suggestions .suggestion-item').first();
    await ntpSuggestion.waitFor({ state: 'visible' });
    const suggestionLayout = await window.evaluate(() => {
      const menu = document.getElementById('ntp-suggestions').getBoundingClientRect();
      const form = document.getElementById('ntp-search-form').getBoundingClientRect();
      const item = document.querySelector('#ntp-suggestions .suggestion-item').getBoundingClientRect();
      const title = document.querySelector('#ntp-suggestions .suggestion-title');
      const url = document.querySelector('#ntp-suggestions .suggestion-url');
      return {
        position: getComputedStyle(document.getElementById('ntp-suggestions')).position,
        menu: { left: menu.left, right: menu.right, width: menu.width },
        form: { left: form.left, right: form.right, width: form.width },
        item: { left: item.left, right: item.right, width: item.width },
        titleOverflow: getComputedStyle(title).textOverflow,
        titleWhiteSpace: getComputedStyle(title).whiteSpace,
        urlOverflow: getComputedStyle(url).textOverflow,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    assert.equal(suggestionLayout.position, 'absolute');
    assert.ok(Math.abs(suggestionLayout.menu.left - suggestionLayout.form.left) <= 1
      && Math.abs(suggestionLayout.menu.right - suggestionLayout.form.right) <= 1,
    `Suggestion menu escaped its search field: ${JSON.stringify(suggestionLayout)}`);
    assert.ok(suggestionLayout.item.right <= suggestionLayout.menu.right,
      `Suggestion item overflowed its menu: ${JSON.stringify(suggestionLayout)}`);
    assert.equal(suggestionLayout.titleOverflow, 'ellipsis');
    assert.equal(suggestionLayout.titleWhiteSpace, 'nowrap');
    assert.equal(suggestionLayout.urlOverflow, 'ellipsis');
    assert.ok(suggestionLayout.documentWidth <= suggestionLayout.viewportWidth + 1,
      `Suggestion menu caused horizontal page overflow: ${JSON.stringify(suggestionLayout)}`);
    await capture('02-long-suggestions.png');
    await window.evaluate((id) => window.electronAPI.switchTab(id), active.id);
    await poll(
      () => window.evaluate(() => window.electronAPI.getBrowserState()),
      (browserState) => browserState.activeTabId === active.id && !browserState.tabs.find((tab) => tab.id === active.id).isLoading,
    );
    log('Long suggestion containment verified');

    await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) throw new Error('Download test page was not found');
      return target.executeJavaScript("document.getElementById('download-test').click(); true", true);
    }, pageUrl);
    await window.locator('#download-popout').waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await window.locator('#download-popout').textContent(), /invicta-download-test\.txt/);
    await poll(
      () => window.evaluate(() => window.electronAPI.getDownloads()),
      (items) => items.some((item) => item.filename === 'invicta-download-test.txt'
        && ['progressing', 'paused'].includes(item.state)),
      5000,
    );
    await capture('02a-download-popout.png');
    await window.locator('#btn-close-download-popout').click();
    await window.locator('#download-popout').waitFor({ state: 'hidden' });
    const completedDownload = await poll(
      () => window.evaluate(() => window.electronAPI.getDownloads()),
      (items) => items.find((item) => item.filename === 'invicta-download-test.txt'
        && item.state === 'completed'),
      10000,
    );
    assert.ok(completedDownload.some((item) => item.filename === 'invicta-download-test.txt'
      && item.state === 'completed'));
    assert.equal(await window.locator('#download-popout').isHidden(), true,
      'Download box reopened after it was dismissed');
    log('Dismissible background download box verified');

    log('Requesting a real display-media stream from the active page');
    const displayMediaResult = electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) return { success: false, error: 'Target web contents not found' };
      return target.executeJavaScript(`(async () => {
        try {
          window.__invictaTestDisplayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          const videoTrack = window.__invictaTestDisplayStream.getVideoTracks()[0];
          return {
            success: Boolean(videoTrack),
            videoTracks: window.__invictaTestDisplayStream.getVideoTracks().length,
            audioTracks: window.__invictaTestDisplayStream.getAudioTracks().length,
            readyState: videoTrack ? videoTrack.readyState : null
          };
        } catch (error) {
          return { success: false, error: String(error && (error.stack || error.message) || error) };
        }
      })()`, true);
    }, pageUrl).catch((error) => ({ success: false, error: error.stack || String(error) }));

    const picker = window.locator('#screen-picker-modal-backdrop');
    const requestOutcome = await Promise.race([
      picker.waitFor({ state: 'visible', timeout: 15_000 }).then(
        () => ({ pickerVisible: true }),
        (error) => ({ pickerVisible: false, waitError: error.message }),
      ),
      displayMediaResult.then((result) => ({ pickerVisible: false, result })),
    ]);
    assert.equal(requestOutcome.pickerVisible, true,
      `Display-media picker did not open: ${JSON.stringify(requestOutcome)}`);
    assert.match(await window.locator('#screen-picker-origin').textContent(), /127\.0\.0\.1/);
    assert.equal(await window.locator('#chk-share-audio').isEnabled(), true);
    const pickerLayout = await window.evaluate(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector).getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      };
      const modal = document.getElementById('screen-picker-modal');
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        modal: rect('#screen-picker-modal'),
        header: rect('.screen-picker-header'),
        tabs: rect('#screen-picker-tabs'),
        content: rect('.screen-picker-content'),
        list: rect('#screen-picker-list-pane'),
        preview: rect('#screen-picker-preview-pane'),
        footer: rect('.screen-picker-footer'),
        modalScrollWidth: modal.scrollWidth,
        modalClientWidth: modal.clientWidth,
      };
    });
    assert.ok(pickerLayout.modal.width >= 760 && pickerLayout.modal.right <= pickerLayout.viewport.width,
      `Screen picker modal width is invalid: ${JSON.stringify(pickerLayout)}`);
    assert.ok(pickerLayout.list.width >= 270 && pickerLayout.preview.width >= 340,
      `Screen picker panes collapsed: ${JSON.stringify(pickerLayout)}`);
    assert.ok(Math.abs(pickerLayout.list.right - pickerLayout.preview.left) <= 2,
      `Screen picker panes do not meet: ${JSON.stringify(pickerLayout)}`);
    assert.ok(pickerLayout.footer.top >= pickerLayout.content.bottom - 1,
      `Screen picker footer overlaps content: ${JSON.stringify(pickerLayout)}`);
    assert.ok(pickerLayout.modalScrollWidth <= pickerLayout.modalClientWidth + 1,
      `Screen picker has horizontal overflow: ${JSON.stringify(pickerLayout)}`);
    await window.locator('.screen-picker-tab-btn[data-target="windows"]').click();
    assert.equal(await window.locator('.screen-picker-tab-btn[data-target="windows"]').getAttribute('aria-selected'), 'true');
    await window.waitForFunction(() => !/Finding available/.test(document.getElementById('screen-picker-list-pane').textContent));
    await window.locator('.screen-picker-tab-btn[data-target="screens"]').click();
    assert.equal(await window.locator('.screen-picker-tab-btn[data-target="screens"]').getAttribute('aria-selected'), 'true');
    await window.waitForFunction(() => !/Finding available/.test(document.getElementById('screen-picker-list-pane').textContent));
    await window.locator('.screen-picker-tab-btn[data-target="tabs"]').click();
    const pageSource = window.locator('#screen-picker-list-pane .screen-picker-item')
      .filter({ hasText: 'Invicta smoke page' })
      .first();
    await pageSource.click();
    assert.equal(await window.locator('#btn-submit-screen-picker').isEnabled(), true);
    await capture('03-screen-picker.png');
    await window.locator('#btn-submit-screen-picker').click();
    const stream = await displayMediaResult;
    assert.deepEqual(
      {
        success: stream.success,
        videoTracks: stream.videoTracks,
        audioTracks: stream.audioTracks,
        readyState: stream.readyState,
      },
      { success: true, videoTracks: 1, audioTracks: 1, readyState: 'live' },
      stream.error || 'Display-media stream did not become live',
    );
    await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) return;
      await target.executeJavaScript(`(() => {
        if (window.__invictaTestDisplayStream) {
          window.__invictaTestDisplayStream.getTracks().forEach((track) => track.stop());
          window.__invictaTestDisplayStream = null;
        }
      })()`);
    }, pageUrl);
    await picker.waitFor({ state: 'hidden' });
    log('Display-media tab capture verified');

    const cancelledDisplayRequest = electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) return { cancelled: false, error: 'Target web contents not found' };
      return target.executeJavaScript(`(async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          stream.getTracks().forEach((track) => track.stop());
          return { cancelled: false };
        } catch (error) {
          return { cancelled: true, name: error.name, message: error.message };
        }
      })()`, true);
    }, pageUrl).catch((error) => ({ cancelled: false, error: error.stack || String(error) }));
    await picker.waitFor({ state: 'visible', timeout: 15_000 });
    assert.equal(await window.locator('#chk-share-audio').isDisabled(), true);
    await window.keyboard.press('Escape');
    await picker.waitFor({ state: 'hidden' });
    const cancellation = await cancelledDisplayRequest;
    assert.equal(cancellation.cancelled, true, cancellation.error || 'Display-media cancellation did not reject the request');
    assert.ok(['AbortError', 'NotAllowedError'].includes(cancellation.name),
      `Unexpected display-media cancellation error: ${cancellation.name}`);
    log('Display-media cancellation verified');

    const originalOrder = loaded.tabs.map((tab) => tab.id);
    const requestedOrder = originalOrder.slice().reverse();
    const reordered = await window.evaluate((ids) => window.electronAPI.reorderTabs(ids), requestedOrder);
    assert.deepEqual(reordered.tabs.map((tab) => tab.id).slice(0, requestedOrder.length), requestedOrder);
    log('Tab reordering verified');

    const aiResult = await window.evaluate(() => window.electronAPI.askInvictaAI(
      'Summarize this page in one sentence',
      { includePageContext: true },
    ));
    log('InvictaTill AI cloud recovery response received');
    assert.equal(aiResult.engine, 'invicta-cloud');
    assert.match(aiResult.response, /Invicta cloud fallback received/);
    assert.equal(typeof aiResult.response, 'string');
    assert.ok(aiResult.response.length > 20);

    const history = await poll(
      () => window.evaluate(() => window.electronAPI.getHistory()),
      (entries) => entries.some((entry) => entry.url === pageUrl),
    );
    assert.ok(history.some((entry) => entry.title === 'Invicta smoke page'));

    await window.locator('#btn-invicta-ai').click();
    log('Opening InvictaTill AI in the shared left app panel');
    const drawer = window.locator('#workspace-drawer');
    await drawer.waitFor({ state: 'visible' });
    assert.equal(await drawer.getAttribute('aria-hidden'), 'false');
    assert.equal(await window.locator('#btn-invicta-ai').getAttribute('aria-expanded'), 'true');
    assert.equal(await window.locator('#btn-invicta-ai').evaluate((button) => button.classList.contains('active')), true);
    assert.equal(await whatsappPanel.isHidden(), true);
    assert.equal((await window.evaluate(() => window.electronAPI.getWhatsappPanelState())).visible, false);
    const aiPanelGeometry = await window.evaluate(() => {
      const rect = (selector) => {
        const bounds = document.querySelector(selector).getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, width: bounds.width, height: bounds.height };
      };
      return {
        viewportWidth: window.innerWidth,
        rail: rect('#app-rail'),
        panel: rect('#workspace-drawer'),
        stage: rect('#browser-stage'),
      };
    });
    assert.ok(Math.abs(aiPanelGeometry.panel.left - aiPanelGeometry.rail.right) <= 1,
      `InvictaTill AI panel is detached from the app rail: ${JSON.stringify(aiPanelGeometry)}`);
    if (aiPanelGeometry.viewportWidth > 900) {
      assert.ok(aiPanelGeometry.stage.left >= aiPanelGeometry.panel.right - 1,
        `Browser page did not make room for InvictaTill AI: ${JSON.stringify(aiPanelGeometry)}`);
    }
    assert.equal((await window.locator('#ai-provider-badge').textContent()).trim(), 'InvictaTill AI · Cloud');
    assert.match(await drawer.textContent(), /Page access stays private/);
    assert.equal(await window.locator('#setting-ai-provider option[value="invicta"]').count(), 1);
    await capture('05a-invicta-ai-chat.png');

    await window.locator('#drawer-tab-settings').click();
    await window.locator('#drawer-panel-settings').waitFor({ state: 'visible' });
    await assertViewportContained([
      '#drawer-panel-settings', '#update-settings-card', '#btn-check-updates',
    ], 'Update settings');
    assert.equal(await window.locator('#update-settings-card').getAttribute('data-status'), 'disabled');
    assert.match(await window.locator('#update-settings-title').textContent(), /Automatic updates unavailable/);
    assert.match(await window.locator('#update-settings-status').textContent(), /installed production build/);
    assert.equal(await window.locator('#btn-check-updates').isDisabled(), true);
    assert.equal((await window.locator('#btn-check-updates').textContent()).trim(), 'Unavailable');
    await window.locator('#update-settings-card').scrollIntoViewIfNeeded();
    await capture('05-update-settings.png');
    await window.locator('#drawer-tab-focus').click();
    await window.locator('#drawer-panel-focus').waitFor({ state: 'visible' });
    await assertViewportContained(['#focus-hero', '#focus-form', '.focus-stats', '.work-launcher-grid'], 'Focus session panel');
    await window.locator('#focus-intention').fill('Complete E2E quality review');
    await window.locator('#focus-duration').selectOption('25');
    await window.locator('#btn-start-focus').click();
    await window.locator('#focus-status-pill').waitFor({ state: 'visible' });
    assert.match(await window.locator('#focus-clock').textContent(), /^2[45]:[0-5][0-9]$/);
    assert.match(await window.locator('#focus-intention-display').textContent(), /Complete E2E quality review/);
    await capture('07-focus-session.png');
    await window.locator('#btn-pause-focus').click();
    assert.equal((await window.locator('#btn-pause-focus').textContent()).trim(), 'Resume');
    await window.locator('#btn-pause-focus').click();
    assert.equal((await window.locator('#btn-pause-focus').textContent()).trim(), 'Pause');
    await window.locator('#btn-end-focus').click();
    await window.locator('#focus-status-pill').waitFor({ state: 'hidden' });
    log('Persistent focus session controls and remote-work launcher verified');
    await window.locator('#drawer-tab-chat').click();
    log('Update settings state and geometry verified');

    const recoveredConnection = await window.evaluate(() => window.electronAPI.testAiConfig({
      provider: 'invicta',
      endpoint: 'http://127.0.0.1:7860/api/v1',
    }));
    assert.equal(recoveredConnection.success, true);
    assert.equal(recoveredConnection.mode, 'cloud');
    assert.match(recoveredConnection.message, /cloud fallback.*AI is working/i);
    log('InvictaTill AI settings recovery verified');

    const invictaResult = await window.evaluate(
      async ({ endpoint }) => {
        await window.electronAPI.saveAiConfig({
          provider: 'invicta',
          endpoint,
          apiKey: 'invicta-test-key',
        });
        return window.electronAPI.askInvictaAI('Confirm the integration', {
          includePageContext: false,
        });
      },
      { endpoint: `http://127.0.0.1:${address.port}` },
    );
    assert.equal(invictaResult.provider, 'invicta');
    assert.match(invictaResult.response, /Invicta service received/);
    log('InvictaTill AI API provider verified');

    await window.locator('#btn-close-drawer').click();
    await drawer.waitFor({ state: 'hidden' });

    const writingUrl = `${pageUrl}writing-test`;
    await window.evaluate((url) => window.electronAPI.navigate(url), writingUrl);
    await poll(
      () => electronApp.evaluate(({ webContents }, targetUrl) => {
        const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
        return Boolean(target && !target.isLoading());
      }, writingUrl),
      Boolean,
      15_000,
    );
    await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) throw new Error('Live writing test page was not found');
      await target.executeJavaScript('document.getElementById("writing-draft").focus()');
      await target.insertText('i definately recieve teh report');
    }, writingUrl);
    const liveSuggestion = await poll(
      () => electronApp.evaluate(async ({ webContents }, targetUrl) => {
        const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
        if (!target) return null;
        return target.executeJavaScript(`(() => {
          const host = document.querySelector('[data-invicta-writing-assistant]');
          return host ? {
            state: host.dataset.state,
            suggestionLength: Number(host.dataset.suggestionLength || 0)
          } : null;
        })()`);
      }, writingUrl),
      (value) => Boolean(value && value.state === 'suggestion' && value.suggestionLength > 0),
      25_000,
    );
    assert.ok(liveSuggestion.suggestionLength > 10);
    await capture('05b-live-writing-suggestion.png');
    await captureRemotePage(writingUrl, '05c-live-writing-page.png');
    const applyPoint = await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) throw new Error('Live writing test page was not found');
      return target.executeJavaScript(`(() => {
        const host = document.querySelector('[data-invicta-writing-assistant]');
        const button = host && host.shadowRoot && host.shadowRoot.querySelector('[data-action="apply"]');
        if (!button) return null;
        const bounds = button.getBoundingClientRect();
        return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
      })()`);
    }, writingUrl);
    assert.ok(applyPoint && Number.isFinite(applyPoint.x) && Number.isFinite(applyPoint.y));
    await electronApp.evaluate(({ webContents }, details) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === details.url);
      if (!target) throw new Error('Live writing test page was not found');
      const point = { x: Math.round(details.x), y: Math.round(details.y), button: 'left', clickCount: 1 };
      target.sendInputEvent({ type: 'mouseDown', ...point });
      target.sendInputEvent({ type: 'mouseUp', ...point });
    }, { url: writingUrl, ...applyPoint });
    await poll(
      () => electronApp.evaluate(async ({ webContents }, targetUrl) => {
        const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
        return target
          ? target.executeJavaScript('document.getElementById("writing-draft").textContent')
          : '';
      }, writingUrl),
      (value) => value === 'I definitely receive the report.',
    );
    await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) throw new Error('Live writing test page was not found');
      await target.executeJavaScript('document.getElementById("writing-password").focus()');
      await target.insertText(' this must remain private');
    }, writingUrl);
    await new Promise((resolve) => setTimeout(resolve, 1700));
    const sensitiveFieldState = await electronApp.evaluate(async ({ webContents }, targetUrl) => {
      const target = webContents.getAllWebContents().find((contents) => contents.getURL() === targetUrl);
      if (!target) return 'missing';
      return target.executeJavaScript(`(() => {
        const host = document.querySelector('[data-invicta-writing-assistant]');
        return host ? host.dataset.state : 'absent';
      })()`);
    }, writingUrl);
    assert.ok(sensitiveFieldState === 'hidden' || sensitiveFieldState === 'absent',
      `A suggestion was shown for a password field: ${sensitiveFieldState}`);
    log('Live InvictaTill AI spelling and grammar suggestion verified');

    const requestedCompactBounds = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const shell = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
      shell.restore();
      await new Promise((resolve) => setTimeout(resolve, 300));
      shell.setBounds({ x: 40, y: 40, width: 900, height: 650 });
      await new Promise((resolve) => setTimeout(resolve, 300));
      return shell.getBounds();
    });
    log(`Compact window bounds: ${JSON.stringify(requestedCompactBounds)}`);
    await window.waitForFunction(() => window.innerWidth <= 920 && window.innerHeight <= 670);
    await window.locator('#btn-new-tab').click();
    await window.locator('#new-tab-page').waitFor({ state: 'visible' });
    assert.equal(await window.locator('#ntp-search').inputValue(), '', 'New-tab search retained an old query');
    const compactLayout = await assertViewportContained([
      '#titlebar', '.title-logo', '#workspace-tabs-strip', '#btn-add-workspace-open', '.window-controls', '#tabs-bar', '#nav-bar',
      '.omnibox-shell', '.nav-actions', '#new-tab-page', '.ntp-content', '#quick-links', '.ntp-columns',
    ], 'Compact 900px layout');
    const compactQuickLinks = await window.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.quick-link')).map((element) => element.getBoundingClientRect());
      return new Set(links.map((bounds) => Math.round(bounds.top))).size;
    });
    assert.equal(compactQuickLinks, 2, 'Expected the six compact quick links to form two rows');
    assert.ok(compactLayout.elements.find((item) => item.selector === '.omnibox-shell').width >= 300,
      'Compact omnibox became too narrow');
    const tabCountBeforeDensityCheck = await window.locator('#tabs-container .tab-item').count();
    for (let index = 0; index < 10; index += 1) {
      await window.evaluate(() => window.electronAPI.newTab());
    }
    await window.waitForFunction((expectedCount) => (
      document.querySelectorAll('#tabs-container .tab-item').length >= expectedCount
    ), tabCountBeforeDensityCheck + 10);
    const denseTabLayout = await window.evaluate(() => {
      const strip = document.querySelector('.tabs-scroll');
      const container = document.getElementById('tabs-container');
      const stripBounds = strip.getBoundingClientRect();
      const tabBounds = Array.from(container.querySelectorAll('.tab-item')).map((item) => {
        const bounds = item.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, width: bounds.width };
      });
      return {
        strip: { left: stripBounds.left, right: stripBounds.right },
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
        tabs: tabBounds,
      };
    });
    assert.ok(denseTabLayout.tabs.length >= tabCountBeforeDensityCheck + 10,
      `Expected a dense tab strip: ${JSON.stringify(denseTabLayout)}`);
    assert.ok(denseTabLayout.tabs[0].left >= denseTabLayout.strip.left - 1,
      `First tab escaped the strip: ${JSON.stringify(denseTabLayout)}`);
    assert.ok(denseTabLayout.tabs[denseTabLayout.tabs.length - 1].right <= denseTabLayout.strip.right + 1,
      `Last tab escaped the strip: ${JSON.stringify(denseTabLayout)}`);
    assert.ok(denseTabLayout.scrollWidth <= denseTabLayout.clientWidth + 1,
      `Dense tabs caused horizontal overflow: ${JSON.stringify(denseTabLayout)}`);
    assert.ok(denseTabLayout.tabs.every((tab) => tab.width > 0),
      `Dense tabs did not retain a visible click target: ${JSON.stringify(denseTabLayout)}`);
    log('Dense tab strip auto-sizing and containment verified');
    await capture('04-compact-900.png');
    assert.deepEqual(cspStyleViolations, [], `CSP blocked UI styling: ${cspStyleViolations.join('\n')}`);
    log('Responsive UI containment and CSP styling verified');

    if (process.env.INVICTA_E2E_SCREENSHOT) {
      const screenshotPath = path.resolve(process.env.INVICTA_E2E_SCREENSHOT);
      await window.screenshot({ path: screenshotPath, animations: 'disabled' });
      log(`Saved shell screenshot to ${screenshotPath}`);
    }

    process.stdout.write('✓ Electron shell, tabs, navigation, history, drawer, and AI smoke checks passed\n');
  } finally {
    if (electronApp) {
      await Promise.race([
        electronApp.close().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
