# InvictaTill Browser 2.0.1

InvictaTill Browser 2.0.1 is a maintenance and permissions update for Windows 10/11 x64.

## Highlights

- **Google Meet & WebRTC Support**: Fixed camera, microphone, and screen-sharing permission queries so video calling services work smoothly.
- **Address Bar Site Permissions Control**: Click the `🔒 HTTPS` icon in the address bar to view, change (`Allow`, `Deny`, `Ask`), or reset site permissions for camera, microphone, location, and notifications.
- **Permission State Synchronization**: Unified Chromium permission check and request handlers so media permissions are persisted cleanly.

## Security & Runtime

- Preserved all sandboxed `WebContentsView` security controls, context isolation, IPC validation, and strict CSP policies.
- Per-site permission grants are securely managed per origin.

## Download

- Windows installer: `InvictaTill-Browser-Setup-2.0.1-x64.exe`
- Portable edition: `InvictaTill-Browser-Portable-2.0.1-x64.exe`
