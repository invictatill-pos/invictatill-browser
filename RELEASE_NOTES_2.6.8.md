# InvictaTill Browser 2.6.8

## Bug Fixes (QA Report)

### Dead Code Removed — Duplicate `renderDownloads()`
The first `renderDownloads()` function definition (108 lines, using `var` and older emoji-icon logic) was completely dead code due to JavaScript function hoisting — the second definition at the bottom always won at runtime. Removed entirely to eliminate confusion and regression risk.

### Screen Share — Audio Checkbox Now Functional
The screen-share picker's "Also share audio" checkbox and label existed in `renderer.js` logic but had no corresponding HTML elements in `index.html`. The elements `#chk-share-audio` and `#screen-picker-audio-label` are now present in the screen picker footer, restoring the audio-sharing option for screen capture requests that include audio.

### Drawer Layout Comment Added
Added an explanatory comment clarifying why `els.drawer.getBoundingClientRect().right` is used as a `left` offset for the BrowserView (the drawer slides out from the left rail — its right edge is the correct BrowserView start position).

### Permission Indicator — Silent Errors Now Logged
Three `.catch(function () {})` calls that silently swallowed permission-indicator update failures now log `console.warn` with context, making API failures visible in DevTools during development.

## CSS Addition
Added `.screen-picker-audio-row` styles for the new audio checkbox — disabled state, label cursor, and accent colour matching the browser theme.
