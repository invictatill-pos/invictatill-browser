'use strict';

const { ipcRenderer } = require('electron');

const MAX_USERNAME_LENGTH = 250;
const MAX_PASSWORD_LENGTH = 500;
let autofillLookupStarted = false;
let autofillCheckTimer = null;

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startCredentialObserver, { once: true });
} else {
  startCredentialObserver();
}
