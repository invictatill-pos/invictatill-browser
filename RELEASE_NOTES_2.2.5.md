# InvictaTill Browser v2.2.5 — Extension Store Polish

This release polishes the Extension Store experience, providing better visual feedback when loading extensions and fixing UI states.

## Fixes & Improvements

### Extension Store
- **New:** Added a loading spinner state while fetching featured and installed extensions to prevent a blank screen while data loads over the network.
- **Improved:** Extension cards now display their version numbers, and the extension toolbar shows a helpful "No extensions enabled" hint if the toolbar is empty.
- **Fixed:** The tab switching logic between "Featured" and "Installed" has been fixed so content updates reliably when navigating between categories.
- **Improved:** Fallback icons are generated more robustly if an extension's custom icon fails to load.
