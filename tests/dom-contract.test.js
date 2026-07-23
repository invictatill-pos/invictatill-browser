'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'renderer', 'renderer.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'renderer', 'style.css'), 'utf8');

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
  assert.ok(idSet.has('screen-picker-audio-label'));
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
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

  assert.match(main, /contents\.on\('zoom-changed'/);
  assert.match(main, /tab\.view\.webContents\.setZoomFactor/);
  assert.match(main, /CHROME_ZOOM_STEPS/);
  assert.match(renderer, /CHROME_ZOOM_STEPS/);
  assert.match(renderer, /sameId\(rawTab\.id, state\.activeTabId\).*tab\.zoom/);
  assert.match(renderer, /clamp\(factor, 0\.25, 5\.0\)/);
  assert.match(renderer, /Number\.isFinite\(Number\(res\.zoom\)\)/);
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
  assert.ok(!/\.style\.|\.style\s*=|cssText/.test(renderer), 'Runtime inline styles bypass the shared component system');
  assert.match(html, /<link\s+rel=["']stylesheet["']\s+href=["']style\.css["']>/);
});

test('open tabs share the available strip width instead of overflowing', () => {
  assert.match(css, /\.tabs-container\s*{[^}]*\bwidth:\s*100%;[^}]*\bmin-width:\s*0;/s);
  assert.match(css, /\.tab-item\s*{[^}]*\bmin-width:\s*0;[^}]*\bmax-width:\s*238px;[^}]*\bflex:\s*1\s+1\s+0;/s);
  assert.match(css, /@container\s+browser-tab\s*\(max-width:\s*92px\)/);
});
