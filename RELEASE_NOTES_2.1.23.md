# InvictaTill Browser 2.1.23

InvictaTill Browser 2.1.23 delivers a premium, fully interactive zoom control panel directly in the navigation bar — replacing the basic three-button strip with a rich popup featuring a live slider, quick-preset chips, and animated feedback.

## Enhanced Zoom Controls

- **Interactive Zoom Popup Panel**: Clicking the zoom percentage badge now opens a floating popup panel with a large percentage readout, a smooth range slider (25% → 500%), and six quick-preset buttons (50%, 75%, 100%, 125%, 150%, 200%).
- **Live Range Slider**: Drag the slider to adjust zoom in real time — the UI updates instantly with no IPC lag on drag, then commits the zoom to the page on release.
- **Quick-Preset Chips**: One-click zoom presets with active-state highlight showing your current zoom level at a glance.
- **Badge Bounce Animation**: The `%` badge in the nav bar plays a smooth spring-bounce animation every time the zoom level changes, giving clear visual confirmation.
- **Scroll-to-Zoom on Badge**: Scroll the mouse wheel up/down directly on the percentage badge to zoom in/out without opening the popup.
- **Middle-Click to Reset**: Middle-clicking the badge instantly resets to 100% without opening the popup.
- **SVG Icons for ± Buttons**: Replaced text `+`/`−` characters with crisp SVG icons that render perfectly at any DPI.
- **Popup Auto-Close**: Clicking outside the zoom strip, pressing `Escape` inside the popup, or switching tabs closes the panel automatically.
- **Keyboard Shortcuts Hint**: Footer inside the popup lists `Ctrl +`, `Ctrl −`, and `Ctrl 0` shortcut hints for discoverability.
- **All Zoom Surfaces Stay in Sync**: Whether zoom is changed via keyboard shortcut, toolbar buttons, menu, or the slider, the badge, popup, and strip glow all update together.

## Visual & UX Improvements

- **Premium Popup Design**: Glassmorphic elevated panel with spring entrance animation, cyan-filled slider track, and green accent when not at 100%.
- **Active Preset Highlighting**: The chip matching the current zoom level glows in cyan so users always know their exact zoom at a glance.
- **Dynamic Tooltip**: The badge tooltip updates dynamically to reflect the current zoom level and whether the popup is open.
