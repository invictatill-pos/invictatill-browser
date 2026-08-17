# InvictaTill Browser 2.8.0

## Highlights

A full QA and polish pass across the browser shell, web engine bridge, and styling system. Every feature was re-tested end-to-end and a batch of long-standing rendering, race, and accessibility bugs were fixed.

## Fixed

- **AI Quick Actions crash** — The 24H WFH Report and Email Task extraction buttons called a function that never existed (`appendChatMessage`), throwing a `ReferenceError` and doing nothing. Both buttons (including the Tasks panel Email Tasks button, which had no handler at all) now render their results in chat reliably.
- **Zoom popup invisible** — The popup was clipped by the nav row's scroll container, so it could never appear. It now renders fully below the zoom control strip.
- **Stale address-bar suggestions** — Fast typing could resolve history lookups out of order. Suggestions are now sequenced, guarded against API failures, and keyboard-accessible with proper `listbox`/`option` roles.
- **Workspace rename hijack** — Clicking inside the inline rename input bubbled to the workspace pill and switched the active workspace mid-edit, destroying the input. Rename inputs now isolate their clicks.
- **Tab zoom cache dead code** — `normalizeTab` dropped the `zoom` field, so per-tab zoom state never flowed back into the toolbar. Restored, so the badge always matches the active tab.
- **Extension toolbar duplicates** — Two startup calls raced and could render extension icons twice. Rendering is now token-guarded, and a crowded toolbar scrolls inside its own lane instead of overflowing.
- **Permission pills stale** — Address-bar permission indicators now refresh on startup, workspace switch, and tab activation, not just navigation.
- **Screen picker selection resets** — Late desktop-source updates wiped the user's selection. The selection is preserved when the chosen source still exists.
- **HTTP auth prompt collisions** — A new auth request overwrote a pending one without resolving it. Overlaps are now cancelled cleanly.
- **Unguarded API calls** — Startup event subscriptions and extension actions could throw if a capability was missing. All are now defensive.
- **Tab-switch races** — `tab-switched` could set the active tab to one the workspace filter had discarded, leaving all controls disabled until a refresh.
- **Dead code & styles removed** — Unused screen-picker audio references, zoom presets, workspace-menu styles, mode-badge rules, duplicate resize-handle rules, and provider-badge leftovers are gone.
- **Undefined CSS tokens** — Missing tokens (`--yellow`, `--accent-emerald`, `--accent-blue`, `--bg-secondary`, `--bg-tertiary`) are now defined, restoring amber download warnings and consistent surfaces.
- **Favicon CSP** — `http:` and `chrome-extension:` image sources are now allowed so favicons and extension icons render instead of silently falling back.

## Polished

- Page-level shortcuts now work from inside web pages: **Ctrl+D** bookmark, **Ctrl+M** mute, **Ctrl+Shift+S** screenshot.
- Smooth hover transitions on quick links, drawer tabs, history segments, command results, suggestions, and primary buttons.
- Focus-visible rings for links, pointer cursors on selects, and non-selectable browser chrome.
- Consistent zoom-panel and popup surfaces using the shared design tokens.
- Extension store tabs are now properly ARIA-wired (`aria-controls` / `aria-labelledby`).
- Workspace icon picker announces its selection to screen readers.
- WhatsApp panel resize handle is fully reachable instead of half-clipped by panel overflow.
