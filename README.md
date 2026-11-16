# InvictaTill Browser

InvictaTill Browser is a Windows productivity browser with Chromium tabs, workspaces, direct access to ChatGPT, and tools for tasks, focus sessions, and browsing.

## Architecture and security model

The application uses Electron with a trusted local browser-chrome window and sandboxed `WebContentsView` instances for web pages. The main process owns tab creation, navigation, permissions, downloads, printing, and persistence. A context-isolated preload exposes a narrow IPC API to the local renderer. Remote pages have no Node.js or Electron access.

Regular tabs in each workspace share a persistent website session. Private windows use an isolated, temporary session and are excluded from session restore, browsing history, and optional activity records. The browser evaluates website permissions per request and validates new-window destinations.

## Browser features

- Multi-tab browsing with reopen-closed-tab and optional session restore.
- Per-workspace last-active tab restoration, pinned tabs, close-other-tabs, and searchable tabs/commands with `Ctrl+Shift+A`.
- Searchable browsing history, bookmarks, and recent-page shortcuts.
- Managed downloads with an automatic compact progress box; dismissing the box keeps transfers running, while Cancel explicitly stops them.
- Report and export tabs preserve submitted forms, the referring page, and opener state. File responses use the download manager and completed handoffs return to the source tab. Download retries retain the original workspace login.
- Automatic save/update prompts for submitted logins, with OS-encrypted storage and exact-site autofill shared across every normal workspace. Multi-step forms, open shadow-DOM forms, login popups, HTTP authentication, and generated strong passwords use the same vault; private windows never save or reuse vault passwords.
- A Chrome-compatible identity for every normal tab and login popup, with JavaScript, WebAssembly, service workers, WebCrypto, WebGL, PDF/plugin content, local files, data/blob documents, and confirmed external-app links enabled through Chromium.
- Browser permission and selection flows for passkeys, client certificates, protected media, File System Access, Bluetooth, HID, USB, serial devices, storage access, camera, microphone, location, notifications, and screen sharing.
- An Opera-style WhatsApp side panel with a persistent cross-workspace login, unread badge, reload/full-tab controls, calling permissions, and a WhatsApp-scoped supported Chrome identity.
- Private windows backed by an isolated, non-persistent session.
- Per-site permission prompts for capabilities such as camera, microphone, notifications, and location.
- In-app tab, window, and entire-screen sharing with optional requested audio for WebRTC meeting sites.
- Find in page, per-tab mute, page zoom, screenshots, printing, and save-to-PDF. Ctrl+F gives web editors their own search first; **Menu > Find in page** explicitly opens browser search.
- Split view for working with two tabs side by side.
- Clear-browsing-data controls and visible update status.
- Persistent focus sessions with pause/resume, completion notifications, daily focused-time statistics, recovery breaks, and one-click remote-work launchers.

## ChatGPT

Open **ChatGPT** from the app rail, new-tab shortcuts, browser menu, command palette, or **Browser tools → Settings**. You can also press `Ctrl+Shift+G`. The shortcut opens [chatgpt.com](https://chatgpt.com/) in the current workspace and reuses an existing ChatGPT tab there. Choose **Log in** on the site and sign in with your ChatGPT account.

Select text on a page or in a draft and choose **Copy selection and open ChatGPT** to copy it to the clipboard. Paste it into ChatGPT when you want to share it. Chromium spellcheck is available in supported text fields.

## Browser tools

Use **Tasks → Scan page for tasks** to scan the active page for action items on your device. **Activity** generates a 24-hour report from browser records. Activity tracking is off by default and excluded from private windows. When enabled in Settings, it records navigation with URL query strings and fragments removed.

### Saved login security

Saved passwords match the exact site origin: scheme, hostname, and port. A login saved for `https://example.com` will not autofill on `http://example.com`, `https://www.example.com`, or a different port. The password manager displays this origin. Credentials remain available across normal workspaces for the same origin, and proxy authentication never uses the website vault.

Older saved entries did not retain their complete origin. Version 2.8.4 conservatively migrates them to the HTTPS address for the stored hostname. Save a login again on its correct address if an older HTTP or `www` login no longer autofills.

## Development

### Requirements

- Windows 10 or Windows 11, 64-bit
- Node.js 22.12 or newer
- npm supplied with the selected Node.js release

From the `InvictaTill Browser` directory:

```powershell
npm ci
npm run check
npm test
npm run test:e2e
npm run test:reports
npm run test:layout
npm start
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`. `npm run check` performs static project checks, `npm test` runs the automated security, package, and DOM-contract tests, and `npm run test:e2e` exercises the live Electron shell including screen sharing and responsive UI geometry. `npm start` launches a development build; development mode does not publish releases.

### Build Windows artifacts

Run verification before packaging:

```powershell
npm run check
npm test
npm run build
```

The build creates both x64 Windows targets in `dist/`:

- `InvictaTill-Browser-Setup-<version>-x64.exe` — NSIS installer
- `InvictaTill-Browser-Portable-<version>-x64.exe` — portable application
- `latest.yml` and the installer blockmap — auto-update metadata

Production artifacts must be code-signed and verified before a release draft is published. See [RELEASE_GUIDE.md](RELEASE_GUIDE.md) for the staged release checklist.

### Browser updates

Installed Setup builds check the stable GitHub release feed after startup. In **Browser tools → Settings → Browser updates**, you can check again and restart once the verified update has downloaded. Development, private, and portable builds show why automatic installation is unavailable. Portable users can update by downloading the next portable executable.

A public update release is valid only when the Setup executable, matching `.blockmap`, and `latest.yml` are published together. Verify a published tag with:

```powershell
npm run verify:update-feed -- --tag v2.1.14
```

This command is read-only and fails when required stable-channel assets are absent.

## License

InvictaTill Browser is available under the [MIT License](LICENSE).

## Scope and compatibility

InvictaTill Browser is not a drop-in replacement for every Chrome or Edge capability. Version 2.0 does not provide:

- Chrome Web Store or general browser-extension compatibility.
- Google/Microsoft account sync, cross-device tab sync, or browser-profile import parity.
- Guaranteed Widevine DRM, proprietary codec, or streaming-service compatibility.
- Enterprise policy parity or the full Chrome DevTools/managed-browser ecosystem.

Some sites may still reject non-Google Chromium clients, require a separately licensed Widevine DRM component, depend on proprietary codecs, or behave differently from mainstream browsers. Chrome account sync, Chrome's built-in credential store, enterprise policies, and exact Chrome Web Store parity are outside Electron's platform boundary. Treat compatibility with important work sites as a release-test requirement.
