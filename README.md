# InvictaTill Browser

InvictaTill Browser is a Windows productivity browser with an opt-in AI workspace. It combines a familiar multi-tab Chromium experience with private-by-default page assistance, task capture, browsing tools, and a release process designed around verification rather than silent production publishing.

## Architecture and security model

The application uses Electron with a trusted local browser-chrome window and sandboxed `WebContentsView` instances for web pages. Tab creation, navigation, permissions, downloads, printing, persistence, and AI requests are owned by the main process. A context-isolated preload exposes a narrow IPC API to the local renderer; remote pages do not receive Node.js or Electron access.

Regular tabs share the normal persistent browser session. Private windows use an isolated, temporary session and do not contribute to session restore, browsing history, or optional activity records. Website permissions are decided per request rather than granted globally, and new-window requests are validated before they are opened.

## Browser features

- Multi-tab browsing with reopen-closed-tab and optional session restore.
- Per-workspace last-active tab restoration, pinned tabs, close-other-tabs, and searchable tabs/commands with `Ctrl+Shift+A`.
- Searchable browsing history, bookmarks, and recent-page shortcuts.
- Managed downloads with an automatic compact progress box; dismissing the box keeps transfers running, while Cancel explicitly stops them.
- Automatic save/update prompts for submitted logins, with OS-encrypted storage and exact-site autofill shared across every normal workspace. Private windows never save or reuse vault passwords.
- A compact left app rail with one-click WhatsApp Web access.
- Private windows backed by an isolated, non-persistent session.
- Per-site permission prompts for capabilities such as camera, microphone, notifications, and location.
- In-app tab, window, and entire-screen sharing with optional requested audio for WebRTC meeting sites.
- Find in page, per-tab mute, page zoom, screenshots, printing, and save-to-PDF.
- Split view for working with two tabs side by side.
- Clear-browsing-data controls and visible update status.
- Persistent focus sessions with pause/resume, completion notifications, daily focused-time statistics, recovery breaks, and one-click remote-work launchers.

## InvictaTill AI

InvictaTill AI is the browser's single AI agent. It connects directly to the companion `self-learning-ai/invicta-space` service through `/api/v1/chat` for questions and `/api/v1/writing` for private draft rewriting. The default address is `http://127.0.0.1:7860/api/v1`; a secure remote InvictaTill AI address can be configured in Settings. A local extractive fallback keeps page summaries and task extraction available if the full service cannot be reached.

In Gmail and other web editors, right-click inside a draft to use **Fix spelling & grammar**, **Improve writing**, **Make concise**, or **Make professional**. `Ctrl+Shift+G` runs spelling and grammar correction on the focused editor. The browser verifies that the original text has not changed before applying the result, so an AI response cannot overwrite typing entered while it was working.

Page context is opt-in for each message. With **Share this page for this message** off, the assistant receives only the text you type. Turning it on authorizes extraction of the active page's readable text for that request; review sensitive pages before sharing them.

Activity tracking is a separate opt-in setting and is off by default. When enabled, it records sanitized navigation activity for the workspace views; URL query strings and fragments are removed. It is not enabled in private windows.

### Configure an AI provider

1. Open **InvictaTill AI**, then select **Settings**.
2. Enter the InvictaTill AI API base URL. The bundled local service uses `http://127.0.0.1:7860/api/v1`.
3. Enter an API key if the configured remote service requires one. The local guest service does not require a key.
4. Select **Test connection**, then **Save**.

The InvictaTill service may use plain HTTP only on a loopback address such as `127.0.0.1` or `localhost`; all remote API endpoints must use HTTPS.

Configure the service only through in-app Settings. Saved keys and continuity tokens are encrypted by the main process and are never read back into a web page.

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

Installed Setup builds check the stable GitHub release feed after startup. Update status is also available under **InvictaTill AI > Settings > Browser updates**, where a user can retry a check and restart once the verified update has downloaded. Development, private, and portable builds show why automatic installation is unavailable; portable users update by downloading the next portable executable manually.

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

Some sites may reject embedded Chromium clients, require unsupported DRM, or behave differently from mainstream browsers. Treat compatibility with important work sites as a release-test requirement.
