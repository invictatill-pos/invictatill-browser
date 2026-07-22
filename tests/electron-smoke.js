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
  const server = http.createServer((request, response) => {
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
    if (request.url === '/second') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Second test page</title><h1>Second page</h1>');
      return;
    }
    if (request.url.startsWith('/visual-validation')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>Visual validation page with an intentionally extensive descriptive title for overflow testing</title><h1>Long history entry</h1>');
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Invicta smoke page</title><main><h1>Verified browser content</h1><p>Orchid nebula is the unique summary phrase.</p><a href="/second">Next</a></main>');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const pageUrl = `http://127.0.0.1:${address.port}/`;
  const electronEnvironment = { ...process.env, INVICTA_TEST_MODE: '1' };
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
    await window.locator('#tabs-container').waitFor({ state: 'visible' });
    const modalParents = await window.evaluate(() => [
      'update-modal-backdrop',
      'site-info-modal-backdrop',
      'add-workspace-modal-backdrop',
      'passwords-modal-backdrop',
      'screen-picker-modal-backdrop',
    ].map((id) => ({ id, parent: document.getElementById(id).parentElement.tagName })));
    assert.ok(modalParents.every((item) => item.parent === 'BODY'),
      `Expected top-level modal backdrops, received ${JSON.stringify(modalParents)}`);
    const initialLayout = await assertViewportContained([
      '#titlebar', '#tabs-bar', '#nav-bar', '#new-tab-page', '.ntp-content', '#ntp-search-form', '#quick-links',
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
    log('Local AI response received');
    assert.equal(typeof aiResult.response, 'string');
    assert.ok(aiResult.response.length > 20);

    const history = await poll(
      () => window.evaluate(() => window.electronAPI.getHistory()),
      (entries) => entries.some((entry) => entry.url === pageUrl),
    );
    assert.ok(history.some((entry) => entry.title === 'Invicta smoke page'));

    await window.locator('#btn-ai-drawer').click();
    log('Opening productivity drawer');
    const drawer = window.locator('#workspace-drawer');
    await drawer.waitFor({ state: 'visible' });
    assert.equal(await drawer.getAttribute('aria-hidden'), 'false');
    assert.equal((await window.locator('#ai-provider-badge').textContent()).trim(), 'Local');
    assert.match(await drawer.textContent(), /Page context off by default/);
    assert.equal(await window.locator('#setting-ai-provider option[value="invicta"]').count(), 1);

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
    await window.locator('#drawer-tab-chat').click();
    log('Update settings state and geometry verified');

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
