'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright-core');

async function poll(read, ready, label) {
  const deadline = Date.now() + 15000;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (ready(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(label + ': ' + JSON.stringify(value));
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'invictatill-layout-'));
  const passwordsCsv = path.join(profile, 'import-test.csv');
  fs.writeFileSync(passwordsCsv, 'url,username,password\nhttps://layout.test,layout-test,fixture-secret\n');
  const localHtml = path.join(profile, 'local page.html');
  fs.writeFileSync(localHtml, '<!doctype html><title>Local path fixture</title><main>Local path fixture</main>');
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Layout fixture</title><main>Fullscreen layout fixture</main>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  const env = { ...process.env, INVICTA_TEST_MODE: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({
      args: ['.', '--test-mode', '--user-data-dir=' + profile],
      cwd: path.resolve(__dirname, '..'), env, timeout: 30000,
    });
    await app.firstWindow();
    const windows = await poll(() => Promise.resolve(app.windows()),
      (pages) => pages.some((page) => /renderer[\\/]index\.html/i.test(decodeURIComponent(page.url()))),
      'Browser shell should load');
    const shell = windows.find((page) => /renderer[\\/]index\.html/i.test(decodeURIComponent(page.url())));
    await shell.waitForFunction(() => window.electronAPI && document.getElementById('tabs-container'));
    const first = await shell.evaluate((url) => window.electronAPI.newTab(url), baseUrl + '/first');
    const second = await shell.evaluate((url) => window.electronAPI.newTab(url), baseUrl + '/second');
    await shell.evaluate((id) => window.electronAPI.switchTab(id), first.id);

    const geometry = () => app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return {
        size: win.getContentSize(),
        views: win.contentView.children.filter((view) => view.webContents).map((view) => ({
          url: view.webContents.getURL(), bounds: view.getBounds(), visible: view.getVisible(),
        })),
      };
    });

    await shell.locator('#btn-menu').click();
    await shell.locator('#menu-settings').click();
    await shell.locator('label[for="setting-compact-nav"]').click();
    await shell.locator('#btn-close-drawer').click();
    const railTop = await shell.locator('#app-rail').evaluate((element) => element.getBoundingClientRect().top);
    const compact = await poll(geometry, (state) => state.views.some((view) =>
      view.visible && view.url === baseUrl + '/first' && view.bounds.y < 128),
    'Compact navigation should put the native tab directly under the toolbar');
    assert.ok(Math.abs(railTop - compact.views.find((view) => view.visible).bounds.y) <= 1);

    await shell.locator('#btn-zoom-reset').click();
    const zoomLeft = await shell.locator('#zoom-popup').evaluate((element) =>
      element.getBoundingClientRect().right - element.offsetWidth);
    await poll(geometry, (state) => state.views.some((view) =>
      view.visible && view.url === baseUrl + '/first' && view.bounds.x + view.bounds.width <= zoomLeft),
    'The native tab should not cover the zoom controls');
    await shell.keyboard.press('Escape');
    await shell.locator('#zoom-popup').waitFor({ state: 'hidden' });
    await poll(geometry, (state) => state.views.some((view) =>
      view.visible && view.url === baseUrl + '/first' && view.bounds.x + view.bounds.width === state.size[0]),
    'Closing zoom should restore the native tab width');

    await shell.locator('#btn-menu').click();
    await shell.locator('#menu-settings').click();
    await shell.locator('label[for="setting-compact-nav"]').click();
    await shell.locator('#btn-close-drawer').click();
    process.stdout.write('✓ Compact navigation and zoom popup keep native bounds aligned with the shell\n');

    await shell.locator('#btn-reading-mode').click();
    await shell.waitForFunction(() => document.getElementById('btn-reading-mode').getAttribute('aria-pressed') === 'true');
    const readerWidth = await app.evaluate(async ({ webContents }, url) => {
      const contents = webContents.getAllWebContents().find((item) => item.getURL() === url);
      return contents.executeJavaScript('getComputedStyle(document.body).maxWidth');
    }, baseUrl + '/first');
    assert.equal(readerWidth, '780px');
    await shell.evaluate((id) => window.electronAPI.switchTab(id), second.id);
    await shell.waitForFunction(() => document.getElementById('btn-reading-mode').getAttribute('aria-pressed') === 'false');
    await shell.evaluate((id) => window.electronAPI.switchTab(id), first.id);
    await shell.waitForFunction(() => document.getElementById('btn-reading-mode').getAttribute('aria-pressed') === 'true');
    process.stdout.write('✓ Reading mode follows the active page and applies its stylesheet inside Chromium\n');

    const secondTab = shell.locator('[role="tab"][data-tab-id="' + second.id + '"]');
    await secondTab.focus();
    await shell.evaluate(() => refreshBrowserState());
    assert.equal(await shell.evaluate(() => document.activeElement.dataset.tabId), String(second.id));

    const nativeThrottling = (url) => app.evaluate(({ webContents }, targetUrl) =>
      webContents.getAllWebContents().find((item) => item.getURL() === targetUrl)?.backgroundThrottling, url);
    const toggleThrottling = () => shell.locator('label[for="setting-background-throttling"]').click();
    await shell.locator('#btn-menu').click();
    await shell.locator('#menu-settings').click();
    await toggleThrottling();
    await poll(() => shell.evaluate(() => window.electronAPI.getMemoryStats()),
      (stats) => stats.backgroundTabThrottling === false, 'The disabled preference should be saved');
    assert.equal(await nativeThrottling(baseUrl + '/second'), false);
    const thirdTab = await shell.evaluate((url) => window.electronAPI.newTab(url), baseUrl + '/third');
    await poll(() => nativeThrottling(baseUrl + '/third'), (enabled) => enabled === false,
      'New native tabs should inherit the preference');
    await toggleThrottling();
    await poll(() => nativeThrottling(baseUrl + '/second'), (enabled) => enabled === true,
      'Turning throttling on should update existing native tabs');
    await shell.evaluate((id) => window.electronAPI.closeTab(id), thirdTab.id);
    await shell.evaluate((id) => window.electronAPI.switchTab(id), first.id);
    await shell.locator('#btn-close-drawer').click();
    process.stdout.write('✓ Tabs retain keyboard focus across refresh and existing and new tabs honor the throttling preference\n');

    await shell.locator('#btn-menu').click();
    await shell.locator('#menu-settings').click();
    await shell.locator('#btn-open-import-modal').click();
    await poll(geometry, (state) => state.views.every((view) => !view.visible),
      'The native tab should be hidden behind the import dialog');
    await shell.waitForFunction(() => document.activeElement?.id === 'import-modal');
    await shell.keyboard.press('Shift+Tab');
    assert.equal(await shell.evaluate(() => document.activeElement.id), 'btn-close-import-done');
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, passwordsCsv);
    await shell.locator('#btn-import-passwords-csv').click();
    await shell.waitForFunction(() => /imported 1 saved password/i.test(document.getElementById('import-result-message').textContent));
    const passwords = await shell.evaluate(() => window.electronAPI.getSavedPasswords());
    assert.equal(passwords[0].username, 'layout-test');
    await shell.keyboard.press('Escape');
    await shell.locator('#import-modal-backdrop').waitFor({ state: 'hidden' });
    assert.equal(await shell.evaluate(() => document.activeElement.id), 'btn-open-import-modal');
    await shell.locator('#btn-close-drawer').click();
    process.stdout.write('✓ Password import stays above native content, saves CSV entries, and restores keyboard focus\n');

    await shell.locator('#address-bar').fill(localHtml);
    await shell.locator('#address-bar').press('Enter');
    await poll(geometry, (state) => state.views.some((view) => view.visible && view.url.endsWith('/local%20page.html')),
      'The address bar should load Windows paths containing spaces as local files');
    await shell.evaluate((url) => window.electronAPI.navigate(url), baseUrl + '/first');

    await shell.evaluate((id) => window.electronAPI.setSplitScreen({ enabled: true, secondaryTabId: id }), second.id);
    await poll(geometry, (state) => state.views.filter((view) => view.visible && view.url.startsWith(baseUrl)).length === 2,
      'Both split panes should be visible');

    for (const url of [baseUrl + '/first', baseUrl + '/second']) {
      await app.evaluate(async ({ webContents }, targetUrl) => {
        const contents = webContents.getAllWebContents().find((item) => item.getURL() === targetUrl);
        await contents.executeJavaScript('document.documentElement.requestFullscreen().then(() => true)', true);
      }, url);
      const entered = await poll(geometry, (state) => {
        const visible = state.views.filter((view) => view.visible);
        return visible.length === 1 && visible[0].url === url &&
          visible[0].bounds.x === 0 && visible[0].bounds.y === 0 &&
          visible[0].bounds.width === state.size[0] && visible[0].bounds.height === state.size[1];
      }, 'Fullscreen should cover the entire native content area');
      assert.ok(entered.size[0] > 0);
      await shell.evaluate(() => window.electronAPI.setViewLayout({ top: 0, left: 0, right: 304, bottom: 50 }));
      const resized = await geometry();
      const owner = resized.views.find((view) => view.url === url);
      assert.deepEqual(owner.bounds, { x: 0, y: 0, width: resized.size[0], height: resized.size[1] });
      await app.evaluate(async ({ webContents }, targetUrl) => {
        const contents = webContents.getAllWebContents().find((item) => item.getURL() === targetUrl);
        await contents.executeJavaScript('document.exitFullscreen().then(() => true)', true);
      }, url);
      await poll(geometry, (state) => {
        const views = state.views.filter((view) => view.visible && view.url.startsWith(baseUrl));
        return views.length === 2 && views[0].bounds.y >= 128 && views[1].bounds.y >= 128 &&
          Math.abs(views[0].bounds.width - views[1].bounds.width) <= 1 &&
          views[0].bounds.x + views[0].bounds.width === views[1].bounds.x;
      }, 'Leaving fullscreen should restore both split panes');
    }
    process.stdout.write('✓ Native HTML fullscreen survives layout updates in both split panes\n');

    await shell.evaluate(() => window.electronAPI.setActiveWorkspace('work'));
    await shell.evaluate((url) => window.electronAPI.newTab(url), baseUrl + '/work');
    const switched = await shell.evaluate(() => window.electronAPI.getBrowserState());
    assert.equal(switched.splitScreen, false);
    assert.equal(switched.secondaryTabId, null);
    await poll(geometry, (state) => {
      const visible = state.views.filter((view) => view.visible);
      return visible.length === 1 && visible[0].url === baseUrl + '/work';
    },
      'Previous workspace panes must be hidden');
    await assert.rejects(shell.evaluate((id) => window.electronAPI.setSplitScreen({ enabled: true, secondaryTabId: id }), second.id),
      /same workspace/);
    process.stdout.write('✓ Workspace switches hide previous split views and reject foreign panes\n');
  } finally {
    if (app) await app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    const resolvedProfile = path.resolve(profile);
    assert.equal(path.dirname(resolvedProfile), path.resolve(os.tmpdir()), 'Cleanup must stay within the temp directory');
    assert.ok(path.basename(resolvedProfile).startsWith('invictatill-layout-'), 'Cleanup must target the isolated layout profile');
    fs.rmSync(resolvedProfile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write((error.stack || error) + '\n');
  process.exitCode = 1;
});
