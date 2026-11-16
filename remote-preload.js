'use strict';

const { ipcRenderer } = require('electron');

const MAX_USERNAME_LENGTH = 250;
const MAX_PASSWORD_LENGTH = 500;
let autofillLookupStarted = false;
let autofillCheckTimer = null;
let autofillRetryCount = 0;
let autofillRetryTimer = null;
const MAX_AUTOFILL_RETRIES = 5;
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

function querySelectorAllDeep(root, selector) {
  const matches = [];
  const pending = [root];
  const visited = new Set();
  while (pending.length) {
    const scope = pending.shift();
    if (!scope || visited.has(scope) || typeof scope.querySelectorAll !== 'function') continue;
    visited.add(scope);
    for (const element of scope.querySelectorAll(selector)) matches.push(element);
    for (const element of scope.querySelectorAll('*')) {
      if (element.shadowRoot && element.shadowRoot.mode === 'open') pending.push(element.shadowRoot);
    }
  }
  return matches;
}

function passwordInputs(root) {
  return querySelectorAllDeep(root, 'input[type="password"]').filter(usableInput);
}

function loginPasswordInput(root) {
  const inputs = passwordInputs(root);
  if (!inputs.length) return null;
  const current = inputs.find((input) => input.autocomplete === 'current-password');
  if (current) return current;
  const nonNew = inputs.filter((input) => input.autocomplete !== 'new-password');
  if (nonNew.length === 1) return nonNew[0];
  if (nonNew.length > 0) return nonNew[0];
  return null;
}

function submittedPasswordInput(root) {
  const inputs = passwordInputs(root).filter((input) => input.value);
  if (!inputs.length) return null;
  return inputs.find((input) => input.autocomplete === 'new-password') ||
    inputs.find((input) => input.autocomplete === 'current-password') ||
    inputs[inputs.length - 1];
}

function usernameInput(root, strict) {
  const selectors = [
    'input[autocomplete~="username"]',
    'input[autocomplete~="email"]',
    'input[type="email"]',
    'input[name*="user" i]',
    'input[name*="login" i]',
    'input[name*="account" i]',
    'input[id*="user" i]',
    'input[id*="login" i]',
    'input[id*="email" i]',
    'input[aria-label*="user" i]',
    'input[aria-label*="email" i]',
  ];
  for (const selector of selectors) {
    const input = querySelectorAllDeep(root, selector).find(usableInput);
    if (input) return input;
  }
  if (strict) return null;
  const fallback = querySelectorAllDeep(root, 'input[type="text"], input[type="tel"]')
    .find(usableInput);
  if (fallback) return fallback;
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
  if (!isWebPage()) return;
  const passwordInput = loginPasswordInput(document);
  const form = passwordInput && passwordInput.form ? passwordInput.form : document;
  const userInput = usernameInput(form, !passwordInput);
  if ((!passwordInput && !userInput) ||
      (passwordInput && passwordInput.value && (!userInput || userInput.value)) ||
      (!passwordInput && userInput && userInput.value)) {
    autofillLookupStarted = false;
    return;
  }
  autofillLookupStarted = true;
  autofillRetryCount = 0;
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
    if (!password && passwordInput) return;
    setInputValue(userInput, username);
    if (passwordInput) setInputValue(passwordInput, password);
  } catch (error) {
    // Password storage is optional and may be unavailable on this device.
  }
}

function scheduleAutofill() {
  if (autofillCheckTimer) return;
  if (autofillLookupStarted && autofillRetryCount >= MAX_AUTOFILL_RETRIES) return;
  if (autofillLookupStarted) {
    autofillRetryCount += 1;
  }
  autofillLookupStarted = true;
  var delay = 180 + (autofillRetryCount * 400);
  autofillCheckTimer = setTimeout(tryAutofill, delay);
}

function scheduleAutofillReset() {
  if (autofillRetryTimer) clearTimeout(autofillRetryTimer);
  autofillRetryTimer = setTimeout(function () {
    autofillRetryTimer = null;
    autofillLookupStarted = false;
    autofillRetryCount = 0;
    scheduleAutofill();
  }, 800);
}

function reportCredential(root) {
  if (!isWebPage()) return;
  const passwordInput = submittedPasswordInput(root);
  if (!passwordInput) return;
  const password = String(passwordInput.value || '').slice(0, MAX_PASSWORD_LENGTH);
  if (!password) return;
  const userInput = usernameInput(root, false);
  const username = userInput
    ? String(userInput.value || '').trim().slice(0, MAX_USERNAME_LENGTH)
    : '';
  ipcRenderer.send('credential-submitted', {
    origin: location.origin,
    username,
    password,
  });
}

function reportUsername(root) {
  if (!isWebPage()) return;
  const input = usernameInput(root, true);
  const username = input
    ? String(input.value || '').trim().slice(0, MAX_USERNAME_LENGTH)
    : '';
  if (!username) return;
  ipcRenderer.send('credential-username-observed', {
    origin: location.origin,
    username,
  });
}

function credentialRoot(target) {
  if (!target || typeof target.closest !== 'function') return document;
  const form = target.closest('form');
  if (form) return form;
  const root = typeof target.getRootNode === 'function' ? target.getRootNode() : null;
  return root && typeof root.querySelectorAll === 'function' ? root : document;
}

function isLikelySubmitControl(control) {
  if (!control) return false;
  if (control.matches('input[type="submit"], button[type="submit"]')) return true;
  if (control.tagName === 'BUTTON' && !control.hasAttribute('type')) return true;
  const label = String(control.textContent || control.value || control.getAttribute('aria-label') || '');
  return /sign\s*in|log\s*in|continue|next|submit|register|create|save|confirm/i.test(label);
}

function observeCredentialRoots(root, observer, observedRoots) {
  if (!root || observedRoots.has(root) || typeof root.querySelectorAll !== 'function') return;
  observedRoots.add(root);
  observer.observe(root, { childList: true, subtree: true });
  if (root.shadowRoot && root.shadowRoot.mode === 'open') {
    observeCredentialRoots(root.shadowRoot, observer, observedRoots);
  }
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot && element.shadowRoot.mode === 'open') {
      observeCredentialRoots(element.shadowRoot, observer, observedRoots);
    }
  }
}

function startCredentialObserver() {
  if (!isWebPage()) return;
  document.addEventListener('submit', (event) => {
    const root = credentialRoot(event.target);
    reportUsername(root);
    reportCredential(root);
  }, true);
  document.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    const control = target && target.closest('button, input[type="submit"], [role="button"]');
    if (isLikelySubmitControl(control)) {
      const root = credentialRoot(control);
      reportUsername(root);
      reportCredential(root);
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (!event.isTrusted || event.key !== 'Enter') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest('input, form, [contenteditable="true"]')) {
      const root = credentialRoot(target);
      reportUsername(root);
      reportCredential(root);
    }
  }, true);

  const observedRoots = new WeakSet();
  const observer = new MutationObserver((records) => {
    scheduleAutofillReset();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element || node instanceof DocumentFragment) {
          observeCredentialRoots(node, observer, observedRoots);
        }
      }
    }
  });
  observeCredentialRoots(document.documentElement, observer, observedRoots);
  scheduleAutofill();
}

function linkTargetForEvent(event) {
  const target = event && event.target instanceof Element ? event.target : null;
  const anchor = target && target.closest('a[href]');
  if (!anchor) return null;
  if (anchor.hasAttribute('download')) return null;
  try {
    const url = new URL(anchor.getAttribute('href'), location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch (error) {
    return null;
  }
}

function startModifiedClickHandler() {
  if (!isWebPage()) return;
  document.addEventListener('click', (event) => {
    if (!event.isTrusted || event.defaultPrevented) return;
    if (event.button !== 0 || (!event.ctrlKey && !event.metaKey) || event.shiftKey || event.altKey) return;
    const url = linkTargetForEvent(event);
    if (!url) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ipcRenderer.send('open-link-from-page', {
      origin: location.origin,
      url,
      activate: false,
    });
  }, true);
}

function startPageFeatures() {
  startModifiedClickHandler();
  startCredentialObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startPageFeatures, { once: true });
} else {
  startPageFeatures();
}
