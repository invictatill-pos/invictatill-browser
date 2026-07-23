# InvictaTill Browser 2.1.24

InvictaTill Browser 2.1.24 fixes two per-tab zoom correctness issues: the zoom badge now always shows the real zoom of whichever tab is active, and new tabs opened for the same domain (duplicates, sub-links) start at the correct saved zoom level immediately.

## Bug Fixes

### Fix 1 — Per-Tab Zoom Badge Always Shows Correct Percentage

Previously, switching between tabs could leave the zoom badge showing a stale percentage from the previously-viewed tab, even though the page itself was rendered at the correct zoom. The zoom was correct in the page but wrong in the UI.

**Root cause**: The `switchTab()` IPC call returns the new tab's complete data (including its `zoom` field), but the renderer was not reading that returned zoom — it relied on an older cached value in `state.tabs[]`.

**Fix**: `switchTab()` now reads `result.zoom` from the IPC response and updates `state.zoomFactor` and the cached tab object **before** calling `renderBrowserControls()`. The `tab-switched` push event handler also now syncs zoom the same way.

### Fix 2 — Duplicate Tabs & Sub-Links Inherit Domain Zoom Immediately

Previously, opening a duplicate tab or clicking a sub-link of a domain where you had set a custom zoom (e.g. 125%) would show 100% in the badge until the page finished navigating. The actual zoom was applied on the `did-navigate` event, which fires after the tab is already visible.

**Root cause**: `createTab()` in the main process defaulted to `zoom = 1.0` when no explicit `restored.zoom` was provided, and only the `did-navigate` callback applied domain zoom — too late to be reflected in the initial `tab-created` event.

**Fix**: `createTab()` now calls `getZoomForUrl(url)` as the initial zoom when no `restored.zoom` is given. The new tab starts at the domain's saved zoom level from the very first frame, matching the badge and popup display.
