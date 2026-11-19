# InvictaTill Browser 2.12.2

## Stability & Memory Optimization

- **Fixed Gmail & Heavy Web App Crashes**: Resolved repeated "This tab stopped responding" renderer crashes on complex Single Page Applications including Gmail, Google Drive, Google Chat, and Google Meet by removing restrictive V8 heap constraints.
- **Isolated Multi-Process Architecture**: Prevented shared-process cascading failures across tabs, ensuring background tabs do not interrupt or crash active workspaces.
- **Active & Audible Tab Protection**: Active tabs and tabs playing audio or running WebRTC meetings are protected from background timer throttling to prevent audio stutters or call drops.
- **Enhanced Tab Crash Recovery**: Reloading a crashed tab now reliably re-initializes a fresh renderer process and restores navigation cleanly.
- **Accurate Real-Time Memory Reporting**: Title bar memory pill now measures genuine private working set memory rather than duplicating shared OS/Electron framework libraries.

Installed copies can check for updates under **Browser tools → Settings → Browser updates**. Portable users can download the new portable executable.
