# InvictaTill Browser 2.1.11 Hardening

## Completed scope

- Restored Google Meet and WebRTC screen sharing with a visible, accessible source picker.
- Added race-safe request IDs, expiry, cancellation, exact source matching, and source-aware audio capture.
- Decoupled the picker from Windows screen/window enumeration so slow graphics drivers cannot block tab sharing.
- Fixed modal markup, focus trapping, Escape handling, tab reordering, and address-suggestion DOM safety.
- Corrected undecided site-permission behavior while treating the custom screen picker as display-capture consent.
- Removed the embedded AI service credential and plaintext password-vault fallback.
- Updated Electron to 43.2.0 and pinned the vulnerable `fast-uri` transitive dependency to 3.1.4.

## Verification completed

- `npm run check`
- `npm test`
- `npm run test:e2e`, including three consecutive display-media passes
- `npm audit --omit=dev`
- `npm run build`
- Normal launch and clean shutdown of the packaged executable
- ASAR content/version and embedded-credential inspection
- Installer, portable executable, update metadata, and SHA-256 inspection

## Release requirement

The generated installer and portable executable are not Authenticode-signed. Sign them with the approved production certificate before publishing a public release.
