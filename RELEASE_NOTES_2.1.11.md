# InvictaTill Browser 2.1.11

InvictaTill Browser 2.1.11 restores reliable screen sharing for Google Meet and other WebRTC meeting sites, strengthens permission and credential handling, and fixes regressions found during full application QA.

## Improvements

- Choose an InvictaTill tab, application window, or entire screen from an accessible in-app picker.
- Share selected-tab audio without capturing unrelated system audio; screen and window sources can include Windows system audio when requested.
- See the requesting site before sharing, cancel safely with Escape, and rely on automatic expiry for abandoned requests.
- Updated the Electron 43 runtime to the latest tested patch release.

## Bug fixes and security

- Fixed malformed modal markup that kept the screen picker inside hidden dialogs.
- Removed stale callback races, wrong-source fallbacks, and invalid screen-share audio constraints.
- Fixed tab drag-and-drop ordering crashing at runtime.
- Fixed address suggestions violating the renderer DOM-safety contract.
- Changed undecided camera and microphone permissions to prompt instead of being silently pre-approved.
- Removed an embedded AI service credential and disabled plaintext password-vault fallback storage.
- Updated the vulnerable `fast-uri` transitive package to 3.1.4.

## Verification

- Static syntax and security checks.
- Unit and DOM-contract tests.
- Isolated Electron end-to-end tests covering a live `getDisplayMedia()` video/audio stream, cancellation, modal structure, tab ordering, navigation, history, and AI integration.
- Windows installer and portable build generation.
