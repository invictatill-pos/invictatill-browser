# InvictaTill Browser 2.1.27

InvictaTill Browser 2.1.27 introduces a roomy top-right downloads flyout redesign with dedicated header iconography, flexible subtitle meta, adaptive toast notification positioning, and polished action buttons.

## Roomy Top-Right Downloads Flyout Polish

### Visual & Layout Enhancements
- **Top-Right Chrome Positioning**: The downloads popout panel is positioned directly below the active browser chrome (`top: calc(var(--chrome-height) + 8px)`) on the right side of the screen.
- **Header Icon & Subtitle**: Added an SVG transfer icon with brand cyan styling and a "Files and transfers" subtitle for better context.
- **Adaptive Toast Notification Stack**: When the downloads flyout is active on wide viewports (>= 900px), system toast notifications shift left (`right: 426px`) so notifications never obscure ongoing file transfers or action buttons.
- **Action Button Sizing & Spacing**: Enhanced button heights (29px), horizontal padding (11px), and 7px border-radius with clear visual contrast across Open, Show in folder, Cancel, and Pause actions.
- **Summary Text Clarity**: Updated dynamic summary count message ("closing this panel will not delete files").

## Automated Testing & Quality
- Added unit and DOM contract assertions in `dom-contract.test.js` verifying top-right calculations, action button heights, toast notification offsets, and header structure.
- Extended electron smoke tests in `electron-smoke.js` verifying flyout geometry and notification non-overlap on wide viewports.
