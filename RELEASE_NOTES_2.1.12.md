# InvictaTill Browser 2.1.12

InvictaTill Browser 2.1.12 completes a full browser-shell UI pass and fixes the visual failures affecting long address suggestions and the Google Meet screen-share chooser.

## UI improvements

- Rebuilt the share-source chooser with a centered responsive dialog, clear source tabs, consistent cards, a dedicated preview pane, selected-state confirmation, and aligned audio and action controls.
- Added robust truncation and containment for long history titles and URLs in both the omnibox and new-tab search suggestions.
- Improved new-tab spacing, compact-window behavior, workspace pills, titlebar containment, toast placement, and focus presentation.
- Standardized the workspace and password dialogs with readable field layouts, responsive grids, accessible labels, and reusable component styling.

## Bug fixes

- Fixed the strict content security policy blocking inline dialog styles and causing the raw, collapsed screen-share layout.
- Fixed the orphaned suggestion stylesheet that allowed long Google sign-in URLs to cover the new-tab page.
- Fixed the Passwords button calling an undefined active-tab helper and silently failing to open its dialog.
- Fixed new tabs retaining a previous new-tab search query.
- Kept compact notifications below browser controls so they cannot cover workspace or window actions.

## Verification

- Static syntax checks and 12 unit, security, package, and DOM-contract tests.
- Isolated Electron UI tests at full desktop size and the supported 900 × 650 minimum window.
- Geometry and overflow validation for browser chrome, new-tab content, long suggestions, browser menu, workspace and password dialogs, productivity drawer, and screen-share picker.
- Live `getDisplayMedia()` verification for video and requested audio, source-category switching, selection, cancellation, and stream shutdown.
