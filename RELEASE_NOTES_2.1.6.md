# InvictaTill Browser 2.1.6

InvictaTill Browser 2.1.6 is a hotfix release addressing an issue where selecting an internal Workspace Tab for screen sharing in Google Meet/WebRTC would fail due to an invalid WebContents payload structure.

## Bug Fixes
- **Google Meet Screenshare (Workspace Tabs) Hotfix**: Reconfigured the internal WebRTC bridge to correctly identify the `.mainFrame` of a target tab, allowing Google Meet and other WebRTC apps to properly ingest the internal stream.

## Download

- Windows installer: `InvictaTill-Browser-Setup-2.1.6-x64.exe`
- Portable edition: `InvictaTill-Browser-Portable-2.1.6-x64.exe`
