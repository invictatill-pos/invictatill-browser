'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'renderer', 'renderer.js'), 'utf8');

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
});

test('renderer avoids executable HTML and dynamic code sinks', () => {
  assert.ok(!/\.innerHTML\s*=/.test(renderer));
  assert.ok(!/insertAdjacentHTML/.test(renderer));
  assert.ok(!/\beval\s*\(/.test(renderer));
  assert.ok(!/new\s+Function\s*\(/.test(renderer));
});
