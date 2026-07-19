/* ═══════════════════════════════════════════════════════════════════════════
   InvictaTill Browser — Renderer Process
   Tab management, HUD, performance modes, navigation
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const api = window.electronAPI;

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  tabs: [],           // { id, title, url }
  activeTabId: null,
  gamingMode: 0,      // 0=Normal, 1=Gaming, 2=Ultra
  hudVisible: false,
  zoomFactor: 1.0,
  isFullscreen: false,
  isNewTabPage: true,
};

// ─── DOM References ───────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const tabsContainer  = $('tabs-container');
const addressBar     = $('address-bar');
const newTabPage     = $('new-tab-page');
const hudOverlay     = $('hud-overlay');
const dropdownMenu   = $('dropdown-menu');
const ntpSearch      = $('ntp-search');
const hudFps         = $('hud-fps');
const hudPing        = $('hud-ping');
const hudMem         = $('hud-mem');
const hudGpu         = $('hud-gpu');
const hudMode        = $('hud-mode');
const statFpsNtp     = $('stat-fps-ntp');
const statNet        = $('stat-net');
const gamingModeBtn  = $('btn-gaming-mode');
const modeLabel      = gamingModeBtn.querySelector('.mode-label');

// ─── Notifications ────────────────────────────────────────────────────────────
function notify(message, type = 'info', duration = 2800) {
  const stack = $('notification-stack');
  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.innerHTML = `<div class="notif-dot"></div><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('notif-fade');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ─── Tab DOM ──────────────────────────────────────────────────────────────────
function renderTab(tab) {
  let el = document.querySelector(`[data-tab-id="${tab.id}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'tab-item';
    el.setAttribute('data-tab-id', tab.id);
    el.innerHTML = `
      <div class="tab-favicon" style="pointer-events:none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="pointer-events:none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M6 20.7A6 6 0 0 1 18 20.7" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
        </svg>
      </div>
      <span class="tab-title" style="pointer-events:none">${escHtml(tab.title || 'New Tab')}</span>
      <button class="tab-mute-btn" title="Mute/Unmute Tab">🔊</button>
      <button class="tab-close" title="Close Tab">
        <svg width="10" height="10" viewBox="0 0 10 10" style="pointer-events:none">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // Per-tab mute button
    const muteBtnEl = el.querySelector('.tab-mute-btn');
    let isTabMuted = false;
    muteBtnEl.addEventListener('click', async (e) => {
      e.stopPropagation();
      isTabMuted = !isTabMuted;
      await api.muteTabById(tab.id, isTabMuted);
      muteBtnEl.textContent = isTabMuted ? '🔇' : '🔊';
      muteBtnEl.classList.toggle('is-muted', isTabMuted);
      notify(isTabMuted ? `🔇 Muted tab "${tab.title || 'Tab'}"` : `🔊 Unmuted tab "${tab.title || 'Tab'}"`, 'info', 1800);
    });

    // Tab switch — only fires if close or mute buttons were NOT clicked
    el.addEventListener('click', e => {
      if (!e.target.classList.contains('tab-close') && !e.target.classList.contains('tab-mute-btn')) {
        api.switchTab(tab.id);
      }
    });

    // Close button — separate listener with stopPropagation
    const closeBtn = el.querySelector('.tab-close');
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      api.closeTab(tab.id);
    });

    tabsContainer.appendChild(el);
  } else {
    el.querySelector('.tab-title').textContent = tab.title || 'New Tab';
  }
  return el;
}


function setActiveTab(id) {
  document.querySelectorAll('.tab-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.tabId) === id);
  });
  state.activeTabId = id;
}

function removeTab(id) {
  const el = document.querySelector(`[data-tab-id="${id}"]`);
  if (el) el.remove();
  state.tabs = state.tabs.filter(t => t.id !== id);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── New Tab Page ─────────────────────────────────────────────────────────────
function showNewTabPage() {
  newTabPage.classList.add('visible');
  state.isNewTabPage = true;
  addressBar.value = '';
  // Hide the BrowserView so the NTP HTML is clickable
  api.setViewVisible(false);
}

function hideNewTabPage() {
  newTabPage.classList.remove('visible');
  state.isNewTabPage = false;
  // Show the BrowserView over the content area
  api.setViewVisible(true);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
async function navigateTo(url) {
  if (!url || url === 'about:blank') {
    showNewTabPage(); // this also hides the BrowserView
    return;
  }
  // Show BrowserView first, then load URL
  hideNewTabPage();
  const finalUrl = await api.navigate(url);
  if (finalUrl) addressBar.value = finalUrl;
}

// ─── Gaming Mode ──────────────────────────────────────────────────────────────
const modeNames = ['Normal', 'Gaming', 'Ultra'];
const modeClasses = ['mode-normal', 'mode-gaming', 'mode-ultra'];
const modeBtnClasses = ['', 'mode-gaming', 'mode-ultra'];

async function setGamingMode(level) {
  state.gamingMode = level;

  // Update body class
  document.body.classList.remove(...modeClasses);
  document.body.classList.add(modeClasses[level]);

  // Update nav button
  gamingModeBtn.classList.remove('mode-gaming', 'mode-ultra');
  if (modeBtnClasses[level]) gamingModeBtn.classList.add(modeBtnClasses[level]);
  modeLabel.textContent = modeNames[level];

  // Update titlebar mode pill
  const titlePill = document.getElementById('title-mode-pill');
  const titlePillText = document.getElementById('title-mode-text');
  if (titlePill && titlePillText) {
    titlePillText.textContent = modeNames[level];
    titlePill.className = 'title-mode-pill';
  }

  // Update HUD mode display
  hudMode.textContent = modeNames[level];

  // Update perf cards
  document.querySelectorAll('.perf-card').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.mode) === level);
  });

  // Apply in main process (returns killedApps list for Ultra mode)
  const result = await api.setGamingMode(level);

  // Boost GPU and renderer process priority when entering any gaming mode
  if (level > 0) {
    api.boostGpuPriority().catch(() => {});
  }

  if (level === 0) {
    notify('✅ Normal mode — Restored standard performance', 'info');
  } else if (level === 1) {
    notify('🎮 Gaming Mode ON — GPU+CPU priority boosted, display stay-on locked!', 'success');
  } else if (level === 2) {
    // Show what was killed
    const killed = result?.killedApps || [];
    if (killed.length > 0) {
      notify(`⚡ Ultra Gaming ON — Killed ${killed.length} background apps!`, 'warning', 4000);
      setTimeout(() => {
        notify(`🔴 Closed: ${killed.slice(0,5).join(', ')}${killed.length > 5 ? ` +${killed.length-5} more` : ''}`, 'warning', 5000);
      }, 800);
    } else {
      notify('⚡ Ultra Gaming ON — Maximum performance! No background apps found.', 'warning', 4000);
    }
    notify('🔒 CPU + GPU + Renderer set to HIGH priority', 'success', 3000);
  }
}

// ─── FPS Counter ──────────────────────────────────────────────────────────────
let fps = 0;
let fpsFrameCount = 0;
let fpsLastTime = performance.now();

function fpsLoop() {
  fpsFrameCount++;
  const now = performance.now();
  const delta = now - fpsLastTime;
  if (delta >= 1000) {
    fps = Math.round(fpsFrameCount * 1000 / delta);
    fpsFrameCount = 0;
    fpsLastTime = now;
    updateHudFps(fps);
  }
  requestAnimationFrame(fpsLoop);
}
requestAnimationFrame(fpsLoop);

function updateHudFps(val) {
  hudFps.textContent = val;
  if (statFpsNtp) statFpsNtp.textContent = val;
  // Thresholds: 58+ = great (green), 45+ = ok (orange), below = bad (red)
  hudFps.className = 'hud-value fps-val' + (val >= 58 ? ' good' : val >= 45 ? ' ok' : ' bad');
}

// ─── Memory Monitor ───────────────────────────────────────────────────────────
function updateMemory() {
  if (performance.memory) {
    const used = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
    const total = Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024));
    hudMem.textContent = `${used}MB`;
  } else {
    hudMem.textContent = 'N/A';
  }
}
setInterval(updateMemory, 2000);

// ─── Network Quality ──────────────────────────────────────────────────────────
function updateNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    const type = conn.effectiveType || conn.type || '—';
    const dl = conn.downlink ? `${conn.downlink}Mb` : '';
    if (statNet) statNet.textContent = dl ? `${type} ${dl}` : type;
  } else {
    if (statNet) statNet.textContent = 'Unknown';
  }
}
updateNetworkInfo();
if (navigator.connection) navigator.connection.addEventListener('change', updateNetworkInfo);

// ─── Ping Estimator ───────────────────────────────────────────────────────────
// We can't ping servers from renderer, but we can estimate using fetch timing
let pingMs = 0;
async function estimatePing() {
  try {
    const start = performance.now();
    await fetch('https://www.google.com/favicon.ico?r=' + Math.random(), {
      mode: 'no-cors', cache: 'no-store'
    });
    pingMs = Math.round(performance.now() - start);
    hudPing.textContent = pingMs + 'ms';
    hudPing.style.color = pingMs < 60 ? 'var(--green)' : pingMs < 120 ? 'var(--orange)' : 'var(--red)';
  } catch {
    hudPing.textContent = '—';
  }
}
setInterval(estimatePing, 5000);
estimatePing();

// ─── System Info ──────────────────────────────────────────────────────────────
async function loadSystemInfo() {
  const info = await api.getSystemInfo();
  const cpuEl = $('stat-cpu');
  const ramEl = $('stat-ram');
  if (cpuEl) cpuEl.textContent = info.cpus + ' cores';
  if (ramEl) ramEl.textContent = info.totalMemory + ' GB';
}
loadSystemInfo();

// ─── GPU HUD Monitor ─────────────────────────────────────────────────────────────
function updateGpuHud() {
  if (!hudGpu) return;
  // Show D3D11 status — GPU is always active due to our flags
  hudGpu.textContent = 'D3D11';
  hudGpu.style.color = 'var(--green)';
}
updateGpuHud();

// ─── HUD Toggle ───────────────────────────────────────────────────────────────
function toggleHud() {
  state.hudVisible = !state.hudVisible;
  hudOverlay.classList.toggle('hidden', !state.hudVisible);
  $('btn-hud').classList.toggle('active', state.hudVisible);
  if (state.hudVisible) {
    updateMemory();
    estimatePing();
    updateGpuHud();
  }
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
api.on('fullscreen-change', (isFs) => {
  state.isFullscreen = isFs;
  document.body.classList.toggle('fullscreen', isFs);
});

// ─── Tab Events (from main process) ──────────────────────────────────────────
api.on('tab-created', ({ id, url, title }) => {
  state.tabs.push({ id, url: url || '', title: title || 'New Tab' });
  renderTab({ id, url: url || '', title: title || 'New Tab' });
  setActiveTab(id);
  if (!url || url === 'about:blank') showNewTabPage();
  else hideNewTabPage();
});

api.on('tab-closed', (id) => {
  removeTab(id);
});

api.on('tab-switched', (id) => {
  setActiveTab(id);
  state.activeTabId = id;
  // Update address bar
  api.getActiveUrl().then(url => {
    addressBar.value = url === 'about:blank' ? '' : (url || '');
    if (!url || url === 'about:blank') showNewTabPage();
    else hideNewTabPage();
  });
});

api.on('tab-update', ({ id, title, url }) => {
  const tab = state.tabs.find(t => t.id === id);
  if (tab) { tab.title = title; tab.url = url || tab.url; }
  const el = document.querySelector(`[data-tab-id="${id}"]`);
  if (el) el.querySelector('.tab-title').textContent = title || 'Loading...';
  if (id === state.activeTabId) {
    if (url && url !== 'about:blank') {
      addressBar.value = url;
      hideNewTabPage();
    }
  }
});

api.on('tab-navigated', ({ id, url }) => {
  const tab = state.tabs.find(t => t.id === id);
  if (tab) tab.url = url;
  if (id === state.activeTabId) {
    if (url && url !== 'about:blank') {
      addressBar.value = url;
      hideNewTabPage();
    } else {
      addressBar.value = '';
      showNewTabPage();
    }
  }
});

// ─── Dropdown Menu ────────────────────────────────────────────────────────────
function toggleDropdown(e) {
  e.stopPropagation();
  dropdownMenu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  if (!dropdownMenu.contains(e.target) && e.target !== $('btn-menu')) {
    dropdownMenu.classList.add('hidden');
  }
});

// ─── Zoom ─────────────────────────────────────────────────────────────────────
function setZoom(factor) {
  state.zoomFactor = Math.max(0.5, Math.min(2.0, factor));
  $('zoom-display').textContent = Math.round(state.zoomFactor * 100) + '%';
  api.setZoom(state.zoomFactor);
}

// ─── Platform Cards ───────────────────────────────────────────────────────────
document.querySelectorAll('.platform-card').forEach(card => {
  card.addEventListener('click', () => {
    const url = card.dataset.url;
    const name = card.dataset.name;
    if (state.activeTabId !== null) {
      navigateTo(url);
      notify(`🚀 Opening ${name}...`, 'success');
    }
  });
});

// ─── Performance Mode Cards ───────────────────────────────────────────────────
document.querySelectorAll('.perf-card').forEach(card => {
  card.addEventListener('click', () => {
    setGamingMode(parseInt(card.dataset.mode));
  });
});

// ─── Button Event Listeners ───────────────────────────────────────────────────
$('btn-minimize').addEventListener('click', () => api.minimize());
$('btn-maximize').addEventListener('click', () => api.maximize());
$('btn-close').addEventListener('click', () => api.closeWindow());

$('btn-new-tab').addEventListener('click', () => api.newTab());
$('btn-back').addEventListener('click', () => api.goBack());
$('btn-forward').addEventListener('click', () => api.goForward());
$('btn-reload').addEventListener('click', () => api.reload());
$('btn-fullscreen').addEventListener('click', () => api.toggleFullscreen());
$('btn-gaming-mode').addEventListener('click', () => setGamingMode((state.gamingMode + 1) % 3));
$('btn-hud').addEventListener('click', () => toggleHud());
$('btn-menu').addEventListener('click', toggleDropdown);
$('btn-go').addEventListener('click', () => navigateTo(addressBar.value.trim()));

// Address bar enter
addressBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') navigateTo(addressBar.value.trim());
});
addressBar.addEventListener('focus', () => addressBar.select());

// NTP Search
$('ntp-search-btn').addEventListener('click', () => {
  const q = ntpSearch.value.trim();
  if (q) navigateTo(q);
});
ntpSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = ntpSearch.value.trim();
    if (q) navigateTo(q);
  }
});

// Dropdown items
$('dm-clear-cache').addEventListener('click', async () => {
  await api.clearCache();
  notify('🧹 Cache cleared & memory optimized!', 'success');
  dropdownMenu.classList.add('hidden');
});
$('dm-pointer-lock').addEventListener('click', () => {
  api.injectPointerLock();
  notify('🖱️ Click in game to lock your mouse pointer', 'info');
  dropdownMenu.classList.add('hidden');
});
$('dm-devtools').addEventListener('click', () => {
  api.openDevTools();
  dropdownMenu.classList.add('hidden');
});
$('dm-zoom-out').addEventListener('click', () => setZoom(state.zoomFactor - 0.1));
$('dm-zoom-in').addEventListener('click', () => setZoom(state.zoomFactor + 0.1));
$('dm-zoom-reset').addEventListener('click', () => setZoom(1.0));

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key === 't') { e.preventDefault(); api.newTab(); }
  if (ctrl && e.key === 'w') { e.preventDefault(); if (state.activeTabId) api.closeTab(state.activeTabId); }
  if (ctrl && e.key === 'g') { e.preventDefault(); setGamingMode((state.gamingMode + 1) % 3); }
  if (ctrl && e.key === 'h') { e.preventDefault(); toggleHud(); }
  if (ctrl && e.key === 'l') { e.preventDefault(); addressBar.focus(); }
  if (e.key === 'Escape' && state.isFullscreen) api.toggleFullscreen();
});

// ─── Anti-Throttle Worker ────────────────────────────────────────────────────
// Keeps the renderer thread alive and prevents background tab throttling
const antiThrottleBlob = new Blob([`
  let active = true;
  self.onmessage = (e) => { active = e.data; };
  function keepAlive() {
    if (active) {
      const start = Date.now();
      while (Date.now() - start < 1) {} // micro-spin
    }
    setTimeout(keepAlive, 500);
  }
  keepAlive();
`], { type: 'application/javascript' });
const antiThrottleWorker = new Worker(URL.createObjectURL(antiThrottleBlob));

// Enable anti-throttle when gaming mode is active
document.addEventListener('gamingModeChanged', (e) => {
  antiThrottleWorker.postMessage(e.detail > 0);
});

// ─── Wake Lock API ────────────────────────────────────────────────────────────
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      notify('☀️ Screen wake lock active — display will stay on', 'info', 2000);
    }
  } catch (err) { /* Not supported or denied */ }
}
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible' && state.gamingMode > 0) {
    await requestWakeLock();
  }
});

// Wrap setGamingMode to also manage wake lock
const _originalSetGamingMode = setGamingMode;
// (already handles all state above)

// ─── Init ─────────────────────────────────────────────────────────────────────
showNewTabPage();
updateMemory();

// ═══════════════════════════════════════════════════════════════════════════════
//  NEW FEATURES — v1.1.0
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Version Display ──────────────────────────────────────────────────────────
api.getVersion().then(v => {
  const el = $('about-version');
  if (el) el.textContent = `v${v}`;
});

// ─── Bookmarks ────────────────────────────────────────────────────────────────
let bookmarks = [];

async function loadBookmarks() {
  bookmarks = await api.getBookmarks();
  renderBookmarks();
}

function renderBookmarks() {
  const grid = $('bookmarks-grid');
  const empty = $('bookmarks-empty');
  if (!grid) return;
  // Remove existing chips
  grid.querySelectorAll('.bookmark-chip').forEach(el => el.remove());
  if (bookmarks.length === 0) {
    if (empty) empty.style.display = '';
  } else {
    if (empty) empty.style.display = 'none';
    bookmarks.forEach((bm, idx) => {
      const chip = document.createElement('button');
      chip.className = 'bookmark-chip';
      chip.innerHTML = `
        <span class="bm-title" title="${bm.url}">⭐ ${bm.title || bm.url}</span>
        <span class="bm-del" title="Remove">✕</span>
      `;
      chip.querySelector('.bm-title').addEventListener('click', () => navigateTo(bm.url));
      chip.querySelector('.bm-del').addEventListener('click', (e) => {
        e.stopPropagation();
        bookmarks.splice(idx, 1);
        api.saveBookmarks(bookmarks);
        renderBookmarks();
        updateStarBtn();
      });
      grid.appendChild(chip);
    });
  }
  updateStarBtn();
}

function updateStarBtn() {
  const starBtn = $('btn-bookmark-star');
  if (!starBtn) return;
  const currentUrl = addressBar.value;
  const isBookmarked = bookmarks.some(b => b.url === currentUrl);
  starBtn.classList.toggle('bookmarked', isBookmarked);
  const poly = document.getElementById('star-icon-poly');
  if (poly) poly.setAttribute('fill', isBookmarked ? '#f59e0b' : 'none');
}

async function toggleBookmark() {
  const url = addressBar.value || '';
  if (!url || url === 'about:blank') return;
  const idx = bookmarks.findIndex(b => b.url === url);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    notify('⭐ Bookmark removed', 'info', 1800);
  } else {
    const title = document.querySelector('.tab-item.active .tab-title')?.textContent || url;
    bookmarks.push({ url, title });
    notify('⭐ Bookmarked! View on New Tab page', 'success', 2000);
  }
  await api.saveBookmarks(bookmarks);
  renderBookmarks();
}

// Bookmark star button
const starBtn = $('btn-bookmark-star');
if (starBtn) starBtn.addEventListener('click', toggleBookmark);

// Clear all bookmarks
const clearBmBtn = $('clear-bookmarks-btn');
if (clearBmBtn) clearBmBtn.addEventListener('click', async () => {
  bookmarks = [];
  await api.saveBookmarks(bookmarks);
  renderBookmarks();
  notify('🗑️ All bookmarks cleared', 'info', 1800);
});

// IPC: bookmark from right-click context menu
api.on('bookmark-current', () => toggleBookmark());

// Update star when URL changes
api.on('tab-navigated', () => setTimeout(updateStarBtn, 100));

// Load bookmarks on startup
loadBookmarks();

// ─── Find in Page ─────────────────────────────────────────────────────────────
const findBar  = $('find-bar');
const findInput = $('find-input');
const findResults = $('find-results');
const findPrev = $('find-prev');
const findNext = $('find-next');
const findClose = $('find-close');

function openFindBar() {
  if (state.isNewTabPage) return;
  findBar.classList.remove('hidden');
  findInput.focus();
  findInput.select();
}

function closeFindBar() {
  findBar.classList.add('hidden');
  api.stopFind();
  findResults.textContent = '0/0';
  findInput.value = '';
}

function doFind(forward = true) {
  const text = findInput.value.trim();
  if (!text) { findResults.textContent = '0/0'; return; }
  api.findInPage(text, { forward, findNext: true, matchCase: false });
}

if (findInput) {
  findInput.addEventListener('input', () => {
    const text = findInput.value.trim();
    if (text) api.findInPage(text, { forward: true, findNext: false, matchCase: false });
    else { api.stopFind(); findResults.textContent = '0/0'; }
  });
  findInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); doFind(!e.shiftKey); }
    if (e.key === 'Escape') { e.preventDefault(); closeFindBar(); }
  });
}
if (findPrev)  findPrev.addEventListener('click',  () => doFind(false));
if (findNext)  findNext.addEventListener('click',  () => doFind(true));
if (findClose) findClose.addEventListener('click', () => closeFindBar());

// Listen for find results from main process
api.on('found-in-page-result', (result) => {
  if (findResults) {
    if (result.matches === 0) {
      findResults.textContent = 'No results';
      findResults.style.color = 'var(--red)';
    } else {
      findResults.textContent = `${result.activeMatchOrdinal}/${result.matches}`;
      findResults.style.color = 'var(--text-3)';
    }
  }
});

// Show find bar from context menu
api.on('show-find-bar', () => openFindBar());

// ─── Mute Tab ─────────────────────────────────────────────────────────────────
let isMuted = false;
const muteBtn = $('btn-mute');

function updateMuteIcon() {
  if (!muteBtn) return;
  const title = isMuted ? 'Unmute Tab (Ctrl+M)' : 'Mute Tab (Ctrl+M)';
  muteBtn.title = title;
  muteBtn.style.color = isMuted ? 'var(--orange)' : '';
  const paths = muteBtn.querySelectorAll('path');
  paths.forEach(p => { p.style.opacity = isMuted ? '0.3' : '1'; });
}

if (muteBtn) {
  muteBtn.addEventListener('click', async () => {
    isMuted = !isMuted;
    await api.muteTab(isMuted);
    updateMuteIcon();
    notify(isMuted ? '🔇 Tab muted' : '🔊 Tab unmuted', 'info', 1500);
  });
}

// ─── Screenshot ───────────────────────────────────────────────────────────────
const ssBtn = $('btn-screenshot');
if (ssBtn) {
  ssBtn.addEventListener('click', async () => {
    if (state.isNewTabPage) { notify('⚠️ Navigate to a page first', 'warning', 2000); return; }
    notify('📸 Taking screenshot...', 'info', 1500);
    const result = await api.screenshot();
    if (result.success) {
      notify('📸 Screenshot saved to Downloads!', 'success', 3000);
    } else {
      notify('❌ Screenshot failed', 'warning', 2500);
    }
  });
}

// ─── Auto-Update UI ───────────────────────────────────────────────────────────
const updateBanner = $('update-banner');
const updateTitle  = $('update-banner-title');
const updateSub    = $('update-banner-sub');
const updateFill   = $('update-progress-fill');
const installBtn   = $('btn-install-update');
// ═══════════════════════════════════════════════════════════════════════════
//  DUAL ENGINE SWITCHER: GAMING VS WFH (v1.3.0)
// ═══════════════════════════════════════════════════════════════════════════
let currentEngineMode = 'gaming'; // 'gaming' or 'wfh'
const btnModeGaming = $('btn-mode-gaming');
const btnModeWfh    = $('btn-mode-wfh');
const aiDrawerBtn   = $('btn-ai-drawer');

function switchEngineMode(mode) {
  currentEngineMode = mode;
  document.body.classList.remove('mode-gaming', 'mode-wfh');
  
  if (mode === 'wfh') {
    document.body.classList.add('mode-wfh');
    btnModeGaming?.classList.remove('active-gaming');
    btnModeWfh?.classList.add('active-wfh');
    if (aiDrawerBtn) aiDrawerBtn.style.display = 'flex';
    notify('💼 Switched to WFH Mode — Invicta AI & Activity Logger Active!', 'success', 3000);
    // Auto-open AI Drawer when switching to WFH for quick access
    toggleAiDrawer(true);
    // Start continuous activity logging loop
    startActivityLogger();
  } else {
    document.body.classList.add('mode-gaming');
    btnModeWfh?.classList.remove('active-wfh');
    btnModeGaming?.classList.add('active-gaming');
    notify('🎮 Switched to Gaming Engine — High GPU & FPS Boost Active!', 'info', 3000);
    toggleAiDrawer(false);
  }
}

if (btnModeGaming) btnModeGaming.addEventListener('click', () => switchEngineMode('gaming'));
if (btnModeWfh)    btnModeWfh.addEventListener('click',    () => switchEngineMode('wfh'));

// ═══════════════════════════════════════════════════════════════════════════
//  WFH CONTINUOUS WORK ACTIVITY RECORDER
// ═══════════════════════════════════════════════════════════════════════════
let activityLogInterval = null;

function startActivityLogger() {
  if (activityLogInterval) return;
  // Record active browsing session every 60 seconds
  activityLogInterval = setInterval(async () => {
    if (currentEngineMode !== 'wfh') return;
    const url = addressBar.value;
    if (!url || url === 'about:blank') return;

    let domain = 'Local Workspace';
    try { domain = new URL(url).hostname; } catch(e) {}

    const title = state.tabs.find(t => t.id === state.activeTabId)?.title || domain;

    await api.logActivity({
      timestamp: Date.now(),
      dateStr: new Date().toISOString().split('T')[0],
      title: title,
      url: url,
      domain: domain,
      durationSec: 60,
      category: categorizeDomain(domain),
      mode: 'WFH'
    });

    // Refresh records UI if open
    loadWorkRecords(currentRecordsTimeframe);
  }, 60000);
}

function categorizeDomain(domain) {
  const d = domain.toLowerCase();
  if (d.includes('github') || d.includes('gitlab') || d.includes('stackoverflow') || d.includes('vscode')) return 'Development';
  if (d.includes('docs') || d.includes('notion') || d.includes('google.com/doc') || d.includes('sheets')) return 'Documentation';
  if (d.includes('slack') || d.includes('teams') || d.includes('discord') || d.includes('zoom') || d.includes('mail')) return 'Communication';
  if (d.includes('youtube') || d.includes('twitch') || d.includes('netflix')) return 'Leisure';
  return 'General Work';
}

// ═══════════════════════════════════════════════════════════════════════════
//  WFH INVICTA AI DRAWER CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
const wfhAiDrawer    = $('wfh-ai-drawer');
const btnCloseDrawer = $('btn-close-ai-drawer');

function toggleAiDrawer(show) {
  if (!wfhAiDrawer) return;
  const isHidden = wfhAiDrawer.classList.contains('hidden');
  const targetShow = show !== undefined ? show : isHidden;
  
  wfhAiDrawer.classList.toggle('hidden', !targetShow);
  if (targetShow) {
    loadPendingTasks();
    loadWorkRecords(currentRecordsTimeframe);
  }
}

if (aiDrawerBtn)   aiDrawerBtn.addEventListener('click',   () => toggleAiDrawer());
if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', () => toggleAiDrawer(false));

// Drawer Navigation Tabs
document.querySelectorAll('.drawer-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.drawer-section').forEach(s => s.classList.remove('active'));
    
    tabBtn.classList.add('active');
    const targetSecId = `drawer-sec-${tabBtn.dataset.tab}`;
    const targetSec = $(targetSecId);
    if (targetSec) targetSec.classList.add('active');
  });
});

// ── Invicta AI Chat Interaction ──────────────────────────────────────────────
const aiChatInput   = $('ai-chat-input');
const btnSendAiChat = $('btn-send-ai-chat');
const aiChatMessages = $('ai-chat-messages');

async function sendAiMessage(promptText) {
  const text = promptText || aiChatInput?.value.trim();
  if (!text) return;

  if (aiChatInput) aiChatInput.value = '';

  // Append user message
  appendChatMessage(text, 'user');

  // Show typing indicator
  const typingEl = appendChatMessage('⚡ Thinking...', 'ai');

  // Call Invicta AI backend
  const result = await api.askInvictaAI(text, { currentUrl: addressBar.value });

  // Remove typing indicator & show response
  typingEl.remove();
  appendChatMessage(result.response, 'ai');

  // If task was extracted, update tasks checklist
  if (result.taskExtracted) {
    const tasks = await api.getPendingTasks();
    tasks.unshift(result.taskExtracted);
    await api.savePendingTasks(tasks);
    loadPendingTasks();
  }
}

function appendChatMessage(content, sender) {
  if (!aiChatMessages) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg msg-${sender}`;
  msgDiv.innerHTML = `
    <div class="msg-avatar">${sender === 'ai' ? '🤖' : '👤'}</div>
    <div class="msg-content">${formatMarkdown(content)}</div>
  `;
  aiChatMessages.appendChild(msgDiv);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  return msgDiv;
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

if (btnSendAiChat) btnSendAiChat.addEventListener('click', () => sendAiMessage());
if (aiChatInput) {
  aiChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAiMessage();
  });
}

// Quick action buttons
$('btn-ai-summarize')?.addEventListener('click', () => sendAiMessage('summarize active page'));
$('btn-ai-extract-task')?.addEventListener('click', () => sendAiMessage('task extract from current page'));
$('btn-ai-report')?.addEventListener('click', () => sendAiMessage('report productivity work summary'));

// ── Pending Tasks Checklist Manager ──────────────────────────────────────────
const pendingTasksList = $('pending-tasks-list');
const newTaskInput     = $('new-task-input');
const btnAddTask       = $('btn-add-task');
const taskBadgeCount   = $('task-badge-count');

async function loadPendingTasks() {
  const tasks = await api.getPendingTasks();
  renderPendingTasks(tasks);
}

function renderPendingTasks(tasks) {
  if (!pendingTasksList) return;
  pendingTasksList.innerHTML = '';

  const pendingCount = tasks.filter(t => !t.done).length;
  if (taskBadgeCount) taskBadgeCount.textContent = pendingCount;

  if (tasks.length === 0) {
    pendingTasksList.innerHTML = '<div style="font-size:12px;color:var(--text-3);text-align:center;padding:20px;">No pending tasks. Use Invicta AI to generate tasks!</div>';
    return;
  }

  tasks.forEach((task, idx) => {
    const itemEl = document.createElement('div');
    itemEl.className = `task-item ${task.done ? 'done' : ''}`;
    itemEl.innerHTML = `
      <input type="checkbox" ${task.done ? 'checked' : ''} />
      <span>${escHtml(task.text)}</span>
      <button class="task-del-btn" title="Delete Task">✕</button>
    `;

    itemEl.querySelector('input').addEventListener('change', async (e) => {
      tasks[idx].done = e.target.checked;
      await api.savePendingTasks(tasks);
      renderPendingTasks(tasks);
    });

    itemEl.querySelector('.task-del-btn').addEventListener('click', async () => {
      tasks.splice(idx, 1);
      await api.savePendingTasks(tasks);
      renderPendingTasks(tasks);
    });

    pendingTasksList.appendChild(itemEl);
  });
}

async function addNewTask() {
  const text = newTaskInput?.value.trim();
  if (!text) return;

  const tasks = await api.getPendingTasks();
  tasks.unshift({
    id: Date.now().toString(),
    text: text,
    done: false,
    date: new Date().toLocaleDateString()
  });
  await api.savePendingTasks(tasks);
  if (newTaskInput) newTaskInput.value = '';
  renderPendingTasks(tasks);
  notify('✅ Task added to WFH list!', 'success', 1800);
}

if (btnAddTask)   btnAddTask.addEventListener('click', addNewTask);
if (newTaskInput) newTaskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addNewTask(); });

// ── Work Activity Records (Days, Weeks, Months, Years) ────────────────────────
let currentRecordsTimeframe = 'day';

document.querySelectorAll('.timeframe-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRecordsTimeframe = btn.dataset.tf;
    loadWorkRecords(currentRecordsTimeframe);
  });
});

async function loadWorkRecords(timeframe) {
  const records = await api.getActivityRecords(timeframe);
  const recTotalTime  = $('rec-total-time');
  const recTotalSites = $('rec-total-sites');
  const recFocusScore = $('rec-focus-score');
  const listContainer = $('records-history-list');

  const totalSec = records.reduce((sum, r) => sum + (r.durationSec || 60), 0);
  const totalMin = Math.round(totalSec / 60);

  const uniqueDomains = new Set(records.map(r => r.domain)).size;
  const workSec = records.filter(r => r.category !== 'Leisure').reduce((sum, r) => sum + (r.durationSec || 60), 0);
  const focusScore = totalSec > 0 ? Math.round((workSec / totalSec) * 100) : 100;

  if (recTotalTime)  recTotalTime.textContent  = totalMin > 60 ? `${Math.round(totalMin/60)}h ${totalMin%60}m` : `${totalMin}m`;
  if (recTotalSites) recTotalSites.textContent = uniqueDomains;
  if (recFocusScore) recFocusScore.textContent = `${focusScore}%`;

  if (!listContainer) return;
  listContainer.innerHTML = '';

  if (records.length === 0) {
    listContainer.innerHTML = `<div style="font-size:11px;color:var(--text-3);text-align:center;padding:20px;">No activity logged for ${timeframe}. Browse in WFH mode to auto-record your work!</div>`;
    return;
  }

  // Display recent 20 logs
  records.slice(-20).reverse().forEach(rec => {
    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';
    itemEl.innerHTML = `
      <div class="history-item-title">${escHtml(rec.title || rec.domain)}</div>
      <div class="history-item-meta">
        <span>🏷️ ${rec.category || 'Work'}</span>
        <span>⏱️ ${rec.durationSec || 60}s • ${new Date(rec.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
    `;
    listContainer.appendChild(itemEl);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  INTERACTIVE RELEASE UPDATE POPUP MODAL
// ═══════════════════════════════════════════════════════════════════════════
const updateModalBackdrop = $('update-modal-backdrop');
const btnCloseUpdateModal = $('btn-close-update-modal');
const btnModalInstall     = $('btn-modal-install');
const btnModalLater       = $('btn-modal-later');
const modalFeatureList    = $('modal-feature-list');
const modalBugList        = $('modal-bug-list');

async function showUpdateModal() {
  if (!updateModalBackdrop) return;
  const notes = await api.getReleaseNotes();

  $('modal-ver-badge').textContent = `v${notes.version} Release`;
  $('modal-release-title').textContent = notes.title;

  if (modalFeatureList && notes.features) {
    modalFeatureList.innerHTML = notes.features.map(f => `<li>${f}</li>`).join('');
  }
  if (modalBugList && notes.bugFixes) {
    modalBugList.innerHTML = notes.bugFixes.map(b => `<li>${b}</li>`).join('');
  }

  updateModalBackdrop.classList.remove('hidden');
}

function hideUpdateModal() {
  updateModalBackdrop?.classList.add('hidden');
}

if (btnCloseUpdateModal) btnCloseUpdateModal.addEventListener('click', hideUpdateModal);
if (btnModalLater)       btnModalLater.addEventListener('click',       hideUpdateModal);
if (btnModalInstall)     btnModalInstall.addEventListener('click',     () => api.installUpdate());

// Show modal on update events or menu check
api.on('update-available', (info) => {
  showUpdateModal();
});
api.on('update-downloaded', (info) => {
  showUpdateModal();
  if (btnModalInstall) btnModalInstall.textContent = 'Restart & Apply Update Now!';
});

// Update Menu button trigger for update modal
$('about-update-status')?.addEventListener('click', async () => {
  showUpdateModal();
});

// ─── Auto-Update UI ───────────────────────────────────────────────────────────
const updateBanner = $('update-banner');
const updateTitle  = $('update-banner-title');
const updateSub    = $('update-banner-sub');
const updateFill   = $('update-progress-fill');
const installBtn   = $('btn-install-update');
const dismissBtn   = $('btn-dismiss-update');
const updateStatus = $('about-update-status');

if (dismissBtn) dismissBtn.addEventListener('click', () => updateBanner?.classList.add('hidden'));
if (installBtn) installBtn.addEventListener('click', () => api.installUpdate());

api.on('update-available', (info) => {
  if (!updateBanner) return;
  updateBanner.classList.remove('hidden');
  if (updateTitle) updateTitle.textContent = `Update v${info.version} Available`;
  if (updateSub)   updateSub.textContent   = 'Downloading in background...';
  if (updateStatus) updateStatus.textContent = `Update v${info.version} downloading...`;
  notify(`🔄 Update v${info.version} is downloading...`, 'info', 4000);
});

api.on('update-progress', (progress) => {
  if (updateFill) updateFill.style.width = `${progress.percent}%`;
  if (updateSub)  updateSub.textContent  = `${progress.percent}% — ${progress.speed} KB/s`;
  
  const modalProgressFill = $('modal-progress-fill');
  const modalProgressText = $('modal-progress-text');
  const modalProgressWrap = $('modal-progress-wrap');
  if (modalProgressWrap) modalProgressWrap.classList.remove('hidden');
  if (modalProgressFill) modalProgressFill.style.width = `${progress.percent}%`;
  if (modalProgressText) modalProgressText.textContent = `Downloading Update... ${progress.percent}% (${progress.speed} KB/s)`;
});

api.on('update-downloaded', (info) => {
  if (updateBanner) updateBanner.classList.remove('hidden');
  if (updateTitle)  updateTitle.textContent = `✅ Update v${info.version} Ready!`;
  if (updateSub)    updateSub.textContent   = 'Restart to apply the update';
  if (updateFill)   updateFill.style.width  = '100%';
  if (installBtn)   installBtn.classList.remove('hidden');
  if (updateStatus) updateStatus.textContent = `v${info.version} downloaded — restart to update`;
  notify(`✅ Update v${info.version} ready! Click Restart to apply.`, 'success', 6000);
});

// ─── New Keyboard Shortcuts ───────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey;
  if (ctrl && e.key === 'f') { e.preventDefault(); openFindBar(); }
  if (ctrl && e.key === 'd') { e.preventDefault(); toggleBookmark(); }
  if (ctrl && e.key === 'm') { e.preventDefault(); muteBtn?.click(); }
  if (ctrl && e.shiftKey && e.key === 'S') { e.preventDefault(); ssBtn?.click(); }
  if (ctrl && e.shiftKey && e.key === 'W') { e.preventDefault(); switchEngineMode(currentEngineMode === 'wfh' ? 'gaming' : 'wfh'); }
});

// ─── Initial Startup Setup ────────────────────────────────────────────────────
loadPendingTasks();
loadWorkRecords('day');

notify('🚀 InvictaTill Browser v1.3.0 Ready! Gaming & WFH Dual Engines Online ⚡', 'success', 5000);
