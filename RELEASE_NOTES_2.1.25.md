# InvictaTill Browser 2.1.25

InvictaTill Browser 2.1.25 fixes the zoom percentage badge not updating when changing zoom via the slider or buttons, and redesigns the zoom popup into a compact, professional panel.

## Bug Fix — Zoom Display Always Shows Correct Percentage

The zoom percentage badge in the navigation bar was not updating in real time when zoom was changed via the slider or ± buttons. The page itself zoomed correctly but the displayed number stayed stale.

**Root cause**: `renderBrowserControls()` was reading `tab.zoom` from the local renderer cache, which is only updated when the main process sends a `tab-update` event (asynchronous). Since `setZoom()` calls `renderBrowserControls()` immediately after the IPC call resolves (before the async event arrives), the display was reading a stale cached value.

**Fix**: `renderBrowserControls()` now uses `state.zoomFactor` as the source of truth (which `setZoom` / `switchTab` always update before rendering). `setZoom()` also immediately patches the local `state.tabs[]` cache so all subsequent render calls are consistent.

## UI Redesign — Compact Professional Zoom Panel

The previous popup panel (260px wide, full header + slider row with min/max labels + 6 presets + footer) was too large for a toolbar control.

**New design**:
- Width reduced from 260px → 192px
- Removed the "Page Zoom" title header row
- Single compact row: live `%` number (17px bold) + slider side-by-side
- All 6 preset chips in one tight row, no wrapping
- Single-line keyboard hint in tiny muted text with styled `<kbd>` chips
- Darker, higher-contrast background (`#181c28`)
- Active preset highlights in green (brand color) instead of cyan
- Entrance animation is slightly snappier (0.18s vs 0.2s)
