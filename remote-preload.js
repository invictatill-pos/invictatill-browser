'use strict';

const { ipcRenderer } = require('electron');

const MAX_USERNAME_LENGTH = 250;
const MAX_PASSWORD_LENGTH = 500;
let autofillLookupStarted = false;
let autofillCheckTimer = null;
const LIVE_WRITING_DEBOUNCE_MS = 1350;
const LIVE_WRITING_MAX_LENGTH = 1200;
let liveWritingEnabled = false;
let liveWritingTimer = null;
let liveWritingGeneration = 0;
let liveWritingTarget = null;
let liveWritingCapture = null;
let liveWritingHost = null;
let liveWritingUi = null;
let applyingLiveWritingSuggestion = false;

function isWebPage() {
  return location.protocol === 'https:' || location.protocol === 'http:';
}

function usableInput(input) {
  return Boolean(
    input &&
    !input.disabled &&
    !input.readOnly &&
    input.getClientRects().length > 0
  );
}

function passwordInputs(root) {
  return Array.from(root.querySelectorAll('input[type="password"]')).filter(usableInput);
}

function loginPasswordInput(root) {
  const inputs = passwordInputs(root);
  const current = inputs.find((input) => input.autocomplete === 'current-password');
  if (current) return current;
  if (inputs.length === 1 && inputs[0].autocomplete !== 'new-password') return inputs[0];
  return null;
}

function submittedPasswordInput(root) {
  const inputs = passwordInputs(root).filter((input) => input.value);
  if (!inputs.length) return null;
  return inputs.find((input) => input.autocomplete === 'new-password') ||
    inputs.find((input) => input.autocomplete === 'current-password') ||
    inputs[inputs.length - 1];
}

function usernameInput(root) {
  const selectors = [
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="email"]',
    'input[name*="user" i]',
    'input[name*="login" i]',
    'input[type="text"]',
    'input[type="tel"]',
  ];
  for (const selector of selectors) {
    const input = Array.from(root.querySelectorAll(selector)).find(usableInput);
    if (input) return input;
  }
  return null;
}

function setInputValue(input, value) {
  if (!input || input.value || !value) return;
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && typeof descriptor.set === 'function') descriptor.set.call(input, value);
  else input.value = value;
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: value,
  }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function tryAutofill() {
  autofillCheckTimer = null;
  if (!isWebPage() || autofillLookupStarted) return;
  const passwordInput = loginPasswordInput(document);
  if (!passwordInput || passwordInput.value) return;
  autofillLookupStarted = true;
  try {
    const credential = await ipcRenderer.invoke('get-page-credential', {
      origin: location.origin,
    });
    if (!credential || typeof credential !== 'object') return;
    const username = typeof credential.username === 'string'
      ? credential.username.slice(0, MAX_USERNAME_LENGTH)
      : '';
    const password = typeof credential.password === 'string'
      ? credential.password.slice(0, MAX_PASSWORD_LENGTH)
      : '';
    if (!password) return;
    const form = passwordInput.form || document;
    setInputValue(usernameInput(form), username);
    setInputValue(passwordInput, password);
  } catch (error) {
    // Password storage is optional and may be unavailable on this device.
  }
}

function scheduleAutofill() {
  if (autofillLookupStarted || autofillCheckTimer) return;
  autofillCheckTimer = setTimeout(tryAutofill, 180);
}

function reportCredential(root) {
  if (!isWebPage()) return;
  const passwordInput = submittedPasswordInput(root);
  if (!passwordInput) return;
  const password = String(passwordInput.value || '').slice(0, MAX_PASSWORD_LENGTH);
  if (!password) return;
  const userInput = usernameInput(root);
  const username = userInput
    ? String(userInput.value || '').trim().slice(0, MAX_USERNAME_LENGTH)
    : '';
  ipcRenderer.send('credential-submitted', {
    origin: location.origin,
    username,
    password,
  });
}

function credentialRoot(target) {
  return target && typeof target.closest === 'function'
    ? (target.closest('form') || document)
    : document;
}

function isLikelySubmitControl(control) {
  if (!control) return false;
  if (control.matches('input[type="submit"], button[type="submit"]')) return true;
  if (control.tagName === 'BUTTON' && !control.hasAttribute('type')) return true;
  const label = String(control.textContent || control.value || control.getAttribute('aria-label') || '');
  return /sign\s*in|log\s*in|continue|next|submit|register|create|save|confirm/i.test(label);
}

function startCredentialObserver() {
  if (!isWebPage()) return;
  document.addEventListener('submit', (event) => {
    reportCredential(credentialRoot(event.target));
  }, true);
  document.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    const control = target && target.closest('button, input[type="submit"], [role="button"]');
    if (isLikelySubmitControl(control)) reportCredential(credentialRoot(control));
  }, true);
  document.addEventListener('keydown', (event) => {
    if (!event.isTrusted || event.key !== 'Enter') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest('input, form, [contenteditable="true"]')) {
      reportCredential(credentialRoot(target));
    }
  }, true);

  const observer = new MutationObserver(scheduleAutofill);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleAutofill();
}

function sensitiveWritingField(element) {
  if (!element || typeof element.getAttribute !== 'function') return true;
  const metadata = [
    element.id,
    element.getAttribute('name'),
    element.getAttribute('autocomplete'),
    element.getAttribute('aria-label'),
    element.getAttribute('placeholder'),
    element.getAttribute('role'),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  return /password|passcode|login|sign[ -]?in|user(name)?|e-?mail|search|query|find|payment|card|cvv|cvc|account|token|secret|otp|one[ -]?time|verification|promo|coupon/.test(metadata);
}

function writingEditorForNode(node) {
  let element = node instanceof Element ? node : node && node.parentElement;
  if (!element) return null;
  if (element.closest('code, pre, [role="search"], [data-invicta-writing="off"], .monaco-editor, .CodeMirror')) {
    return null;
  }
  const input = element.closest('input, textarea');
  if (input) {
    if (!usableInput(input) || sensitiveWritingField(input)) return null;
    if (input instanceof HTMLInputElement && String(input.type || 'text').toLocaleLowerCase() !== 'text') {
      return null;
    }
    return input;
  }
  if (!element.isContentEditable) return null;
  while (element.parentElement && element.parentElement.isContentEditable) {
    element = element.parentElement;
  }
  return sensitiveWritingField(element) ? null : element;
}

function sentenceBounds(text, caret) {
  const value = String(text || '');
  const safeCaret = Math.max(0, Math.min(value.length, Number.isInteger(caret) ? caret : value.length));
  const before = value.slice(0, safeCaret);
  const leftMatch = [...before.matchAll(/[.!?\n]\s*/g)].pop();
  let start = leftMatch ? leftMatch.index + leftMatch[0].length : 0;
  const after = value.slice(safeCaret);
  const rightMatch = after.match(/[.!?](?:\s|$)|\n/);
  let end = rightMatch ? safeCaret + rightMatch.index + (rightMatch[0][0] === '\n' ? 0 : 1) : value.length;
  while (start < end && /\s/.test(value[start])) start += 1;
  while (end > start && /\s/.test(value[end - 1])) end -= 1;
  return { start, end };
}

function textPosition(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  let lastNode = null;
  while (node) {
    lastNode = node;
    if (remaining <= node.data.length) return { node, offset: remaining };
    remaining -= node.data.length;
    node = walker.nextNode();
  }
  if (lastNode) return { node: lastNode, offset: lastNode.data.length };
  return { node: root, offset: 0 };
}

function captureCurrentSentence(editor) {
  if (!editor || !editor.isConnected) return null;
  if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
    const value = String(editor.value || '');
    const caret = Number.isInteger(editor.selectionStart) ? editor.selectionStart : value.length;
    const bounds = sentenceBounds(value, caret);
    const source = value.slice(bounds.start, bounds.end);
    const words = source.match(/[\p{L}\p{N}']+/gu) || [];
    if (source.length < 12 || source.length > LIVE_WRITING_MAX_LENGTH || words.length < 3) return null;
    return { kind: 'input', editor, source, start: bounds.start, end: bounds.end };
  }

  const selection = window.getSelection();
  if (!selection || !selection.focusNode || !editor.contains(selection.focusNode)) return null;
  const fullText = String(editor.textContent || '');
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(editor);
  try {
    prefixRange.setEnd(selection.focusNode, selection.focusOffset);
  } catch (error) {
    return null;
  }
  const bounds = sentenceBounds(fullText, prefixRange.toString().length);
  const source = fullText.slice(bounds.start, bounds.end);
  const words = source.match(/[\p{L}\p{N}']+/gu) || [];
  if (source.length < 12 || source.length > LIVE_WRITING_MAX_LENGTH || words.length < 3) return null;
  return { kind: 'contenteditable', editor, source, start: bounds.start, end: bounds.end };
}

function liveWritingCaptureStillMatches(capture) {
  if (!capture || !capture.editor || !capture.editor.isConnected) return false;
  if (capture.kind === 'input') {
    return capture.editor.value.slice(capture.start, capture.end) === capture.source;
  }
  const start = textPosition(capture.editor, capture.start);
  const end = textPosition(capture.editor, capture.end);
  const range = document.createRange();
  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
  } catch (error) {
    return false;
  }
  return range.toString() === capture.source;
}

function ensureLiveWritingUi() {
  if (liveWritingHost && liveWritingHost.isConnected) return liveWritingUi;
  const host = document.createElement('div');
  host.setAttribute('data-invicta-writing-assistant', '');
  host.setAttribute('aria-live', 'polite');
  host.dataset.state = 'hidden';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.left = '12px';
  host.style.top = '12px';
  host.style.width = '340px';
  host.style.pointerEvents = 'none';

  const shadow = host.attachShadow({ mode: 'open' });
  const styles = `
    :host { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    .badge { margin-left: auto; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 10px; border: 1px solid #35e0b1; color: #06251d; background: #46e1b6; box-shadow: 0 8px 24px rgba(6, 24, 36, .28); font-weight: 900; pointer-events: auto; }
    .badge[hidden], .card[hidden] { display: none; }
    :host(.checking) .badge { animation: invicta-pulse 1s ease-in-out infinite; }
    .card { margin-top: 7px; padding: 14px; border: 1px solid #2b5060; border-radius: 15px; background: #0d1725; color: #eef9f7; box-shadow: 0 18px 50px rgba(2, 8, 18, .42); pointer-events: auto; }
    .header { display: flex; align-items: flex-start; gap: 10px; }
    .logo { width: 30px; height: 30px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 9px; color: #06251d; background: #46e1b6; font-weight: 900; }
    .title { margin: 0; font-size: 14px; line-height: 18px; font-weight: 800; }
    .eyebrow { margin: 2px 0 0; color: #92aabd; font-size: 11px; line-height: 15px; }
    .close { margin-left: auto; border: 0; padding: 2px 5px; color: #9db1bf; background: transparent; cursor: pointer; font-size: 19px; line-height: 20px; }
    .change { margin: 12px 0; padding: 10px; border-radius: 10px; background: #121f2f; font-size: 13px; line-height: 18px; overflow-wrap: anywhere; }
    .from { color: #e6a4a4; text-decoration: line-through; }
    .arrow { margin: 5px 0; color: #71899b; }
    .to { color: #b9f7e5; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button { font: inherit; }
    .dismiss, .apply { min-height: 32px; border-radius: 9px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: 750; }
    .dismiss { border: 1px solid #385064; color: #c5d5df; background: #132334; }
    .apply { border: 1px solid #46e1b6; color: #06251d; background: #46e1b6; }
    button:focus-visible { outline: 2px solid #9cf4dc; outline-offset: 2px; }
    @keyframes invicta-pulse { 50% { opacity: .55; transform: scale(.9); } }
  `;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    shadow.adoptedStyleSheets = [sheet];
  } catch (error) {
    const style = document.createElement('style');
    style.textContent = styles;
    shadow.appendChild(style);
  }

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = '✦';
  badge.hidden = true;
  const card = document.createElement('section');
  card.className = 'card';
  card.hidden = true;
  card.setAttribute('aria-label', 'InvictaTill AI writing suggestion');
  const header = document.createElement('div');
  header.className = 'header';
  const logo = document.createElement('div');
  logo.className = 'logo';
  logo.textContent = '✦';
  const heading = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'title';
  title.textContent = 'InvictaTill AI';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Spelling & grammar suggestion';
  heading.append(title, eyebrow);
  const close = document.createElement('button');
  close.className = 'close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss suggestion');
  close.textContent = '×';
  const change = document.createElement('div');
  change.className = 'change';
  const from = document.createElement('div');
  from.className = 'from';
  const arrow = document.createElement('div');
  arrow.className = 'arrow';
  arrow.textContent = '↓';
  const to = document.createElement('div');
  to.className = 'to';
  change.append(from, arrow, to);
  const actions = document.createElement('div');
  actions.className = 'actions';
  const dismiss = document.createElement('button');
  dismiss.className = 'dismiss';
  dismiss.type = 'button';
  dismiss.dataset.action = 'dismiss';
  dismiss.textContent = 'Dismiss';
  const apply = document.createElement('button');
  apply.className = 'apply';
  apply.type = 'button';
  apply.dataset.action = 'apply';
  apply.textContent = 'Apply correction';
  actions.append(dismiss, apply);
  header.append(logo, heading, close);
  card.append(header, change, actions);
  shadow.append(badge, card);
  document.documentElement.appendChild(host);

  close.addEventListener('click', (event) => {
    if (event.isTrusted) hideLiveWritingUi();
  });
  dismiss.addEventListener('click', (event) => {
    if (event.isTrusted) hideLiveWritingUi();
  });
  apply.addEventListener('click', (event) => {
    if (event.isTrusted) applyLiveWritingSuggestion();
  });
  liveWritingHost = host;
  liveWritingUi = { badge, card, from, to };
  return liveWritingUi;
}

function positionLiveWritingUi(editor) {
  if (!liveWritingHost || !editor || !editor.isConnected) return;
  const rect = editor.getBoundingClientRect();
  const width = Math.min(340, Math.max(220, window.innerWidth - 20));
  liveWritingHost.style.width = width + 'px';
  const estimatedHeight = liveWritingHost.dataset.state === 'suggestion' ? 255 : 38;
  const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));
  const below = rect.bottom + 7;
  const top = below + estimatedHeight < window.innerHeight
    ? below
    : Math.max(10, rect.top - estimatedHeight - 7);
  liveWritingHost.style.left = Math.round(left) + 'px';
  liveWritingHost.style.top = Math.round(top) + 'px';
}

function hideLiveWritingUi() {
  if (liveWritingTimer) clearTimeout(liveWritingTimer);
  liveWritingTimer = null;
  liveWritingCapture = null;
  if (!liveWritingHost || !liveWritingUi) return;
  liveWritingHost.dataset.state = 'hidden';
  liveWritingHost.removeAttribute('data-suggestion-length');
  liveWritingUi.badge.hidden = true;
  liveWritingUi.card.hidden = true;
}

function showLiveWritingChecking(editor) {
  const ui = ensureLiveWritingUi();
  liveWritingHost.dataset.state = 'checking';
  liveWritingHost.classList.add('checking');
  ui.badge.hidden = false;
  ui.card.hidden = true;
  positionLiveWritingUi(editor);
}

function showLiveWritingSuggestion(capture, suggestion) {
  const ui = ensureLiveWritingUi();
  liveWritingCapture = { ...capture, suggestion };
  liveWritingHost.dataset.state = 'suggestion';
  liveWritingHost.dataset.suggestionLength = String(suggestion.length);
  liveWritingHost.classList.remove('checking');
  ui.badge.hidden = true;
  ui.card.hidden = false;
  ui.from.textContent = capture.source;
  ui.to.textContent = suggestion;
  positionLiveWritingUi(capture.editor);
}

function applyLiveWritingSuggestion() {
  const capture = liveWritingCapture;
  if (!capture || !liveWritingCaptureStillMatches(capture)) {
    hideLiveWritingUi();
    return;
  }
  applyingLiveWritingSuggestion = true;
  try {
    capture.editor.focus();
    if (capture.kind === 'input') {
      capture.editor.setRangeText(capture.suggestion, capture.start, capture.end, 'end');
    } else {
      const start = textPosition(capture.editor, capture.start);
      const end = textPosition(capture.editor, capture.end);
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand('insertText', false, capture.suggestion)) {
        range.deleteContents();
        const textNode = document.createTextNode(capture.suggestion);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    capture.editor.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertReplacementText',
      data: capture.suggestion,
    }));
    capture.editor.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    applyingLiveWritingSuggestion = false;
    liveWritingGeneration += 1;
    hideLiveWritingUi();
  }
}

async function requestLiveWritingCheck(capture, generation) {
  if (!liveWritingEnabled || generation !== liveWritingGeneration ||
      !liveWritingCaptureStillMatches(capture)) return;
  showLiveWritingChecking(capture.editor);
  const requestId = Date.now().toString(36) + '-' + generation.toString(36);
  try {
    const result = await ipcRenderer.invoke('request-live-writing-suggestion', {
      origin: location.origin,
      requestId,
      text: capture.source,
    });
    if (!liveWritingEnabled || generation !== liveWritingGeneration ||
        !liveWritingCaptureStillMatches(capture)) return;
    if (result && result.success && result.requestId === requestId &&
        typeof result.suggestion === 'string' && result.suggestion.trim()) {
      showLiveWritingSuggestion(capture, result.suggestion.trim());
    } else {
      hideLiveWritingUi();
    }
  } catch (error) {
    if (generation === liveWritingGeneration) hideLiveWritingUi();
  }
}

function scheduleLiveWritingCheck(editor) {
  if (liveWritingTimer) clearTimeout(liveWritingTimer);
  liveWritingGeneration += 1;
  const generation = liveWritingGeneration;
  hideLiveWritingUi();
  liveWritingTarget = editor;
  liveWritingTimer = setTimeout(() => {
    liveWritingTimer = null;
    const capture = captureCurrentSentence(editor);
    if (capture) requestLiveWritingCheck(capture, generation);
  }, LIVE_WRITING_DEBOUNCE_MS);
}

function setLiveWritingEnabled(enabled) {
  liveWritingEnabled = Boolean(enabled);
  if (!liveWritingEnabled) {
    liveWritingGeneration += 1;
    liveWritingTarget = null;
    hideLiveWritingUi();
  }
}

function startLiveWritingAssistant() {
  if (!isWebPage()) return;
  document.addEventListener('input', (event) => {
    if (!liveWritingEnabled || applyingLiveWritingSuggestion || !event.isTrusted) return;
    const editor = writingEditorForNode(event.target);
    if (editor) scheduleLiveWritingCheck(editor);
    else hideLiveWritingUi();
  }, true);
  document.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (liveWritingHost && next && liveWritingHost.contains(next)) return;
    if (liveWritingTarget && event.target === liveWritingTarget &&
        liveWritingHost && liveWritingHost.dataset.state !== 'suggestion') {
      hideLiveWritingUi();
    }
  }, true);
  window.addEventListener('resize', () => {
    if (liveWritingCapture) positionLiveWritingUi(liveWritingCapture.editor);
  });
  document.addEventListener('scroll', () => {
    if (liveWritingCapture) positionLiveWritingUi(liveWritingCapture.editor);
  }, true);
  ipcRenderer.on('live-writing-preference-changed', (event, enabled) => {
    setLiveWritingEnabled(enabled);
  });
  ipcRenderer.invoke('get-live-writing-preference', { origin: location.origin })
    .then((result) => setLiveWritingEnabled(Boolean(result && result.enabled)))
    .catch(() => setLiveWritingEnabled(false));
}

function startPageFeatures() {
  startCredentialObserver();
  startLiveWritingAssistant();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPageFeatures, { once: true });
} else {
  startPageFeatures();
}
