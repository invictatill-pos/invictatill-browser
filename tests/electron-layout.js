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
    await shell.evaluate(async ({ primary, secondary }) => {
      await window.electronAPI.switchTab(primary);
      await window.electronAPI.setSplitScreen({ enabled: true, secondaryTabId: secondary });
    }, { primary: first.id, secondary: second.id });

    const geometry = () => app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return {
        size: win.getContentSize(),
        views: win.contentView.children.filter((view) => view.webContents).map((view) => ({
          url: view.webContents.getURL(), bounds: view.getBounds(), visible: view.getVisible(),
        })),
      };
    });
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
