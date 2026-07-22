# InvictaTill Browser

InvictaTill Browser is a Windows productivity browser with an opt-in AI workspace. It combines a familiar multi-tab Chromium experience with private-by-default page assistance, task capture, browsing tools, and a release process designed around verification rather than silent production publishing.

## Architecture and security model

The application uses Electron with a trusted local browser-chrome window and sandboxed `WebContentsView` instances for web pages. Tab creation, navigation, permissions, downloads, printing, persistence, and AI requests are owned by the main process. A context-isolated preload exposes a narrow IPC API to the local renderer; remote pages do not receive Node.js or Electron access.

Regular tabs share the normal persistent browser session. Private windows use an isolated, temporary session and do not contribute to session restore, browsing history, or optional activity records. Website permissions are decided per request rather than granted globally, and new-window requests are validated before they are opened.

## Browser features

- Multi-tab browsing with reopen-closed-tab and optional session restore.
- Searchable browsing history, bookmarks, and recent-page shortcuts.
- Managed downloads with progress and completed-download controls.
- Private windows backed by an isolated, non-persistent session.
- Per-site permission prompts for capabilities such as camera, microphone, notifications, and location.
- In-app tab, window, and entire-screen sharing with optional requested audio for WebRTC meeting sites.
- Find in page, per-tab mute, page zoom, screenshots, printing, and save-to-PDF.
- Split view for working with two tabs side by side.
- Clear-browsing-data controls and visible update status.

## Invicta AI

Invicta AI has three provider modes:

- **Local fallback** provides basic assistance without an API key. It is intended for lightweight summarization, explanation, and task extraction when a cloud provider is unavailable.
- **InvictaTill AI API** connects directly to the companion `self-learning-ai/invicta-space` service through its authenticated `/api/v1/chat` endpoint. The default local address is `http://127.0.0.1:7860/api/v1`.
- **OpenAI Responses provider** sends requests from the Electron main process to an OpenAI Responses-compatible `/responses` endpoint. The renderer never receives the saved API key.

Page context is opt-in for each message. With **Share this page for this message** off, the assistant receives only the text you type. Turning it on authorizes extraction of the active page's readable text for that request; review sensitive pages before sharing them.

Activity tracking is a separate opt-in setting and is off by default. When enabled, it records sanitized navigation activity for the workspace views; URL query strings and fragments are removed. It is not enabled in private windows.

### Configure an AI provider

1. Open **Invicta AI**, then select **Settings**.
2. Choose **InvictaTill AI API** for the companion service, or **OpenAI Responses API** for OpenAI.
3. Enter the API base URL and API key. OpenAI mode also requires a Responses-compatible model name.
4. Select **Test connection**, then **Save**.

The InvictaTill service may use plain HTTP only on a loopback address such as `127.0.0.1` or `localhost`; all remote API endpoints must use HTTPS.

Configure the provider only through in-app Settings. Saved keys are handled by the main process and are not read back into the page. To return to offline behavior, change the provider to **Local**.

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

Installed Setup builds check the stable GitHub release feed after startup. Update status is also available under **Invicta AI > Settings > Browser updates**, where a user can retry a check and restart once the verified update has downloaded. Development, private, and portable builds show why automatic installation is unavailable; portable users update by downloading the next portable executable manually.

A public update release is valid only when the Setup executable, matching `.blockmap`, and `latest.yml` are published together. Verify a published tag with:

```powershell
npm run verify:update-feed -- --tag v2.1.13
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
