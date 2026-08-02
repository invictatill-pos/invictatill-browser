# InvictaTill Browser v2.7.4

## Bug Fixes

### Fullscreen Layout Fix
- Fixed an issue where the browser tab surface (BrowserView/WebContentsView) could overlap the browser chrome (top bar and app rail) when entering or exiting fullscreen mode.
- Introduced `FULLSCREEN_VIEW_LAYOUT` to correctly zero-out the top and left offsets in fullscreen, so the native tab surface fills the entire window as expected.
- Layout bounds now apply a minimum clamp based on whether the window is in fullscreen, preventing the renderer from accidentally pushing the view behind chrome elements.

## Internal
- Moved `main.js` file read into shared test scope so all DOM-contract tests can inspect the main process without re-reading the file.
- Added new contract test: `native tab surface stays below browser chrome and app rail`.
