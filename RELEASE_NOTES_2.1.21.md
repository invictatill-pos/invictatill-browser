# InvictaTill Browser 2.1.21

InvictaTill Browser 2.1.21 features per-tab independent zoom level preservation, address-bar badge UI state synchronization, and enhanced zoom shortcuts.

## Tabwise Zoom Preservation & Badge Sync

- Per-Tab Zoom Persistence: Each tab maintains its own independent zoom level (`25%` to `300%`). Switching tabs automatically re-applies that tab's zoom factor to the web surface.
- Toolbar & Menu Badge Sync: Synchronized `state.zoomFactor` on active tab updates, ensuring the URL bar badge (`100%`, `120%`, etc.) and Chrome menu display update immediately upon tab switching or zoom level changes.
- Expanded Zoom Range: Unified zoom boundaries between `25%` (`0.25`) and `300%` (`3.0`) across both main process and renderer controls.
- Keyboard & Scroll Shortcuts: Supported <kbd>Ctrl + +</kbd>, <kbd>Ctrl + -</kbd>, <kbd>Ctrl + 0</kbd> in both the shell and active webpage views, along with native WebContents `zoom-changed` event handling for mouse wheel zoom.

## Verification

- Added contract test `tabwise zoom preservation and zoom bounds contract` to `tests/dom-contract.test.js`.
- Verified static checks and all 31 unit tests pass (`npm test`).
