# InvictaTill Browser 2.0.0

InvictaTill Browser 2.0 is a major security, interface, and AI-workspace upgrade for Windows 10/11 x64.

## Highlights

- Modern multi-tab browsing with session restore, recently closed tabs, split view, history, downloads, find, mute, zoom, screenshots, printing, and PDF export.
- InvictaTill AI workspace with three provider choices: private local assistance, the direct InvictaTill AI API, and the OpenAI Responses API.
- Page context is disabled by default and is shared only for the message where the user explicitly enables it.
- Private windows, per-site permission prompts, clear-browsing-data controls, and opt-in activity records with query and fragment redaction.
- Encrypted storage for cloud API credentials using the operating system's secure-storage facilities.
- Redesigned responsive browser chrome and dedicated AI, tasks, history, downloads, and settings panels.

## Security architecture

- Replaced the legacy guest webview implementation with main-process-owned, sandboxed `WebContentsView` tabs.
- Added strict content security policy, validated IPC, restricted protocols, safe popup routing, and permission mediation.
- Removed unsafe Chromium command-line overrides, security-header stripping, mixed-content allowances, and operating-system process mutations.
- Hardened the packaged Electron runtime with ASAR integrity and production fuse settings.

## Download

- Windows installer: `InvictaTill-Browser-Setup-2.0.0-x64.exe`
- Portable edition: `InvictaTill-Browser-Portable-2.0.0-x64.exe`

The installer, portable executable, blockmap, and `latest.yml` are produced and verified together as one release set.
