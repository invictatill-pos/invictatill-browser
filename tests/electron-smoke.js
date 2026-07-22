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
    });

    log('Waiting for browser shell window');
    await electronApp.firstWindow({ timeout: 30_000 });
    const window = await poll(
      () => Promise.resolve(electronApp.windows()),
      (pages) => pages.some((page) => /renderer[\\/]index\.html/i.test(decodeURIComponent(page.url()))),
      30_000,
    ).then((pages) => pages.find((page) => /renderer[\\/]index\.html/i.test(decodeURIComponent(page.url()))));
    await window.waitForLoadState('domcontentloaded');
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
    const pageSource = window.locator('#screen-picker-list-pane .screen-picker-item')
      .filter({ hasText: 'Invicta smoke page' })
      .first();
    await pageSource.click();
    assert.equal(await window.locator('#btn-submit-screen-picker').isEnabled(), true);
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
