# InvictaTill Browser 2.1.14 Workspace and WFH Quality

## Completed scope

- Restored Google Meet and WebRTC screen sharing with a visible, accessible source picker.
- Added race-safe request IDs, expiry, cancellation, exact source matching, and source-aware audio capture.
- Decoupled the picker from Windows screen/window enumeration so slow graphics drivers cannot block tab sharing.
- Fixed modal markup, focus trapping, Escape handling, tab reordering, and address-suggestion DOM safety.
- Corrected undecided site-permission behavior while treating the custom screen picker as display-capture consent.
- Removed the embedded AI service credential and plaintext password-vault fallback.
- Updated Electron to 43.2.0 and pinned the vulnerable `fast-uri` transitive dependency to 3.1.4.
- Rebuilt the screen-share picker as a responsive two-pane dialog with source tabs, selection state, preview, audio control, and accessible actions.
- Restored constrained address and new-tab suggestions with title and URL ellipsis for arbitrarily long history entries.
- Removed CSP-blocked inline styling from every dialog and dynamic UI component, consolidating the renderer into one maintained stylesheet.
- Reworked workspace, password, notification, titlebar, and compact-window layouts and fixed the Passwords dialog runtime failure.
- Rebuilt internal updates around a deterministic controller with complete state, error, progress, and restart handling.
- Added a responsive update card and manual check action to Settings, including explicit portable-build behavior.
- Added automated update-controller and release-feed tests and a public release asset verifier.
- Hardened release staging to require valid Authenticode signatures and verify every uploaded draft asset.
- Persisted a separate last-active tab for every workspace and corrected related close, reopen, Ctrl+Tab, split-view, and deletion edge cases.
- Added cross-workspace tab and command search, pinned tabs, copy-link, and close-other-tabs controls.
- Added persistent focus and break sessions with pause/resume, title-bar countdown, native completion notification, and daily statistics.
- Added remote-work launchers for Google Meet, Calendar, Gmail, and Microsoft Teams.

## Verification completed

- `npm run check`
- `npm test`, including workspace restoration, focus lifecycle, updater lifecycle, error handling, and release-feed coverage
- `npm run test:e2e`, including real display-media capture, all share-source categories, cancellation, long-URL containment, dialogs, menu, drawer, and 900px responsive geometry
- `npm audit --omit=dev`
- `npm run build`
- Normal launch and clean shutdown of the packaged executable
- ASAR content/version and embedded-credential inspection
- Installer, portable executable, update metadata, and SHA-256 inspection
- Local and public update-feed asset verification

## Release requirement

The generated installer and portable executable must be signed with a publicly trusted, timestamped production certificate. Run `npm run verify:update-feed -- --tag v2.1.14` after publication before declaring the rollout complete.
