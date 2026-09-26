# InvictaTill Browser 2.8.1

## Highlights

InvictaTill Browser 2.8.1 delivers universal web application compatibility and modern browser capabilities across all websites, frameworks, scripts, and media workflows. Sites that perform OAuth login, 3D WebGL rendering, protected media playback, full-screen video, or heavy canvas exports now run with peak performance and reliability.

## Windows installation notice

This release is distributed without a publicly trusted Authenticode signature. Windows may show **Unknown publisher** or a Microsoft Defender SmartScreen warning during download or installation. Download only from the official InvictaTill Browser GitHub release page.

## Universal Web Application Compatibility

- **Google Suite & Modern OAuth Flow Compatibility** — All browser sessions dynamically send authentic Google Chrome Client Hints (`Sec-CH-UA`, `Sec-CH-UA-Mobile`, `Sec-CH-UA-Platform`) and clean Chrome user agent headers on all HTTP/HTTPS requests. This prevents sites (such as Google Accounts, Google Docs, Discord, Microsoft 365, Slack, Canva, and Spotify) from misidentifying the browser as an untrusted embedded webview or blocking sign-in.
- **Hardware Acceleration & GPU Rasterization** — Startup flags now enable GPU rasterization, accelerated 2D canvas, WebGL acceleration, and modern Chromium feature flags (`CanvasOopRasterization`, `OverlayScrollbar`), delivering smooth 60fps rendering for complex 3D apps (Three.js, Babylon.js, Figma, Spline) and rich visual editors.
- **Instant Media Autoplay** — Enabled `autoplay-policy=no-user-gesture-required` so video and audio content in web applications, video calls, media players, and interactive tools play immediately without stalling on user gesture requirements.
- **Seamless HTML5 Video & Game Fullscreen** — Entering HTML full-screen mode (`enter-html-full-screen`) dynamically expands the active tab view to fill the browser window cleanly, with smooth restoration to the standard navigation layout upon exiting full screen.
- **About:Blank & Multi-Window Popup Handling** — Enhanced popup window management to support `about:blank` initialization, `popup` window feature string parsing, and nested popups (`did-create-window`), ensuring payment gateways (Stripe, PayPal, 3D Secure), authentication redirects, and print helpers function seamlessly.
- **Expanded Modern Web Capabilities** — Added seamless handling and default grants for non-invasive capabilities including local installed fonts (`local-fonts`), screen wake lock (`screen-wake-lock`), persistent storage (`persistent-storage`), background synchronization (`background-sync`), and protected media playback (`mediaKeySystem`).
- **High-Capacity Data URL Downloads** — Increased the maximum data URL limit from 2MB to 64MB, allowing large client-side canvas renders, high-resolution PDFs, zipped bundles, and spreadsheet exports to download without truncation or interruption.
- **Extended External Protocol Support** — Added native external protocol delegates for popular desktop companions: Telegram (`tg:`), Discord (`discord:`), Skype (`skype:`), WhatsApp (`whatsapp:`), VS Code (`vscode:`, `vscode-insiders:`), Steam (`steam:`), Notion (`notion:`), and Figma (`figma:`).
- **Background Web App Performance** — Configured tabs with non-throttled background execution so background music streams, WebRTC conference calls, WebSockets, and long-running calculations remain fast and connected.
