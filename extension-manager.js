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
const { session, app, BrowserWindow } = require('electron');

const EXTENSIONS_DIR_NAME = 'extensions';
const EXTENSION_REGISTRY_FILE = 'extension-registry.json';
const MAX_EXTENSIONS = 50;
const MAX_CRX_SIZE = 200 * 1024 * 1024; // 200 MB max CRX size
const CRX_MAGIC = Buffer.from('Cr24');
const CHROME_WEBSTORE_PATTERN = /^https?:\/\/chromewebstore\.google\.com\/detail\/([^/]+)\/([a-z]{32})/i;
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
  const { store, chromeVersion, isDev, onStatusChange } = options;
  const extensionsRoot = path.join(app.getPath('userData'), EXTENSIONS_DIR_NAME);
  const registryPath = path.join(extensionsRoot, EXTENSION_REGISTRY_FILE);
  let registry = {};
  let loadedExtensions = new Map();

  function ensureExtensionsDir() {
    fs.mkdirSync(extensionsRoot, { recursive: true });
  }

  function loadRegistry() {
    try {
      if (fs.existsSync(registryPath)) {
        registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      }
    } catch (error) {
      registry = {};
    }
    if (typeof registry !== 'object' || registry === null || Array.isArray(registry)) {
      registry = {};
    }
  }

  function saveRegistry() {
    ensureExtensionsDir();
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
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
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Extension manifest.json not found');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('Invalid extension manifest');
    }
    return manifest;
  }

  // Extract CRX3 file to a directory.
  function extractCrx(crxPath, destDir) {
    const buffer = fs.readFileSync(crxPath);
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
      const zipBuffer = buffer.slice(zipStart);
      const tempZip = path.join(destDir, '_temp_ext.zip');
      fs.writeFileSync(tempZip, zipBuffer);
      extractZip(tempZip, destDir);
      try { fs.unlinkSync(tempZip); } catch (error) { /* ignore */ }
    } else if (version === 2) {
      const pubKeyLen = buffer.readUInt32LE(8);
      const sigLen = buffer.readUInt32LE(12);
      const zipStart = 16 + pubKeyLen + sigLen;
      if (zipStart >= buffer.length) throw new Error('Invalid CRX2 header');
      const zipBuffer = buffer.slice(zipStart);
      const tempZip = path.join(destDir, '_temp_ext.zip');
      fs.writeFileSync(tempZip, zipBuffer);
      extractZip(tempZip, destDir);
      try { fs.unlinkSync(tempZip); } catch (error) { /* ignore */ }
    } else {
      throw new Error('Unsupported CRX version: ' + version);
    }
  }

  // Simple ZIP extraction using built-in zlib + manual parsing.
  function extractZip(zipPath, destDir) {
    const zlib = require('zlib');
    const buffer = fs.readFileSync(zipPath);
    const entries = [];

    // Parse ZIP central directory.
    let eocdOffset = -1;
    for (let i = buffer.length - 22; i >= 0; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) throw new Error('Invalid ZIP file');

    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    const cdEntries = buffer.readUInt16LE(eocdOffset + 10);
    let pos = cdOffset;

    for (let i = 0; i < cdEntries; i++) {
      if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
      const compression = buffer.readUInt16LE(pos + 10);
      const compressedSize = buffer.readUInt32LE(pos + 20);
      const uncompressedSize = buffer.readUInt32LE(pos + 24);
      const nameLen = buffer.readUInt16LE(pos + 28);
      const extraLen = buffer.readUInt16LE(pos + 30);
      const commentLen = buffer.readUInt16LE(pos + 32);
      const localHeaderOffset = buffer.readUInt32LE(pos + 42);
      const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLen);
      entries.push({ name, compression, compressedSize, uncompressedSize, localHeaderOffset });
      pos += 46 + nameLen + extraLen + commentLen;
    }

    for (const entry of entries) {
      const fullPath = path.join(destDir, ...entry.name.split('/'));
      if (entry.name.endsWith('/')) {
        fs.mkdirSync(fullPath, { recursive: true });
        continue;
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      // Read local file header to get data offset.
      const localPos = entry.localHeaderOffset;
      if (buffer.readUInt32LE(localPos) !== 0x04034b50) continue;
      const localNameLen = buffer.readUInt16LE(localPos + 26);
      const localExtraLen = buffer.readUInt16LE(localPos + 28);
      const dataStart = localPos + 30 + localNameLen + localExtraLen;
      const rawData = buffer.slice(dataStart, dataStart + entry.compressedSize);

      if (entry.compression === 0) {
        // Stored (no compression).
        fs.writeFileSync(fullPath, rawData);
      } else if (entry.compression === 8) {
        // Deflated.
        try {
          const inflated = zlib.inflateRawSync(rawData);
          fs.writeFileSync(fullPath, inflated);
        } catch (error) {
          // Try with zlib.inflateSync as fallback.
          try {
            const inflated = zlib.inflateSync(rawData);
            fs.writeFileSync(fullPath, inflated);
          } catch (error2) {
            // Skip corrupt files.
          }
        }
      }
    }
  }

  function directorySize(dirPath) {
    let total = 0;
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dirPath, item.name);
        if (item.isDirectory()) total += directorySize(full);
        else {
          try { total += fs.statSync(full).size; } catch (error) { /* ignore */ }
        }
      }
    } catch (error) { /* ignore */ }
    return total;
  }

  // Install an extension from a local CRX or unpacked directory.
  async function installFromPath(extensionPath, options) {
    const opts = options || {};
    ensureExtensionsDir();

    let extDir = extensionPath;
    const isCrx = extensionPath.endsWith('.crx') || extensionPath.endsWith('.zip');

    if (isCrx) {
      const stat = fs.statSync(extensionPath);
      if (stat.size > MAX_CRX_SIZE) throw new Error('Extension file is too large');
      const tempId = crypto.randomBytes(8).toString('hex');
      extDir = path.join(extensionsRoot, '_installing_' + tempId);
      fs.mkdirSync(extDir, { recursive: true });
      extractCrx(extensionPath, extDir);
    }

    // Find manifest (may be in a subdirectory).
    let manifestDir = extDir;
    if (!fs.existsSync(path.join(manifestDir, 'manifest.json'))) {
      const sub = fs.readdirSync(manifestDir).find((d) =>
        fs.existsSync(path.join(manifestDir, d, 'manifest.json'))
      );
      if (sub) manifestDir = path.join(manifestDir, sub);
    }

    const manifest = parseManifest(manifestDir);
    const extId = opts.extensionId || manifest.key
      ? crypto.createHash('sha256').update(manifest.key || manifest.name || '').digest('hex').slice(0, 32)
      : crypto.randomBytes(16).toString('hex');

    if (Object.keys(registry).length >= MAX_EXTENSIONS) {
      throw new Error('Maximum number of extensions reached (' + MAX_EXTENSIONS + ')');
    }

    // Move to final location.
    const finalDir = path.join(extensionsRoot, extId);
    if (manifestDir !== finalDir) {
      if (fs.existsSync(finalDir)) {
        fs.rmSync(finalDir, { recursive: true, force: true });
      }
      fs.cpSync(manifestDir, finalDir, { recursive: true });
      if (isCrx && extDir !== extensionPath) {
        fs.rmSync(extDir, { recursive: true, force: true });
      }
    }

    const icon = resolveExtensionIcon(manifest, finalDir);

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
    saveRegistry();

    // Try loading the extension immediately.
    await loadExtension(extId);

    return publicExtension(extId);
  }

  // Download and install from Chrome Web Store.
  async function installFromWebStore(extensionId, chromeVer) {
    ensureExtensionsDir();
    const ver = chromeVer || chromeVersion || '120.0.0.0';
    const downloadUrl = CHROME_WEBSTORE_CRX_URL
      .replace('%CHROME_VERSION%', ver)
      .replace('%EXTENSION_ID%', extensionId);

    const tempFile = path.join(extensionsRoot, extensionId + '.crx');

    // Download the CRX file.
    const response = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/' + ver },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error('Failed to download extension from Chrome Web Store (HTTP ' + response.status + ')');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_CRX_SIZE) {
      throw new Error('Extension is too large');
    }

    fs.writeFileSync(tempFile, buffer);

    try {
      const result = await installFromPath(tempFile, { extensionId });
      return result;
    } finally {
      try { fs.unlinkSync(tempFile); } catch (error) { /* ignore */ }
    }
  }

  function resolveExtensionIcon(manifest, extDir) {
    const icons = manifest.icons || {};
    const sizes = Object.keys(icons).map(Number).sort((a, b) => b - a);
    for (const size of sizes) {
      const iconPath = path.join(extDir, icons[size]);
      if (fs.existsSync(iconPath)) {
        try {
          const data = fs.readFileSync(iconPath);
          const ext = path.extname(iconPath).toLowerCase();
          const mime = ext === '.svg' ? 'image/svg+xml'
            : ext === '.png' ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                : 'image/png';
          return 'data:' + mime + ';base64,' + data.toString('base64');
        } catch (error) { /* continue to next */ }
      }
    }
    return '';
  }

  // Load extension into the browser session.
  async function loadExtension(extId) {
    const entry = registry[extId];
    if (!entry || entry.enabled === false) return null;
    if (loadedExtensions.has(extId)) return loadedExtensions.get(extId);

    try {
      const extPath = entry.path || path.join(extensionsRoot, extId);
      if (!fs.existsSync(path.join(extPath, 'manifest.json'))) {
        return null;
      }
      const browserSession = session.fromPartition('persist:invictatill');
      const ext = await browserSession.loadExtension(extPath, {
        allowFileAccess: true,
      });
      loadedExtensions.set(extId, ext);
      if (onStatusChange) onStatusChange('loaded', extId);
      return ext;
    } catch (error) {
      if (isDev) console.error('Failed to load extension ' + extId + ':', error.message);
      return null;
    }
  }

  // Unload extension from the session.
  function unloadExtension(extId) {
    const ext = loadedExtensions.get(extId);
    if (!ext) return;
    try {
      const browserSession = session.fromPartition('persist:invictatill');
      browserSession.removeExtension(ext.id);
    } catch (error) {
      // Extension may already be unloaded.
    }
    loadedExtensions.delete(extId);
    if (onStatusChange) onStatusChange('unloaded', extId);
  }

  // Enable/disable an extension.
  function toggleExtension(extId, enabled) {
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
    unloadExtension(extId);
    const entry = registry[extId];
    if (entry && entry.path && fs.existsSync(entry.path)) {
      try {
        fs.rmSync(entry.path, { recursive: true, force: true });
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
    const popupPath = path.join(entry.path, action.default_popup);
    if (!fs.existsSync(popupPath)) return null;
    return {
      url: 'chrome-extension://' + ext.id + '/' + action.default_popup,
      width: 400,
      height: 600,
    };
  }

  // Get options page URL.
  function getExtensionOptionsUrl(extId) {
    const entry = registry[extId];
    if (!entry) return null;
    const ext = loadedExtensions.get(extId);
    if (!ext) return null;
    if (!entry.optionsPage) return null;
    return 'chrome-extension://' + ext.id + '/' + entry.optionsPage;
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
  };
}

module.exports = { createExtensionManager };
