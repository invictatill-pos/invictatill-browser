'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const zlib = require('node:zlib');
const test = require('node:test');

const sourcePath = path.resolve(__dirname, '..', 'extension-manager.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const extensionId = 'a'.repeat(32);
const manifest = { name: 'Security fixture', version: '1.0.0', manifest_version: 3 };

function fixture(t, settings = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'invictatill-extension-test-'));
  const extensionsRoot = path.join(root, 'extensions');
  const loads = [];
  const targetSession = {
    async loadExtension(directory, options) {
      loads.push({ directory, options });
      if (settings.beforeLoad) await settings.beforeLoad(directory);
      if (settings.loadError && settings.loadError(directory)) throw new Error('Test extension load failed');
      return { id: extensionId };
    },
    removeExtension() {},
  };
  const electron = {
    app: { getPath: () => root },
    session: { fromPartition: () => targetSession },
  };
  const module = { exports: {} };
  const localRequire = Module.createRequire(sourcePath);
  const initialize = vm.runInThisContext(Module.wrap(source), { filename: sourcePath });
  initialize(module.exports, (name) => name === 'electron' ? electron : localRequire(name), module, sourcePath, path.dirname(sourcePath));
  const manager = module.exports.createExtensionManager({ chromeVersion: '140.0.0.0' });
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith('invictatill-extension-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { root, extensionsRoot, loads, manager };
}

function unpacked(root, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(root, 'source-'));
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ ...manifest, ...overrides }));
  return directory;
}

function zip(entries) {
  const localEntries = [];
  const centralEntries = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data || '');
    const compression = entry.compression === undefined ? 8 : entry.compression;
    const compressed = compression === 8 ? zlib.deflateRawSync(data) : data;
    const size = entry.declaredSize === undefined ? data.length : entry.declaredSize;
    const crc = entry.crc === undefined ? zlib.crc32(data) : entry.crc;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(compression, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(compression, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.attributes || 0, 38);
    central.writeUInt32LE(offset, 42);
    localEntries.push(local, name, compressed);
    centralEntries.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centralEntries);
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50);
  footer.writeUInt16LE(entries.length, 8);
  footer.writeUInt16LE(entries.length, 10);
  footer.writeUInt32LE(directory.length, 12);
  footer.writeUInt32LE(offset, 16);
  return Buffer.concat([...localEntries, directory, footer]);
}

function writeArchive(root, entries, name = 'extension.zip') {
  const archive = path.join(root, name);
  fs.writeFileSync(archive, zip(entries));
  return archive;
}

function assertNoStaging(extensionsRoot) {
  assert.deepEqual(fs.readdirSync(extensionsRoot).filter((name) => /^_(installing|download|previous)_/.test(name)), []);
}

test('Web Store ids and version parameters are validated before file or network access', async (t) => {
  const { root, manager } = fixture(t);
  let fetched = false;
  t.mock.method(global, 'fetch', async () => { fetched = true; throw new Error('Unexpected network access'); });
  for (const id of ['', '../outside', '__proto__', 'A'.repeat(32), 'z'.repeat(32), {}, null]) {
    await assert.rejects(manager.installFromWebStore(id), /Invalid Chrome Web Store extension id/);
  }
  await assert.rejects(manager.installFromWebStore(extensionId, '140&x=untrusted'), /Invalid Chrome version/);
  const directory = unpacked(root);
  await assert.rejects(manager.installFromPath(directory, { extensionId: '../' }), /Invalid Chrome Web Store extension id/);
  assert.equal(fetched, false);
  assert.ok(fs.existsSync(path.join(directory, 'manifest.json')));
});

test('valid ZIP and CRX archives install and extensions never gain automatic file access', async (t) => {
  const { root, extensionsRoot, loads, manager } = fixture(t);
  const entries = [
    { name: 'manifest.json', data: JSON.stringify(manifest) },
    { name: 'popup.html', data: '<!doctype html><title>Popup</title>', compression: 0 },
    { name: 'assets/', data: '' },
    { name: 'assets/content.js', data: '"use strict";' },
  ];
  const archive = writeArchive(root, entries, 'extension.ZIP');
  const installed = await manager.installFromPath(archive);
  assert.equal(installed.name, manifest.name);
  assert.equal(loads[0].options.allowFileAccess, false);
  assert.ok(fs.existsSync(path.join(installed.path, 'popup.html')));
  const crx = Buffer.alloc(16);
  crx.write('Cr24');
  crx.writeUInt32LE(3, 4);
  crx.writeUInt32LE(4, 8);
  const crxPath = path.join(root, 'extension.crx');
  fs.writeFileSync(crxPath, Buffer.concat([crx, zip(entries)]));
  await manager.installFromPath(crxPath, { extensionId });
  assertNoStaging(extensionsRoot);
});

test('archive traversal, Windows alternate streams, device paths, and case collisions are rejected', async (t) => {
  const { root, extensionsRoot, manager } = fixture(t);
  const invalidNames = ['../outside.txt', '..\\outside.txt', '/absolute.txt', 'C:\\outside.txt', 'manifest.json:stream', 'con.txt', 'folder./file.js'];
  for (const name of invalidNames) {
    const archive = writeArchive(root, [{ name: 'manifest.json', data: JSON.stringify(manifest) }, { name, data: 'unsafe' }]);
    await assert.rejects(manager.installFromPath(archive), /Invalid extension resource path/);
    assertNoStaging(extensionsRoot);
  }
  const collision = writeArchive(root, [
    { name: 'manifest.json', data: JSON.stringify(manifest) },
    { name: 'MANIFEST.JSON', data: '{}' },
  ]);
  await assert.rejects(manager.installFromPath(collision), /duplicate or ambiguous/);
  assert.ok(!fs.existsSync(path.join(root, 'outside.txt')));
});

test('ZIP links, invalid offsets, unsupported compression, and corrupt checksums fail closed', async (t) => {
  const { root, extensionsRoot, manager } = fixture(t);
  for (const entry of [
    { name: 'linked', data: '../outside', attributes: (0xa1ff << 16) >>> 0 },
    { name: 'unsupported', data: 'content', compression: 12 },
    { name: 'corrupt', data: 'content', crc: 0 },
  ]) {
    const archive = writeArchive(root, [{ name: 'manifest.json', data: JSON.stringify(manifest) }, entry]);
    await assert.rejects(manager.installFromPath(archive), /unsafe ZIP entry|integrity check/);
    assertNoStaging(extensionsRoot);
  }
  const malformed = zip([{ name: 'manifest.json', data: JSON.stringify(manifest) }]);
  malformed.writeUInt32LE(0xfffffff0, malformed.length - 6);
  const archive = path.join(root, 'malformed.zip');
  fs.writeFileSync(archive, malformed);
  await assert.rejects(manager.installFromPath(archive), /Invalid ZIP/);
  const mismatch = zip([{ name: 'manifest.json', data: JSON.stringify(manifest) }]);
  mismatch[30] = 'x'.charCodeAt(0);
  fs.writeFileSync(archive, mismatch);
  await assert.rejects(manager.installFromPath(archive), /entry names do not match/);
  assertNoStaging(extensionsRoot);
});

test('ZIP expansion is bounded using both advertised totals and actual inflated output', async (t) => {
  const { root, extensionsRoot, manager } = fixture(t);
  const oversized = writeArchive(root, [{ name: 'manifest.json', data: '{}', declaredSize: 201 * 1024 * 1024 }]);
  await assert.rejects(manager.installFromPath(oversized), /expands beyond/);
  const bomb = writeArchive(root, [{ name: 'manifest.json', data: 'x'.repeat(1024 * 1024), declaredSize: 1 }]);
  await assert.rejects(manager.installFromPath(bomb), /larger than|size or integrity/i);
  assertNoStaging(extensionsRoot);
});

test('unpacked directories cannot import a linked external directory', async (t) => {
  const { root, extensionsRoot, manager } = fixture(t);
  const directory = unpacked(root);
  const outside = fs.mkdtempSync(path.join(root, 'outside-'));
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  fs.symlinkSync(outside, path.join(directory, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(manager.installFromPath(directory), /symbolic links/);
  assert.equal(fs.readFileSync(path.join(outside, 'secret.txt'), 'utf8'), 'secret');
  assertNoStaging(extensionsRoot);
});

test('registry paths and unsafe ids cannot load or delete folders outside the managed extension directory', async (t) => {
  const { root, extensionsRoot, loads, manager } = fixture(t);
  const outside = unpacked(root);
  fs.mkdirSync(extensionsRoot);
  fs.writeFileSync(path.join(extensionsRoot, 'extension-registry.json'), JSON.stringify({
    [extensionId]: { path: outside, enabled: true },
    '../outside': { path: outside, enabled: true },
  }));
  assert.deepEqual(await manager.loadAllExtensions(), []);
  assert.equal(loads.length, 0);
  assert.deepEqual(manager.getInstalledExtensions(), []);
  manager.uninstallExtension(extensionId);
  assert.throws(() => manager.uninstallExtension('../outside'), /Invalid extension id/);
  assert.ok(fs.existsSync(path.join(outside, 'manifest.json')));
});

test('manifest icons and extension page URLs cannot escape their installed folder', async (t) => {
  const { root, manager } = fixture(t);
  fs.writeFileSync(path.join(root, 'secret.png'), 'private file');
  const directory = unpacked(root, {
    icons: { 128: '../../secret.png' },
    action: { default_popup: '../secret.png' },
    options_page: '../../secret.png',
  });
  const installed = await manager.installFromPath(directory);
  assert.equal(installed.icon, '');
  assert.equal(manager.getExtensionPopup(installed.id), null);
  assert.equal(manager.getExtensionOptionsUrl(installed.id), null);
});

test('valid local popup and options paths produce encoded extension URLs', async (t) => {
  const { root, manager } = fixture(t);
  const directory = unpacked(root, {
    action: { default_popup: 'popup #one.html' },
    options_page: 'options.html',
  });
  fs.writeFileSync(path.join(directory, 'popup #one.html'), '<title>Popup</title>');
  fs.writeFileSync(path.join(directory, 'options.html'), '<title>Options</title>');
  const installed = await manager.installFromPath(directory);
  assert.equal(manager.getExtensionPopup(installed.id).url, `chrome-extension://${extensionId}/popup%20%23one.html`);
  assert.equal(manager.getExtensionOptionsUrl(installed.id), `chrome-extension://${extensionId}/options.html`);
});

test('an extension load failure restores an installed version and removes temporary files', async (t) => {
  let rejectNextLoad = false;
  const { root, extensionsRoot, manager } = fixture(t, { loadError: () => {
    if (!rejectNextLoad) return false;
    rejectNextLoad = false;
    return true;
  } });
  const oldSource = unpacked(root);
  await manager.installFromPath(oldSource, { extensionId });
  const newSource = unpacked(root, { version: '2.0.0' });
  rejectNextLoad = true;
  await assert.rejects(manager.installFromPath(newSource, { extensionId }), /Test extension load failed/);
  const restored = manager.publicExtension(extensionId);
  assert.equal(restored.version, '1.0.0');
  assert.equal(restored.loaded, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(restored.path, 'manifest.json'), 'utf8')).version, '1.0.0');
  assertNoStaging(extensionsRoot);
});

test('concurrent extension installs are serialized and cannot be uninstalled during loading', async (t) => {
  let releaseFirst;
  let announceFirst;
  const firstStarted = new Promise((resolve) => { announceFirst = resolve; });
  const holdFirst = new Promise((resolve) => { releaseFirst = resolve; });
  let count = 0;
  const { root, extensionsRoot, loads, manager } = fixture(t, { beforeLoad: async () => {
    if (++count === 1) {
      announceFirst();
      await holdFirst;
    }
  } });
  const oldSource = unpacked(root);
  const newSource = unpacked(root, { version: '2.0.0' });
  const first = manager.installFromPath(oldSource, { extensionId });
  await firstStarted;
  const second = manager.installFromPath(newSource, { extensionId });
  assert.throws(() => manager.uninstallExtension(extensionId), /still in progress/);
  assert.throws(() => manager.toggleExtension(extensionId, false), /still in progress/);
  assert.equal(loads.length, 1);
  releaseFirst();
  await Promise.all([first, second]);
  assert.equal(manager.publicExtension(extensionId).version, '2.0.0');
  assertNoStaging(extensionsRoot);
});

test('downloads reject unapproved redirects before contacting their target', async (t) => {
  const { extensionsRoot, manager } = fixture(t);
  const visited = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    visited.push(url);
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { location: 'http://untrusted.example/extension.crx' } });
  });
  await assert.rejects(manager.installFromWebStore(extensionId), /Unsafe Chrome Web Store download redirect/);
  assert.equal(visited.length, 1);
  assertNoStaging(extensionsRoot);
});

test('downloads enforce announced size and clean up partially streamed failures', async (t) => {
  const { extensionsRoot, manager } = fixture(t);
  t.mock.method(global, 'fetch', async () => new Response('small', { headers: { 'content-length': String(201 * 1024 * 1024) } }));
  await assert.rejects(manager.installFromWebStore(extensionId), /too large/);
  assertNoStaging(extensionsRoot);
  global.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.error(new Error('Interrupted download'));
    },
  }));
  await assert.rejects(manager.installFromWebStore(extensionId), /Interrupted download/);
  assertNoStaging(extensionsRoot);
});

test('valid streamed Web Store downloads install after an approved HTTPS redirect', async (t) => {
  const { extensionsRoot, manager } = fixture(t);
  const archive = zip([{ name: 'manifest.json', data: JSON.stringify(manifest) }]);
  let requests = 0;
  t.mock.method(global, 'fetch', async () => {
    requests++;
    if (requests === 1) return new Response(null, { status: 302, headers: { location: 'https://clients2.googleusercontent.com/crx/package.crx' } });
    return new Response(archive);
  });
  const installed = await manager.installFromWebStore(extensionId);
  assert.equal(installed.id, extensionId);
  assert.equal(requests, 2);
  assertNoStaging(extensionsRoot);
});
