# InvictaTill Browser 2.1.3

InvictaTill Browser 2.1.3 delivers zero-latency screen sharing for Google Meet, Zoom, and Teams by optimizing desktopCapturer execution and enabling WebRTC peer-connection capabilities!

## Highlights

- **Instantaneous Screen Share (<2ms)**: Optimized `desktopCapturer.getSources` with `thumbnailSize: { width: 0, height: 0 }` and `fetchWindowIcons: false`, bypassing high-res window snapshot bottlenecks that caused Google Meet WebRTC timeouts.
- **WebRTC Network & mDNS Enhancements**: Disabled `WebRtcHideLocalIpsWithMdns` and enabled `ScreenCapture` and `WebRTCPipeWireCapturer` features to allow WebRTC stream negotiation to succeed immediately.
- **Default & Workspace Session Permissions**: Registered screen capture and permission handlers across all workspace sessions and the default session.
- **Persistent Logins & Workspace Titles**: Kept session cookies and workspace names saved across restarts.
- **Cross-Workspace Password Vault 🔑**: Save and autofill passwords across all workspaces.

## Download

- Windows installer: `InvictaTill-Browser-Setup-2.1.3-x64.exe`
- Portable edition: `InvictaTill-Browser-Portable-2.1.3-x64.exe`
