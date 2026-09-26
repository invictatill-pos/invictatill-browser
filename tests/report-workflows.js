'use strict';

// Real Chromium navigation is essential here: reconstructing window.open with
// loadURL loses POST bodies, the opener relationship, and sessionStorage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function poll(read, matches, label, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (matches(value)) return value;
    await delay(100);
  }
  throw new Error(`${label}: ${JSON.stringify(value)}`);
}

async function main() {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invictatill-reports-'));
  const requests = [];
  const csv = 'Name,Result\r\n"Café नमस्ते",42\r\n';
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({
        url: request.url,
        method: request.method,
        body: Buffer.concat(chunks).toString('utf8'),
        cookie: request.headers.cookie || '',
        referrer: request.headers.referer || '',
        contentType: request.headers['content-type'] || '',
      });
      if (['/export/render/user/report/file', '/authenticated-download', '/written-download'].includes(request.url)) {
        if (request.url === '/authenticated-download' && !/workspace-session=private-report/.test(request.headers.cookie || '')) {
          response.writeHead(403, { 'Content-Type': 'text/plain' });
          response.end('This workspace is not authenticated');
          return;
        }
        response.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${request.url === '/authenticated-download' ? 'workspace-report' : request.url === '/written-download' ? 'written-report' : 'report-workflow'}.csv"`,
          'Content-Length': Buffer.byteLength(csv),
        });
        response.end(csv);
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...(request.url === '/source' ? { 'Set-Cookie': 'report-session=signed-in; Path=/; SameSite=Lax' } : {}),
      });
      response.end(`<!doctype html><meta charset="utf-8"><title>Report fixture ${request.url}</title>
        <h1>Report workflow</h1><main id="result">${request.method} ${request.url}</main>`);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const sourceUrl = `${origin}/source`;
  const environment = {
    ...process.env,
    INVICTA_TEST_MODE: '1',
    INVICTA_TEST_DOWNLOAD_DIR: path.join(profileDir, 'downloads'),
  };
  delete environment.ELECTRON_RUN_AS_NODE;
  let application;
  try {
    application = await electron.launch({
      args: ['.', '--dev', '--test-mode', `--user-data-dir=${profileDir}`],
      cwd: root,
      env: environment,
      timeout: 30_000,
    });
    await application.firstWindow({ timeout: 30_000 });
    const shell = await poll(
      async () => application.windows().find((page) => /renderer[\\/]index\.html/i.test(decodeURIComponent(page.url()))),
      Boolean,
      'Browser shell was not created',
      30_000,
    );
    await shell.waitForLoadState('domcontentloaded');
    const capture = async (name, contentsId) => {
      if (!process.env.INVICTA_E2E_SCREENSHOT_DIR) return;
      const directory = path.resolve(process.env.INVICTA_E2E_SCREENSHOT_DIR);
      fs.mkdirSync(directory, { recursive: true });
      // Capture the native page surface; shell captures omit child views.
      const dataUrl = await application.evaluate(async ({ webContents }, id) => (await webContents.fromId(id).capturePage()).toDataURL(), contentsId);
      fs.writeFileSync(path.join(directory, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
    };
    const state = () => shell.evaluate(() => window.electronAPI.getBrowserState());
    const execute = (id, script) => application.evaluate(async ({ webContents }, input) => {
      const contents = webContents.fromId(input.id);
      if (!contents || contents.isDestroyed()) throw new Error(`Missing contents ${input.id}`);
      return contents.executeJavaScript(input.script, true);
    }, { id, script });
    const findContents = (url) => application.evaluate(({ webContents }, targetUrl) => {
      const contents = webContents.getAllWebContents().find((candidate) => candidate.getURL() === targetUrl && !candidate.isLoading());
      return contents ? contents.id : null;
    }, url);
    const waitContents = (url) => poll(() => findContents(url), Boolean, `Page did not load: ${url}`);
    const closeScriptTab = async (id, expectedCount) => {
      await execute(id, 'window.close(); true').catch((error) => {
        if (!/destroyed|closed|disposed/i.test(error.message)) throw error;
      });
      await poll(state, (value) => value.tabs.length === expectedCount, 'Script-closed tab remained in browser state');
      assert.equal(await application.evaluate(({ webContents }, contentsId) => Boolean(webContents.fromId(contentsId)), id), false);
    };
    const assertChildIsolation = async (id) => {
      assert.deepEqual(await execute(id, '({ require: typeof require, process: typeof process, shellBridge: typeof window.electronAPI })'), {
        require: 'undefined', process: 'undefined', shellBridge: 'undefined',
      });
      assert.deepEqual(await application.evaluate(({ webContents }, contentsId) => {
        const preferences = webContents.fromId(contentsId).getLastWebPreferences();
        return { sandbox: preferences.sandbox, nodeIntegration: preferences.nodeIntegration, contextIsolation: preferences.contextIsolation };
      }, id), { sandbox: true, nodeIntegration: false, contextIsolation: true });
    };
    const assertManagedPageVisible = async (id) => {
      const geometry = await poll(() => application.evaluate(({ BrowserWindow }, contentsId) => {
        const browser = BrowserWindow.getAllWindows().find((candidate) => /renderer[\\/]index\.html/i.test(decodeURIComponent(candidate.webContents.getURL())));
        const child = browser.contentView.children.find((view) => view.webContents && view.webContents.id === contentsId);
        return child ? { visible: child.getVisible(), bounds: child.getBounds() } : null;
      }, id), (value) => value && value.visible && value.bounds.width > 300 && value.bounds.height > 200,
      'Managed report did not become visible');
      assert.ok(geometry.bounds.y >= 100, 'Managed report overlaps the browser toolbar');
    };
    const submit = (action, fields, target = '_blank', options = {}) => execute(sourceId, `(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = ${JSON.stringify(action)};
      form.target = ${JSON.stringify(target)};
      form.rel = ${JSON.stringify(options.noopener ? '' : 'opener')};
      form.acceptCharset = 'UTF-8';
      form.enctype = ${JSON.stringify(options.enctype || 'application/x-www-form-urlencoded')};
      for (const [name, value] of Object.entries(${JSON.stringify(fields)})) {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = name; input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form); form.submit(); form.remove(); return true;
    })()`);

    await shell.evaluate((url) => window.electronAPI.navigate(url), sourceUrl);
    const sourceId = await waitContents(sourceUrl);
    await execute(sourceId, `window.reportMarker = 'source-opener'; sessionStorage.setItem('report-draft', 'draft-42'); true`);
    const initialCount = (await state()).tabs.length;
    const sourceWorkspaceId = (await state()).activeWorkspaceId;

    const reportPath = '/export/render/user/report/42';
    const fields = { token: 'verify + & =', filter: 'café नमस्ते' };
    await submit(`${origin}${reportPath}`, fields);
    await poll(() => requests.filter((item) => item.url === reportPath), (items) => items.length > 0, 'Report request was not sent');
    const reportRequests = requests.filter((item) => item.url === reportPath);
    assert.equal(reportRequests.length, 1, 'Report navigation was sent more than once');
    assert.equal(reportRequests[0].method, 'POST', 'Report form was converted to a GET');
    assert.equal(reportRequests[0].body, new URLSearchParams(fields).toString(), 'Report form body changed');
    assert.match(reportRequests[0].cookie, /report-session=signed-in/);
    assert.equal(reportRequests[0].referrer, sourceUrl, 'Report navigation lost its referrer');
    const reportId = await waitContents(`${origin}${reportPath}`);
    assert.deepEqual(await execute(reportId, `({ opener: window.opener && window.opener.reportMarker,
      draft: sessionStorage.getItem('report-draft'), result: document.querySelector('#result').textContent })`), {
      opener: 'source-opener', draft: 'draft-42', result: `POST ${reportPath}`,
    });
    assert.equal((await state()).tabs.length, initialCount + 1);
    await assertChildIsolation(reportId);
    await assertManagedPageVisible(reportId);
    await capture('report-post.png', reportId);
    await closeScriptTab(reportId, initialCount);
    process.stdout.write('✓ Report form preserves POST, UTF-8, cookies, referrer, opener, and sessionStorage\n');

    const blankFormPath = '/report/plain-blank-form';
    await submit(`${origin}${blankFormPath}`, fields, '_blank', { noopener: true });
    const blankFormId = await waitContents(`${origin}${blankFormPath}`);
    const blankFormRequests = requests.filter((item) => item.url === blankFormPath);
    assert.equal(blankFormRequests.length, 1);
    assert.equal(blankFormRequests[0].method, 'POST');
    assert.equal(blankFormRequests[0].body, new URLSearchParams(fields).toString());
    assert.equal(await execute(blankFormId, 'window.opener === null'), true, 'A default blank form unexpectedly gained an opener');
    await assertChildIsolation(blankFormId);
    await closeScriptTab(blankFormId, initialCount);
    const anchorPath = '/report/plain-blank-anchor';
    await execute(sourceId, `(() => {
      const anchor = document.createElement('a'); anchor.href = ${JSON.stringify(`${origin}${anchorPath}`)};
      anchor.target = '_blank'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); return true;
    })()`);
    const anchorId = await waitContents(`${origin}${anchorPath}`);
    assert.equal(await execute(anchorId, 'window.opener === null'), true, 'A default blank link unexpectedly gained an opener');
    assert.equal(requests.filter((item) => item.url === anchorPath).length, 1);
    await assertChildIsolation(anchorId);
    await closeScriptTab(anchorId, initialCount);
    process.stdout.write('✓ Default blank forms and links preserve Chromium noopener behavior and sandbox isolation\n');

    const multipartPath = '/export/render/user/report/multipart';
    await submit(`${origin}${multipartPath}`, fields, '_blank', { enctype: 'multipart/form-data' });
    const multipartId = await waitContents(`${origin}${multipartPath}`);
    const multipartRequests = requests.filter((item) => item.url === multipartPath);
    assert.equal(multipartRequests.length, 1);
    assert.equal(multipartRequests[0].method, 'POST');
    assert.match(multipartRequests[0].contentType, /^multipart\/form-data; boundary=/);
    for (const [name, value] of Object.entries(fields)) {
      assert.ok(multipartRequests[0].body.includes(`name="${name}"\r\n\r\n${value}\r\n`), `Multipart value for ${name} changed`);
    }
    await closeScriptTab(multipartId, initialCount);
    process.stdout.write('✓ Multipart report submissions retain their boundary and UTF-8 fields\n');

    assert.equal(await execute(sourceId, `(() => {
      const report = window.open('about:blank', '_blank');
      if (!report) return false;
      report.document.write('<!doctype html><title>Written report</title><h1 id="written">Generated report</h1>');
      report.document.close(); return true;
    })()`), true, 'window.open returned null for a managed tab');
    const writtenId = await poll(() => application.evaluate(({ webContents }) => {
      const contents = webContents.getAllWebContents().find((candidate) => candidate.getTitle() === 'Written report');
      return contents ? contents.id : null;
    }), Boolean, 'Written report tab did not appear');
    assert.equal(await execute(writtenId, 'document.querySelector("#written").textContent'), 'Generated report');
    await assertManagedPageVisible(writtenId);
    await capture('report-document-write.png', writtenId);
    await execute(writtenId, `window.location.href = ${JSON.stringify(`${origin}/written-download`)}; true`);
    await poll(() => shell.evaluate(() => window.electronAPI.getDownloads()),
      (items) => items.some((item) => item.filename === 'written-report.csv' && item.state === 'completed'),
      'Written report could not download its export');
    assert.equal(await execute(writtenId, 'document.querySelector("#written").textContent'), 'Generated report',
      'Download removed the generated report page');
    assert.equal((await state()).tabs.length, initialCount + 1, 'A download closed its existing generated report tab');
    await assertManagedPageVisible(writtenId);
    await closeScriptTab(writtenId, initialCount);
    process.stdout.write('✓ about:blank reports support document.write, downloads without losing the page, and window.close\n');

    assert.equal(await execute(sourceId, `Boolean(window.open(${JSON.stringify(`${origin}/named/first`)}, 'reusable-report'))`), true);
    const namedId = await waitContents(`${origin}/named/first`);
    await execute(sourceId, `window.open(${JSON.stringify(`${origin}/named/second`)}, 'reusable-report'); true`);
    assert.equal(await waitContents(`${origin}/named/second`), namedId, 'Named window was replaced instead of reused');
    assert.equal((await state()).tabs.length, initialCount + 1, 'Named target opened an extra tab');
    await closeScriptTab(namedId, initialCount);
    process.stdout.write('✓ Named report windows reuse the existing managed tab\n');

    const windowCount = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    await execute(sourceId, `window.open(${JSON.stringify(`${origin}/reports?generate=preview`)}, 'report-preview', 'width=640,height=480'); true`);
    const popupId = await waitContents(`${origin}/reports?generate=preview`);
    assert.equal(await application.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows().some((window) => window.webContents.id === id), popupId), true,
      'A report-like URL with popup features did not create a popup');
    assert.equal((await state()).tabs.length, initialCount);
    assert.equal(await execute(popupId, 'window.opener.reportMarker'), 'source-opener');
    await assertChildIsolation(popupId);
    await execute(popupId, `window.reportMarker = 'preview-opener'; window.open(${JSON.stringify(`${origin}/reports/nested`)}, 'nested-preview', 'width=420,height=320'); true`);
    const nestedId = await waitContents(`${origin}/reports/nested`);
    assert.equal(await execute(nestedId, 'window.opener.reportMarker'), 'preview-opener');
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), windowCount + 2);
    await application.evaluate(({ BrowserWindow }, ids) => {
      for (const id of ids) {
        const popup = BrowserWindow.getAllWindows().find((window) => window.webContents.id === id);
        if (popup) popup.close();
      }
    }, [nestedId, popupId]);
    assert.equal((await shell.evaluate(() => window.electronAPI.getDownloads())).filter((item) => item.filename !== 'written-report.csv').length,
      0, 'An HTML report was incorrectly downloaded');
    process.stdout.write('✓ Report-like HTML URLs remain navigable popups, including nested popups\n');

    const attachmentPath = '/export/render/user/report/file';
    await submit(`${origin}${attachmentPath}`, { token: 'attachment + 42' });
    const downloads = await poll(() => shell.evaluate(() => window.electronAPI.getDownloads()),
      (items) => items.some((item) => item.filename === 'report-workflow.csv' && item.state === 'completed'),
      'Report attachment did not complete');
    const download = downloads.find((item) => item.filename === 'report-workflow.csv');
    assert.equal(fs.readFileSync(download.savePath, 'utf8'), csv);
    assert.deepEqual(requests.filter((item) => item.url === attachmentPath), [{
      url: attachmentPath, method: 'POST', body: new URLSearchParams({ token: 'attachment + 42' }).toString(),
      cookie: 'report-session=signed-in', referrer: sourceUrl,
      contentType: 'application/x-www-form-urlencoded',
    }], 'Attachment request was duplicated or lost request context');
    await poll(state, (value) => value.tabs.length === initialCount && value.activeTabId === value.tabs.find((tab) => tab.url === sourceUrl).id,
      'Attachment left an empty tab or failed to restore its source');
    process.stdout.write('✓ Native attachments preserve POST and file contents without duplicate requests or empty tabs\n');
    assert.equal(download.canRetry, false, 'A POST export cannot be safely retried as a GET');
    assert.match(download.retryUnavailableReason, /original form submission/i);
    await assert.rejects(shell.evaluate((id) => window.electronAPI.downloadAction(id, 'retry'), download.id), /original form submission/i);
    assert.equal(requests.filter((item) => item.url === attachmentPath).length, 1, 'Blocked POST retry sent a new request');

    const workspace = await shell.evaluate(() => window.electronAPI.addWorkspace({ name: 'Authenticated reports' }));
    const workspaceUrl = `${origin}/workspace-source`;
    await shell.evaluate((url) => window.electronAPI.navigate(url), workspaceUrl);
    const workspaceSourceId = await waitContents(workspaceUrl);
    await execute(workspaceSourceId, `document.cookie = 'workspace-session=private-report; Path=/; SameSite=Lax';
      window.open(${JSON.stringify(`${origin}/authenticated-download`)}, '_blank'); true`);
    const workspaceDownloads = await poll(() => shell.evaluate(() => window.electronAPI.getDownloads()),
      (items) => items.some((item) => item.filename === 'workspace-report.csv' && item.state === 'completed'),
      'Authenticated workspace download failed');
    const workspaceDownload = workspaceDownloads.find((item) => item.filename === 'workspace-report.csv');
    assert.equal(workspaceDownload.workspaceId, workspace.activeWorkspaceId);
    assert.equal(workspaceDownload.canRetry, true);
    await shell.evaluate((id) => window.electronAPI.setActiveWorkspace(id), sourceWorkspaceId);
    assert.doesNotMatch(await execute(sourceId, 'document.cookie'), /workspace-session=/, 'Workspace cookie escaped into the source workspace');
    await shell.evaluate((id) => window.electronAPI.downloadAction(id, 'retry'), workspaceDownload.id);
    const retriedDownloads = await poll(() => shell.evaluate(() => window.electronAPI.getDownloads()),
      (items) => items.some((item) => item.id !== workspaceDownload.id && item.url === `${origin}/authenticated-download` && item.state === 'completed'),
      'Retry lost its original authenticated workspace');
    const retriedDownload = retriedDownloads.find((item) => item.id !== workspaceDownload.id && item.url === `${origin}/authenticated-download`);
    assert.equal(retriedDownload.workspaceId, workspace.activeWorkspaceId);
    assert.equal(fs.readFileSync(retriedDownload.savePath, 'utf8'), csv);
    const authenticatedRequests = requests.filter((item) => item.url === '/authenticated-download');
    assert.equal(authenticatedRequests.length, 2);
    assert.ok(authenticatedRequests.every((item) => item.method === 'GET' && item.cookie === 'workspace-session=private-report'));
    process.stdout.write('✓ Download retries retain their original workspace; POST exports explain how to regenerate safely\n');
    process.stdout.write('✓ Report workflow regression checks passed\n');
  } finally {
    if (application) await Promise.race([application.close().catch(() => {}), delay(5000)]);
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    // Only remove the unique temporary profile created by this test.
    assert.equal(path.dirname(path.resolve(profileDir)).toLowerCase(), path.resolve(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(profileDir).startsWith('invictatill-reports-'));
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
