# InvictaTill Browser 2.1.22

InvictaTill Browser 2.1.22 updates page zoom handling to match Google Chrome across per-host memory, discrete steps, address-bar badge display, and input shortcuts.

## Chrome-Identical Zoom Features

- **Chrome Standard Discrete Zoom Steps**: Standardized zoom factors to Google Chrome's 17 discrete zoom levels (`25%`, `33%`, `50%`, `67%`, `75%`, `80%`, `90%`, `100%`, `110%`, `125%`, `150%`, `175%`, `200%`, `250%`, `300%`, `400%`, `500%`).
- **Per-Host / Per-Domain Zoom Memory**: Site zoom levels are automatically saved per hostname (`site_zoom_levels_v1`). Navigating between sites (e.g. `github.com` @ 125% and `google.com` @ 100%) automatically restores that domain's custom zoom level.
- **Chrome Address Bar Zoom Pill & Highlight**: When active tab zoom is not 100%, the address bar displays a highlighted zoom pill (`.zoom-controls-strip.is-zoomed`) with an emerald glow. Clicking the zoom level percentage immediately resets it to 100%.
- **Expanded Keyboard & Numpad Shortcuts**: Full shortcut support for <kbd>Ctrl + +</kbd>, <kbd>Ctrl + -</kbd>, <kbd>Ctrl + 0</kbd>, <kbd>Ctrl + NumpadAdd</kbd>, <kbd>Ctrl + NumpadSubtract</kbd>, <kbd>Ctrl + Numpad0</kbd>, and Ctrl+Scroll wheel gestures.

## Verification

- Added contract assertion for `CHROME_ZOOM_STEPS` in `tests/dom-contract.test.js`.
- Verified static checks and all 31 unit tests pass (`npm test`).
