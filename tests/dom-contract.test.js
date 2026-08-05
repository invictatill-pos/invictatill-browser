'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'renderer', 'renderer.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer', 'style.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const idSet = new Set(htmlIds);

test('renderer IDs are unique', () => {
  assert.equal(idSet.size, htmlIds.length);
});

test('literal DOM lookups have matching markup', () => {
  const requested = new Set([
    ...[...renderer.matchAll(/\$\(["']([^"']+)["']\)/g)].map((match) => match[1]),
    ...[...renderer.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((match) => match[1]),
  ]);
  const missing = [...requested].filter((id) => !idSet.has(id));
  assert.deepEqual(missing, []);
});

test('find-in-page controls and accessible landmarks exist', () => {
  for (const id of ['find-bar', 'find-input', 'find-results', 'find-prev', 'find-next', 'find-close']) {
    assert.ok(idSet.has(id), `Missing #${id}`);
  }
  assert.match(html, /role=["']tablist["']/);
  assert.match(html, /aria-live=/);
  assert.match(html, /id=["']screen-picker-modal["'][^>]*aria-labelledby=["']screen-picker-title["']/);
  assert.ok(idSet.has('screen-picker-origin'));
  for (const id of ['update-settings-card', 'update-settings-status', 'btn-check-updates', 'btn-settings-install-update']) {
    assert.ok(idSet.has(id), `Missing #${id}`);
  }
  for (const id of ['command-backdrop', 'command-input', 'command-results', 'drawer-panel-focus', 'focus-clock', 'focus-status-pill']) {
    assert.ok(idSet.has(id), `Missing #${id}`);
  }
  for (const id of [
    'app-rail', 'btn-whatsapp', 'btn-invicta-ai', 'btn-download-popout', 'download-popout',
    'download-popout-list', 'btn-close-download-popout', 'btn-open-all-downloads',
    'password-save-popout', 'password-save-domain', 'password-save-username',
    'btn-close-password-save', 'btn-dismiss-password-save', 'btn-confirm-password-save',
    'whatsapp-panel', 'whatsapp-panel-view-host', 'whatsapp-panel-status',
    'whatsapp-unread-badge', 'btn-whatsapp-open-tab', 'btn-whatsapp-reload',
    'btn-close-whatsapp', 'setting-live-writing',
  ]) {
    assert.ok(idSet.has(id), `Missing #${id}`);
  }
  assert.match(html, /Close download box; downloads will continue/);
  assert.match(html, /Available for autofill in every normal workspace/);
  assert.match(html, /Your sign-in stays available across every workspace/);
  assert.match(html, /aria-controls=["']whatsapp-panel["']/);
  assert.match(html, /id=["']btn-invicta-ai["'][^>]+aria-controls=["']workspace-drawer["']/);
  assert.ok(!idSet.has('btn-ai-drawer'), 'The duplicate toolbar AI button should stay removed');
  assert.match(html, /Show spelling and grammar suggestions while typing/);
  assert.match(html, /Password, login, payment, search, and private-window fields are excluded/);
  assert.match(html, /Ctrl\+Shift\+G/);
});

test('tabwise zoom preservation and zoom bounds contract', () => {
  assert.match(main, /contents\.on\('zoom-changed'/);
  assert.match(main, /tab\.view\.webContents\.setZoomFactor/);
  assert.match(main, /CHROME_ZOOM_STEPS/);
  assert.match(renderer, /CHROME_ZOOM_STEPS/);
  assert.match(renderer, /sameId\(rawTab\.id, state\.activeTabId\).*tab\.zoom/);
  assert.match(renderer, /clamp\(factor, 0\.25, 5\.0\)/);
  assert.match(renderer, /Number\.isFinite\(Number\(res\.zoom\)\)/);
});

test('native tab surface stays below browser chrome and app rail', () => {
  assert.match(css, /--titlebar-height:\s*34px;/);
  assert.match(css, /--tabs-height:\s*42px;/);
  assert.match(css, /--nav-height:\s*52px;/);
  assert.match(css, /--app-rail-width:\s*48px;/);
  assert.match(css, /\.browser-chrome\s*{[^}]*\bz-index:\s*1200;/s);
  assert.match(css, /\.app-rail\s*{[^}]*\bz-index:\s*1100;/s);
  assert.match(css, /\.browser-stage\s*{[^}]*\bz-index:\s*1;[^}]*\boverflow:\s*hidden;/s);
  assert.match(main, /const DEFAULT_VIEW_LAYOUT = \{\s*top:\s*34 \+ 42 \+ 52,\s*left:\s*48,/s);
  assert.match(main, /function minimumViewLayout\(\)\s*{\s*return mainWindow && !mainWindow\.isDestroyed\(\) && mainWindow\.isFullScreen\(\)/s);
  assert.match(main, /function normalizeViewLayout\(layout, minLayout\)/);
  assert.match(main, /source\.top === undefined \? minimum\.top : Math\.max\(minimum\.top, source\.top\)/);
  assert.match(main, /source\.left === undefined \? minimum\.left : Math\.max\(minimum\.left, source\.left\)/);
  assert.match(main, /function resizeTabViewToCurrentLayout\(tab\)/);
  assert.match(main, /let tabsVisible = false;\s*let shellLayoutReady = false;/);
  assert.match(main, /if \(!shellLayoutReady \|\| !tabsVisible \|\| !primary\) return;/);
  assert.match(main, /shellLayoutReady = true;\s*viewLayout = next;\s*resizeViews\(\);/);
  assert.match(main, /viewLayout = bounds\.layout;/);
  assert.match(main, /prepareRemoteContentView\(view\);\s*mainWindow\.contentView\.addChildView\(view\);\s*prepareRemoteContentView\(view\);/s);
});

test('HTTP Basic Auth prompt is clipped to the tab viewport', () => {
  assert.match(html, /id=["']http-auth-modal-backdrop["'][^>]*role=["']dialog["']/);
  assert.match(html, /<main class=["']browser-stage["'] id=["']browser-stage["'][^>]*>[\s\S]*id=["']http-auth-modal-backdrop["'][\s\S]*<\/main>/);
  assert.match(css, /\.http-auth-backdrop\s*{[^}]*\bposition:\s*absolute;[^}]*\binset:\s*0;[^}]*\bz-index:\s*50;[^}]*\boverflow:\s*hidden;/s);
  assert.doesNotMatch(css, /body\.(?:whatsapp-panel-open|ai-panel-open|fullscreen) \.http-auth-backdrop/);
  assert.match(renderer, /\[els\.httpAuthBackdrop, els\.httpAuthModal\]/);
  assert.match(renderer, /openModalSurface\(els\.httpAuthBackdrop, els\.httpAuthModal\);/);
  assert.match(renderer, /closeModalSurface\(els\.httpAuthBackdrop\);/);
  assert.match(main, /const requestingTab = tabForRemoteContents\(_webContents\);\s*resizeTabViewToCurrentLayout\(requestingTab\);\s*resizeViews\(\);/s);
  assert.match(main, /pendingHttpAuthCallbacks\.set\(requestId, \{ callback, timeout, tabId: requestingTab \? requestingTab\.id : null \}\);/);
  assert.match(main, /entry\.callback\(username, password\);[\s\S]*resizeTabViewToCurrentLayout\(tabs\.get\(entry\.tabId\)\);[\s\S]*resizeViews\(\);/);
});

test('InvictaTill AI is the only user-selectable AI agent', () => {
  assert.equal((html.match(/<option\s+value=["']invicta["']/g) || []).length, 1);
  assert.doesNotMatch(html, /<option\s+value=["'](?:openai|local)["']/i);
  assert.match(html, /InvictaTill AI is the browser’s only AI agent/);
});

test('renderer avoids executable HTML and dynamic code sinks', () => {
  assert.ok(!/\.innerHTML\s*=/.test(renderer));
  assert.ok(!/insertAdjacentHTML/.test(renderer));
  assert.ok(!/\beval\s*\(/.test(renderer));
  assert.ok(!/new\s+Function\s*\(/.test(renderer));
});

test('UI styling stays compatible with the strict content security policy', () => {
  assert.ok(!/\sstyle\s*=/.test(html), 'Inline HTML styles are blocked by style-src self');
  // Note: .style. access is intentionally used for live drag positioning on the download
  // popout and the WhatsApp resize handle — these are runtime pixel operations, not layout.
  // We ban cssText (which sets multiple properties at once and bypasses review).
  assert.ok(!/\bcssText\b/.test(renderer), 'cssText bypasses the shared component system');
  assert.match(html, /<link\s+rel=["']stylesheet["']\s+href=["']style\.css["']>/);
});

test('open tabs share the available strip width instead of overflowing', () => {
  assert.match(css, /\.tabs-container\s*{[^}]*\bwidth:\s*100%;[^}]*\bmin-width:\s*0;/s);
  assert.match(css, /\.tab-item\s*{[^}]*\bmin-width:\s*0;[^}]*\bmax-width:\s*238px;[^}]*\bflex:\s*1\s+1\s+0;/s);
  assert.match(css, /@container\s+browser-tab\s*\(max-width:\s*92px\)/);
});

test('downloads use a roomy top-right side panel with usable controls', () => {
  assert.match(css, /\.download-popout\s*{[^}]*\btop:\s*calc\(var\(--chrome-height\)\s*\+\s*8px\);/s);
  assert.match(css, /\.download-popout\s*{[^}]*\bwidth:\s*min\(420px,/s);
  assert.match(css, /\.download-mini-actions button\s*{[^}]*\bheight:\s*27px;/s);
  assert.match(html, /class=["']download-popout-header-icon["']/);
  assert.match(renderer, /recent download.*closing this panel will not delete files/);
  assert.match(renderer, /classList\.toggle\('download-popout-open', state\.downloadPopoutOpen\)/);
});
