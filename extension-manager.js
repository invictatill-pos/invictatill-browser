'use strict';

/**
 * extension-manager.js — Chrome Extension support for InvictaTill Browser.
 *
 * Provides extension loading/unloading, Chrome Web Store CRX download/unpack,
 * extension toolbar management, and a curated extension store.
 *
 * Uses Electron's session.loadExtension() API for Manifest V2/V3 extensions.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { session, app } = require('electron');

const EXTENSIONS_DIR_NAME = 'extensions';
const EXTENSION_REGISTRY_FILE = 'extension-registry.json';
const MAX_EXTENSIONS = 50;
const MAX_CRX_SIZE = 200 * 1024 * 1024;
const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024;
const MAX_UNPACKED_SIZE = 200 * 1024 * 1024;
const MAX_EXTENSION_FILES = 10000;
const MAX_MANIFEST_SIZE = 1024 * 1024;
const MAX_ICON_SIZE = 2 * 1024 * 1024;
const MANAGED_ID_PATTERN = /^(?:[a-p]{32}|[a-f0-9]{32})$/;
const WEBSTORE_ID_PATTERN = /^[a-p]{32}$/;
const CRX_MAGIC = Buffer.from('Cr24');
const CHROME_WEBSTORE_CRX_URL = 'https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx3&prodversion=%CHROME_VERSION%&x=id%3D%EXTENSION_ID%%26installsource%3Dondemand%26uc';

// Well-known featured extensions for the InvictaTill Extension Store.
const FEATURED_EXTENSIONS = [
  {
    id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
    name: 'uBlock Origin',
    description: 'An efficient wide-spectrum content blocker.',
    category: 'Productivity',
    icon: 'https://lh3.googleusercontent.com/rrgyVBVte7CfjjeTU-rCHDKba7-hadEMtGdm7gEMYODBSd-bPWBm7SJj1cvheGZMB2k21MaqMg=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm',
  },
  {
    id: 'nngceckbapebfimnlniiiahkandclblb',
    name: 'Bitwarden',
    description: 'A secure and free password manager for all devices.',
    category: 'Security',
    icon: 'https://lh3.googleusercontent.com/nSR4jxRNRl-bRKjHNJkC5HCj8LGcsGJMsLMHhFx9UfDl2SFluMJMl5b0jYKXW3dbGg-kfnVVWHw=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb',
  },
  {
    id: 'gighmmpiobklfepjocnamgkkbiglidom',
    name: 'AdBlock',
    description: 'Block ads on YouTube, Facebook, Twitch, and your favorite websites.',
    category: 'Productivity',
    icon: 'https://lh3.googleusercontent.com/Ntv7fSN7hpiCa_dBR68M-x6dmpNRdxqMa0Z1wSYmNIY8PV1T-h5M5BsNLByzJ5tDqsC52GbG-A=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/adblock/gighmmpiobklfepjocnamgkkbiglidom',
  },
  {
    id: 'gcbommkclmhbkzddkecmpkbilmogcdkn',
    name: 'HTTPS Everywhere',
    description: 'Encrypt the web! Automatically use HTTPS security on many sites.',
    category: 'Security',
    icon: 'https://lh3.googleusercontent.com/v2jwsZ2TQHEq1_h8VlWMNlFOOmfPPYOqOS6DtRBPdpnMVUHFsC1Cce1e0ySV6jIiQoGvmfSx30=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/https-everywhere/gcbommkclmhbkzddkecmpkbilmogcdkn',
  },
  {
    id: 'hdokiejnpimakedhajhdlcegeplioahd',
    name: 'LastPass',
    description: 'LastPass, an award-winning password manager.',
    category: 'Security',
    icon: 'https://lh3.googleusercontent.com/m6DNpfrQqzN2P2P4xfDgLJEBz51IfQNNA4NaATuIjXASdqOROMaXn6JJomBX5u2w2Zp9DSE1sA=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/lastpass-free-password-ma/hdokiejnpimakedhajhdlcegeplioahd',
  },
  {
    id: 'bgnkhhnnamicmpeenaelnjfhikgbkllg',
    name: 'AdGuard AdBlocker',
    description: 'Unmatched adblock extension against advertising and pop-ups.',
    category: 'Productivity',
    icon: 'https://lh3.googleusercontent.com/77tE-rqCEoR7gGVXfXbb7cZVxdW5D-_D3WlN2NhBtJsKvOZsMfZcq6-7TuHyAY0E7krlnzT4gQ=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/adguard-adblocker/bgnkhhnnamicmpeenaelnjfhikgbkllg',
  },
  {
    id: 'efaidnbmnnnibpcajpcglclefindmkaj',
    name: 'Adobe Acrobat',
    description: 'View, sign, comment, and share PDFs with Adobe Acrobat Reader.',
    category: 'Productivity',
    icon: 'https://lh3.googleusercontent.com/ZMjIGjJ2bdaVd2nZ1q0tPmBLpWoUF9jlQFKr56AvLk7Jp8mJ5FDWDZ5lK1xX5f1tsZGD9PkVKQ=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/adobe-acrobat-pdf-edit-co/efaidnbmnnnibpcajpcglclefindmkaj',
  },
  {
    id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
    name: 'Dark Reader',
    description: 'Dark mode for every website. Take care of your eyes, use dark theme for night and daily browsing.',
    category: 'Appearance',
    icon: 'https://lh3.googleusercontent.com/rLRj9s-3wL_bMsLngZhGoZb8bPvh5pO0A9u8W7VToIHZxj4HExwVQnGpXRcT9VOlQ9a-o2nPJQ=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh',
  },
  {
    id: 'fmkadmapgofadopljbjfkapdkoienihi',
    name: 'React Developer Tools',
    description: 'Adds React debugging tools to the Chrome Developer Tools.',
    category: 'Developer Tools',
    icon: 'https://lh3.googleusercontent.com/TNijZW_Gp9MZ3eqXkve0YWDEiHV-a2IpSpD6IaDJfTjBBhyMiNWCe8PjYfCBmMlAU3Ycr3LXag=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi',
  },
  {
    id: 'dbepggeogbaibhgnhhndojpepiihcmeb',
    name: 'Vimium',
    description: 'The Hacker\'s Browser. Vimium provides keyboard shortcuts for navigation and control.',
    category: 'Productivity',
    icon: 'https://lh3.googleusercontent.com/VW97eVmH6cYvUvqsGEHr9bJ7zJ0EvBOBzVKpqFCrMKWW3XFvR6VFxT0TRfOlUPKDR5rXDABPrA=s60',
    storeUrl: 'https://chromewebstore.google.com/detail/vimium/dbepggeogbaibhgnhhndojpepiihcmeb',
  },
];

const EXTENSION_CATEGORIES = [
  'All',
  'Productivity',
  'Security',
  'Appearance',
  'Developer Tools',
  'Shopping',
  'Social',
  'Entertainment',
];

function createExtensionManager(options) {
  const { chromeVersion, isDev, onStatusChange } = options;
  const extensionsRoot = path.join(app.getPath('userData'), EXTENSIONS_DIR_NAME);
  const registryPath = path.join(extensionsRoot, EXTENSION_REGISTRY_FILE);
  let registry = Object.create(null);
  let loadedExtensions = new Map();
  let installQueue = Promise.resolve();
  const installingIds = new Set();
  // Set of sessions into which extensions should be loaded.
  // main.js registers workspace sessions here as they are created.
  const registeredSessions = new Set();

  function ensureExtensionsDir() {
    fs.mkdirSync(extensionsRoot, { recursive: true });
    if (fs.lstatSync(extensionsRoot).isSymbolicLink()) {
      throw new Error('The extension directory must not be a symbolic link');
    }
  }

  function managedExtensionPath(extId) {
    if (typeof extId !== 'string' || !MANAGED_ID_PATTERN.test(extId)) {
      throw new Error('Invalid extension id');
    }
    if (fs.existsSync(extensionsRoot) && fs.lstatSync(extensionsRoot).isSymbolicLink()) {
      throw new Error('The extension directory must not be a symbolic link');
    }
    const result = path.join(extensionsRoot, extId);
    if (fs.existsSync(result) && fs.lstatSync(result).isSymbolicLink()) {
      throw new Error('Extension directories must not be symbolic links');
    }
    return result;
  }

  // Apply Windows rules on every platform so archives cannot create alternate
  // data streams, device files, or ambiguous names when installed on Windows.
  function safeRelativePath(value) {
    if (typeof value !== 'string' || !value || /[\x00-\x1f<>:"|?*]/.test(value)) {
      throw new Error('Invalid extension resource path');
    }
    const normalized = value.replace(/\\/g, '/');
    if (normalized.startsWith('/')) throw new Error('Invalid extension resource path');
    const parts = normalized.replace(/\/$/, '').split('/');
    if (parts.some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
      throw new Error('Invalid extension resource path');
    }
    return parts.join('/');
  }

  function extensionResourcePath(extDir, value) {
    const relative = safeRelativePath(value);
    const root = path.resolve(extDir);
    const resolved = path.resolve(root, relative);
    if (!resolved.startsWith(root + path.sep)) throw new Error('Invalid extension resource path');
    // Reject links in every component, including links introduced after install.
    let current = root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
        throw new Error('Extension resources must not be symbolic links');
      }
    }
    return resolved;
  }

  function loadRegistry() {
    registry = Object.create(null);
    try {
      if (fs.existsSync(registryPath)) {
        const saved = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
        for (const [id, entry] of Object.entries(saved)) {
          if (!MANAGED_ID_PATTERN.test(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
          try {
            const expected = managedExtensionPath(id);
            if (entry.path && (typeof entry.path !== 'string' || path.resolve(entry.path) !== expected)) continue;
            registry[id] = { ...entry, path: expected };
          } catch (error) { /* Ignore unsafe or damaged registry entries. */ }
        }
      }
    } catch (error) {
      registry = Object.create(null);
    }
  }

  function saveRegistry() {
    ensureExtensionsDir();
    const tmp = registryPath + '.' + crypto.randomBytes(16).toString('hex') + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(registry, null, 2), { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(tmp, registryPath);
    } finally {
      try { fs.unlinkSync(tmp); } catch (error) { /* Already renamed or not created. */ }
    }
  }

  function publicExtension(id) {
    const entry = registry[id];
    if (!entry) return null;
    const loaded = loadedExtensions.has(id);
    return {
      id,
      name: entry.name || id,
      version: entry.version || '0.0.0',
      description: entry.description || '',
      icon: entry.icon || '',
      enabled: entry.enabled !== false,
      loaded,
      manifestVersion: entry.manifestVersion || 2,
      permissions: entry.permissions || [],
      browserAction: entry.browserAction || null,
      homepageUrl: entry.homepageUrl || '',
      optionsPage: entry.optionsPage || '',
      installedAt: entry.installedAt || 0,
      size: entry.size || 0,
      path: entry.path || '',
    };
  }

  function getInstalledExtensions() {
    return Object.keys(registry).map(publicExtension).filter(Boolean);
  }

  function getFeaturedExtensions() {
    return FEATURED_EXTENSIONS.map((ext) => ({
      ...ext,
      installed: Boolean(registry[ext.id]),
      enabled: registry[ext.id] ? registry[ext.id].enabled !== false : false,
    }));
  }

  function getCategories() {
    return EXTENSION_CATEGORIES;
  }

  // Parse a Chrome Extension manifest.json.
  function parseManifest(extensionPath) {
    const manifestPath = extensionResourcePath(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Extension manifest.json not found');
    }
    if (!fs.statSync(manifestPath).isFile() || fs.statSync(manifestPath).size > MAX_MANIFEST_SIZE) {
      throw new Error('Extension manifest.json is invalid or too large');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('Invalid extension manifest');
    }
    return manifest;
  }

  // Extract CRX3 file to a directory.
  function extractCrx(crxPath, destDir) {
    const buffer = fs.readFileSync(crxPath);
    if (buffer.length > MAX_CRX_SIZE) throw new Error('Extension file is too large');
    if (buffer.length < 16) throw new Error('CRX file is too small');

    // CRX3 format: magic (4) + version (4) + header_size (4) + header + zip data.
    const magic = buffer.slice(0, 4);
    if (!magic.equals(CRX_MAGIC)) {
      // Might be a plain ZIP (some extensions are distributed as .zip).
      return extractZip(crxPath, destDir);
    }

    const version = buffer.readUInt32LE(4);
    if (version === 3) {
      const headerSize = buffer.readUInt32LE(8);
      const zipStart = 12 + headerSize;
      if (zipStart >= buffer.length) throw new Error('Invalid CRX3 header');
      extractZip(buffer.subarray(zipStart), destDir);
    } else if (version === 2) {
      const pubKeyLen = buffer.readUInt32LE(8);
      const sigLen = buffer.readUInt32LE(12);
      const zipStart = 16 + pubKeyLen + sigLen;
      if (zipStart >= buffer.length) throw new Error('Invalid CRX2 header');
      extractZip(buffer.subarray(zipStart), destDir);
    } else {
      throw new Error('Unsupported CRX version: ' + version);
    }
  }

  // Simple ZIP extraction using built-in zlib + manual parsing.
  function extractZip(zipPath, destDir) {
    const zlib = require('zlib');
    const buffer = Buffer.isBuffer(zipPath) ? zipPath : fs.readFileSync(zipPath);
    const entries = [];
    if (buffer.length > MAX_CRX_SIZE) throw new Error('Extension file is too large');
    function requireRange(offset, length, limit = buffer.length) {
      if (!Number.isSafeInteger(offset) || offset < 0 || length < 0 || offset + length > limit) {
        throw new Error('Invalid ZIP file: truncated or overlapping entry');
      }
    }

    // Only accept a complete, single-disk ZIP with a bounded central directory.
    let eocdOffset = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) throw new Error('Invalid ZIP file');

    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    const cdSize = buffer.readUInt32LE(eocdOffset + 12);
    const cdEntries = buffer.readUInt16LE(eocdOffset + 10);
    if (buffer.readUInt16LE(eocdOffset + 4) !== 0 || buffer.readUInt16LE(eocdOffset + 6) !== 0 ||
        buffer.readUInt16LE(eocdOffset + 8) !== cdEntries || cdEntries === 0xffff ||
        cdEntries > MAX_EXTENSION_FILES || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
      throw new Error('Unsupported ZIP file');
    }
    requireRange(cdOffset, cdSize, eocdOffset);
    const cdEnd = cdOffset + cdSize;
    let pos = cdOffset;
    let totalSize = 0;
    const names = new Map();

    for (let i = 0; i < cdEntries; i++) {
      requireRange(pos, 46, cdEnd);
      if (buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
      const flags = buffer.readUInt16LE(pos + 8);
      const compression = buffer.readUInt16LE(pos + 10);
      const crc = buffer.readUInt32LE(pos + 16);
      const compressedSize = buffer.readUInt32LE(pos + 20);
      const uncompressedSize = buffer.readUInt32LE(pos + 24);
      const nameLen = buffer.readUInt16LE(pos + 28);
      const extraLen = buffer.readUInt16LE(pos + 30);
      const commentLen = buffer.readUInt16LE(pos + 32);
      const localHeaderOffset = buffer.readUInt32LE(pos + 42);
      requireRange(pos + 46, nameLen + extraLen + commentLen, cdEnd);
      const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);
      const relative = safeRelativePath(name);
      const isDirectory = /[\\/]$/.test(name);
      const unixType = (buffer.readUInt32LE(pos + 38) >>> 16) & 0xf000;
      if ((flags & 0x41) || ![0, 8].includes(compression) ||
          (unixType && unixType !== 0x8000 && unixType !== 0x4000) ||
          (unixType === 0x4000 && !isDirectory) ||
          compressedSize === 0xffffffff || uncompressedSize === 0xffffffff ||
          localHeaderOffset === 0xffffffff || name.includes('\ufffd')) {
        throw new Error('Unsupported or unsafe ZIP entry');
      }
      const key = relative.toLowerCase();
      if (names.has(key) || (isDirectory && (uncompressedSize || crc))) {
        throw new Error('Invalid ZIP entry: duplicate or ambiguous path');
      }
      names.set(key, isDirectory);
      totalSize += uncompressedSize;
      if (uncompressedSize > MAX_UNCOMPRESSED_SIZE || totalSize > MAX_UNPACKED_SIZE) {
        throw new Error('Extension expands beyond the allowed size');
      }
      requireRange(localHeaderOffset, 30, cdOffset);
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50 ||
          buffer.readUInt16LE(localHeaderOffset + 6) !== flags ||
          buffer.readUInt16LE(localHeaderOffset + 8) !== compression) {
        throw new Error('Invalid ZIP local header');
      }
      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      requireRange(localHeaderOffset + 30, localNameLen + localExtraLen, cdOffset);
      const localName = buffer.toString('utf8', localHeaderOffset + 30, localHeaderOffset + 30 + localNameLen);
      if (localName !== name) throw new Error('ZIP entry names do not match');
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      requireRange(dataStart, compressedSize, cdOffset);
      if (!(flags & 8) && (buffer.readUInt32LE(localHeaderOffset + 14) !== crc ||
          buffer.readUInt32LE(localHeaderOffset + 18) !== compressedSize ||
          buffer.readUInt32LE(localHeaderOffset + 22) !== uncompressedSize)) {
        throw new Error('ZIP entry sizes do not match');
      }
      entries.push({ relative, isDirectory, compression, compressedSize, uncompressedSize, crc, dataStart });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    if (pos !== cdEnd) throw new Error('Invalid ZIP central directory size');
    for (const entry of entries) {
      const parts = entry.relative.toLowerCase().split('/');
      for (let i = 1; i < parts.length; i++) {
        if (names.get(parts.slice(0, i).join('/')) === false) throw new Error('ZIP entry conflicts with a file');
      }
    }

    for (const entry of entries) {
      const resolved = extensionResourcePath(destDir, entry.relative);
      const rawData = buffer.subarray(entry.dataStart, entry.dataStart + entry.compressedSize);
      const data = entry.compression === 0 ? rawData : zlib.inflateRawSync(rawData, {
        maxOutputLength: Math.max(1, entry.uncompressedSize),
      });
      if (data.length !== entry.uncompressedSize || zlib.crc32(data) !== entry.crc) {
        throw new Error('ZIP entry failed its size or integrity check');
      }
      if (entry.isDirectory) {
        fs.mkdirSync(resolved, { recursive: true });
        continue;
      }
      fs.mkdirSync(path.dirname(resolved), { recursive: true });

      fs.writeFileSync(resolved, data, { flag: 'wx' });
    }
  }

  function directorySize(dirPath) {
    let total = 0;
    let files = 0;
    function visit(directory, depth) {
      if (depth > 100) throw new Error('Extension directory is too deeply nested');
      const stat = fs.lstatSync(directory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Extension directory must not contain symbolic links');
      const items = fs.readdirSync(directory, { withFileTypes: true });
      for (const item of items) {
        if (++files > MAX_EXTENSION_FILES) throw new Error('Extension has too many files');
        const full = extensionResourcePath(directory, item.name);
        const childStat = fs.lstatSync(full);
        if (childStat.isDirectory()) visit(full, depth + 1);
        else if (childStat.isFile()) {
          total += childStat.size;
          if (total > MAX_UNPACKED_SIZE) throw new Error('Extension directory is too large');
        } else {
          throw new Error('Extension directory contains an unsupported file');
        }
      }
    }
    visit(dirPath, 0);
    return total;
  }

  // Install an extension from a local CRX or unpacked directory.
  function installFromPath(extensionPath, options) {
    // A second installation must not replace directories while the first one is
    // awaiting Electron's asynchronous extension loader.
    const result = installQueue.then(() => performInstallFromPath(extensionPath, options));
    installQueue = result.catch(() => {});
    return result;
  }

  async function performInstallFromPath(extensionPath, options) {
    const opts = options || {};
    if (typeof extensionPath !== 'string' || !extensionPath) throw new Error('Invalid extension path');
    if (opts.extensionId !== undefined && (typeof opts.extensionId !== 'string' || !WEBSTORE_ID_PATTERN.test(opts.extensionId))) {
      throw new Error('Invalid Chrome Web Store extension id');
    }
    ensureExtensionsDir();
    const stat = fs.lstatSync(extensionPath);
    if (stat.isSymbolicLink()) throw new Error('Extension sources must not be symbolic links');
    const isCrx = /\.(crx|zip)$/i.test(extensionPath) && stat.isFile();
    if (!isCrx && !stat.isDirectory()) throw new Error('Choose an extension directory, CRX, or ZIP file');
    if (isCrx && stat.size > MAX_CRX_SIZE) throw new Error('Extension file is too large');
    if (!isCrx) directorySize(extensionPath);

    const extDir = fs.mkdtempSync(path.join(extensionsRoot, '_installing_'));
    let finalDir;
    let backupDir;
    let extId;
    let previousEntry;
    let replaced = false;
    let backedUp = false;
    try {
      if (isCrx) extractCrx(extensionPath, extDir);
      else fs.cpSync(extensionPath, extDir, { recursive: true, dereference: false });
      directorySize(extDir);

      let manifestDir = extDir;
      if (!fs.existsSync(path.join(manifestDir, 'manifest.json'))) {
        const sub = fs.readdirSync(manifestDir, { withFileTypes: true }).find((entry) =>
          entry.isDirectory() && fs.existsSync(path.join(manifestDir, entry.name, 'manifest.json')));
        if (sub) manifestDir = path.join(manifestDir, sub.name);
      }
      const manifest = parseManifest(manifestDir);
      extId = opts.extensionId || (manifest.key
        ? crypto.createHash('sha256').update(manifest.key).digest('hex').slice(0, 32)
        : crypto.randomBytes(16).toString('hex'));
      previousEntry = registry[extId];
      if (!registry[extId] && Object.keys(registry).length >= MAX_EXTENSIONS) {
        throw new Error('Maximum number of extensions reached (' + MAX_EXTENSIONS + ')');
      }
      finalDir = managedExtensionPath(extId);
      const icon = resolveExtensionIcon(manifest, manifestDir);
      installingIds.add(extId);
      if (fs.existsSync(finalDir)) {
        backupDir = fs.mkdtempSync(path.join(extensionsRoot, '_previous_'));
        fs.rmdirSync(backupDir);
        unloadExtension(extId);
        fs.renameSync(finalDir, backupDir);
        backedUp = true;
      }
      fs.renameSync(manifestDir, finalDir);
      replaced = true;
      registry[extId] = {
        name: manifest.name || 'Unknown Extension',
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        icon,
        enabled: true,
        manifestVersion: manifest.manifest_version || 2,
        permissions: manifest.permissions || [],
        browserAction: manifest.browser_action || manifest.action || null,
        homepageUrl: manifest.homepage_url || '',
        optionsPage: manifest.options_page || (manifest.options_ui && manifest.options_ui.page) || '',
        installedAt: Date.now(),
        size: directorySize(finalDir),
        path: finalDir,
      };
      await loadExtension(extId);
      saveRegistry();
      if (backupDir) {
        try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch (cleanupError) { /* A failed cleanup must not undo a committed installation. */ }
      }
      return publicExtension(extId);
    } catch (error) {
      if (replaced) {
        unloadExtension(extId);
        fs.rmSync(finalDir, { recursive: true, force: true });
      }
      if (backedUp) fs.renameSync(backupDir, finalDir);
      if (extId) {
        if (previousEntry) registry[extId] = previousEntry;
        else delete registry[extId];
        if (previousEntry && previousEntry.enabled !== false) {
          try { await loadExtension(extId); } catch (loadError) { /* Preserve the original installation error. */ }
        }
      }
      throw error;
    } finally {
      installingIds.delete(extId);
      fs.rmSync(extDir, { recursive: true, force: true });
    }
  }

  // Download and install from Chrome Web Store.
  async function installFromWebStore(extensionId, chromeVer) {
    if (typeof extensionId !== 'string' || !WEBSTORE_ID_PATTERN.test(extensionId)) {
      throw new Error('Invalid Chrome Web Store extension id');
    }
    ensureExtensionsDir();
    const ver = chromeVer || chromeVersion || '120.0.0.0';
    if (typeof ver !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(ver)) throw new Error('Invalid Chrome version');
    const downloadUrl = CHROME_WEBSTORE_CRX_URL
      .replace('%CHROME_VERSION%', ver)
      .replace('%EXTENSION_ID%', extensionId);

    const tempFile = path.join(extensionsRoot, '_download_' + crypto.randomBytes(16).toString('hex') + '.crx');

    // Download the CRX file with a 30-second timeout.
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 30000);
    try {
      let response;
      let nextUrl = downloadUrl;
      for (let redirects = 0; redirects <= 5; redirects++) {
        const parsed = new URL(nextUrl);
        if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password ||
            (parsed.hostname !== 'clients2.google.com' && !parsed.hostname.endsWith('.googleusercontent.com'))) {
          throw new Error('Unsafe Chrome Web Store download redirect');
        }
        response = await fetch(nextUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/' + ver },
          redirect: 'manual',
          signal: controller.signal,
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        if (response.body) await response.body.cancel();
        if (!location || redirects === 5) throw new Error('Too many or invalid Chrome Web Store redirects');
        nextUrl = new URL(location, nextUrl).href;
      }
      if (!response.ok) {
        throw new Error('Failed to download extension from Chrome Web Store (HTTP ' + response.status + ')');
      }

      const announcedSize = Number(response.headers.get('content-length'));
      if (announcedSize > MAX_CRX_SIZE) {
        if (response.body) await response.body.cancel();
        throw new Error('Extension is too large');
      }
      if (!response.body) throw new Error('Empty extension download');
      const reader = response.body.getReader();
      const output = fs.openSync(tempFile, 'wx');
      let totalSize = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalSize += value.byteLength;
          if (totalSize > MAX_CRX_SIZE) throw new Error('Extension is too large');
          fs.writeFileSync(output, value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally {
        fs.closeSync(output);
        reader.releaseLock();
      }
      clearTimeout(timeout);
      return await installFromPath(tempFile, { extensionId });
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Download timed out. Check your internet connection.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      try { fs.unlinkSync(tempFile); } catch (error) { /* ignore */ }
    }
  }

  function resolveExtensionIcon(manifest, extDir) {
    const icons = manifest.icons || {};
    const sizes = Object.keys(icons).map(Number).sort((a, b) => b - a);
    for (const size of sizes) {
      try {
        const iconPath = extensionResourcePath(extDir, icons[size]);
        if (fs.existsSync(iconPath)) {
          const stat = fs.statSync(iconPath);
          if (!stat.isFile() || stat.size > MAX_ICON_SIZE) continue;
          const ext = path.extname(iconPath).toLowerCase();
          if (!['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) continue;
          const data = fs.readFileSync(iconPath);
          const mime = ext === '.svg' ? 'image/svg+xml'
            : ext === '.png' ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                : ext === '.gif' ? 'image/gif'
                  : ext === '.webp' ? 'image/webp'
                : 'image/png';
          return 'data:' + mime + ';base64,' + data.toString('base64');
        }
      } catch (error) { /* Ignore missing, unsafe, or invalid icons. */ }
    }
    return '';
  }

  // Register a session so extensions are loaded into it.
  function registerSession(targetSession) {
    if (!targetSession || registeredSessions.has(targetSession)) return;
    registeredSessions.add(targetSession);
    // Load all currently-enabled extensions into the new session.
    for (const extId of Object.keys(registry)) {
      const entry = registry[extId];
      if (!entry || entry.enabled === false) continue;
      try {
        const extPath = managedExtensionPath(extId);
        directorySize(extPath);
        parseManifest(extPath);
        targetSession.loadExtension(extPath, { allowFileAccess: false }).catch(function (err) {
          if (isDev) console.error('Failed to load extension ' + extId + ' into session:', err.message);
        });
      } catch (error) {
        if (isDev) console.error('Failed to validate extension ' + extId + ':', error.message);
      }
    }
  }

  function unregisterSession(targetSession) {
    registeredSessions.delete(targetSession);
  }

  function isSessionRegistered(targetSession) {
    return registeredSessions.has(targetSession);
  }

  // Collect all sessions to load into: the hardcoded default + all registered.
  function allSessions() {
    const sessions = new Set(registeredSessions);
    // Always include the default partition as a fallback.
    try {
      sessions.add(session.fromPartition('persist:invictatill'));
    } catch (error) { /* ignore */ }
    return Array.from(sessions);
  }

  // Load extension into all registered sessions.
  async function loadExtension(extId) {
    const entry = registry[extId];
    if (!entry || entry.enabled === false) return null;
    if (loadedExtensions.has(extId)) return loadedExtensions.get(extId);

    const extPath = managedExtensionPath(extId);
    directorySize(extPath);
    parseManifest(extPath);

    var lastExt = null;
    var lastError = null;
    const targets = allSessions();
    for (const targetSession of targets) {
      try {
        const ext = await targetSession.loadExtension(extPath, { allowFileAccess: false });
        if (!lastExt) lastExt = ext;
      } catch (error) {
        lastError = error;
        if (isDev) console.error('Failed to load extension ' + extId + ' into session:', error.message);
      }
    }
    if (!lastExt) {
      throw new Error(lastError ? lastError.message : 'Failed to load extension into any session');
    }
    loadedExtensions.set(extId, lastExt);
    if (onStatusChange) onStatusChange('loaded', extId);
    return lastExt;
  }

  // Unload extension from all registered sessions.
  function unloadExtension(extId) {
    const ext = loadedExtensions.get(extId);
    if (!ext) return;
    for (const targetSession of allSessions()) {
      try {
        targetSession.removeExtension(ext.id);
      } catch (error) {
        // Extension may already be unloaded from this session.
      }
    }
    loadedExtensions.delete(extId);
    if (onStatusChange) onStatusChange('unloaded', extId);
  }

  // Enable/disable an extension.
  function toggleExtension(extId, enabled) {
    if (installingIds.has(extId)) throw new Error('Extension installation is still in progress');
    const entry = registry[extId];
    if (!entry) throw new Error('Extension not found');
    entry.enabled = Boolean(enabled);
    saveRegistry();
    if (enabled) {
      loadExtension(extId);
    } else {
      unloadExtension(extId);
    }
    return publicExtension(extId);
  }

  // Uninstall an extension completely.
  function uninstallExtension(extId) {
    if (installingIds.has(extId)) throw new Error('Extension installation is still in progress');
    ensureExtensionsDir();
    const extPath = managedExtensionPath(extId);
    unloadExtension(extId);
    const entry = registry[extId];
    if (entry && fs.existsSync(extPath)) {
      try {
        fs.rmSync(extPath, { recursive: true, force: true });
      } catch (error) { /* ignore cleanup errors */ }
    }
    delete registry[extId];
    saveRegistry();
    return { success: true };
  }

  // Load all enabled extensions at startup.
  async function loadAllExtensions() {
    ensureExtensionsDir();
    loadRegistry();
    const results = [];
    for (const extId of Object.keys(registry)) {
      if (registry[extId].enabled !== false) {
        try {
          await loadExtension(extId);
          results.push({ id: extId, loaded: true });
        } catch (error) {
          results.push({ id: extId, loaded: false, error: error.message });
        }
      }
    }
    return results;
  }

  // Get the popup URL for a browser action.
  function getExtensionPopup(extId) {
    const entry = registry[extId];
    if (!entry) return null;
    const ext = loadedExtensions.get(extId);
    if (!ext) return null;
    const action = entry.browserAction;
    if (!action || !action.default_popup) return null;
    try {
      const popupPath = extensionResourcePath(managedExtensionPath(extId), action.default_popup);
      if (!fs.existsSync(popupPath) || !fs.statSync(popupPath).isFile()) return null;
      return {
        url: 'chrome-extension://' + ext.id + '/' + safeRelativePath(action.default_popup).split('/').map(encodeURIComponent).join('/'),
        width: 400,
        height: 600,
      };
    } catch (error) { return null; }
  }

  // Get options page URL.
  function getExtensionOptionsUrl(extId) {
    const entry = registry[extId];
    if (!entry) return null;
    const ext = loadedExtensions.get(extId);
    if (!ext) return null;
    if (!entry.optionsPage) return null;
    try {
      const optionsPath = extensionResourcePath(managedExtensionPath(extId), entry.optionsPage);
      if (!fs.existsSync(optionsPath) || !fs.statSync(optionsPath).isFile()) return null;
      return 'chrome-extension://' + ext.id + '/' + safeRelativePath(entry.optionsPage).split('/').map(encodeURIComponent).join('/');
    } catch (error) { return null; }
  }

  // Search Chrome Web Store (simple name-based filtering from our curated list).
  function searchExtensions(query) {
    const lower = (query || '').toLowerCase().trim();
    if (!lower) return FEATURED_EXTENSIONS;
    return FEATURED_EXTENSIONS.filter((ext) =>
      ext.name.toLowerCase().includes(lower) ||
      ext.description.toLowerCase().includes(lower) ||
      ext.category.toLowerCase().includes(lower)
    ).map((ext) => ({
      ...ext,
      installed: Boolean(registry[ext.id]),
      enabled: registry[ext.id] ? registry[ext.id].enabled !== false : false,
    }));
  }

  return {
    loadAllExtensions,
    getInstalledExtensions,
    getFeaturedExtensions,
    getCategories,
    searchExtensions,
    installFromPath,
    installFromWebStore,
    toggleExtension,
    uninstallExtension,
    getExtensionPopup,
    getExtensionOptionsUrl,
    publicExtension,
    registerSession,
    unregisterSession,
    isSessionRegistered,
  };
}

module.exports = { createExtensionManager };
