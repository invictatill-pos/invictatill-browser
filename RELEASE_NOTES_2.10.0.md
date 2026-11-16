# InvictaTill Browser 2.10.0

A high-performance update focusing on ultra-low RAM consumption, an automated tab sleeping system, full dark mode, and distraction-free reading mode while keeping all existing features completely intact.

- **Ultra-Low Memory Footprint**: Added Chromium V8 heap bounds (`--max-old-space-size=256`, `--optimize-for-size`, `--renderer-process-limit=5`), aggressive cache trimming, and background throttling to keep browser RAM usage minimal.
- **Intelligent Inactive Tab Sleep**: Inactive tabs that have been idle for 10+ minutes automatically sleep to release renderer RAM and discard cache, displaying a 💤 indicator in the tab bar. Pinned tabs and tabs playing audio are never put to sleep. Switching to any sleeping tab wakes it smoothly and instantly.
- **Real-Time Memory Pill**: An active memory consumption pill in the window titlebar displays live browser RAM usage. Clicking the pill or using the "Free memory now" button in Settings immediately purges memory caches across all workspaces.
- **Full Dark Theme**: Switch between Light, Dark, and System color schemes from the Appearance & Theme section in the Settings panel.
- **Distraction-Free Reading Mode**: Added a dedicated Reading Mode button directly to the browser toolbar that strips clutter, headers, and advertisements to present articles in a clean, elegant reading layout.
- **Memory & Performance Settings**: Real-time stats in the Settings drawer report total browser RAM, system free RAM, and active sleeping tabs with controls to purge cache on demand.
- **Modern Look & Feel**: Streamlined 6px scrollbars, subtle ambient animations, and an optional Compact Navigation Bar setting to maximize vertical reading area.
- **Complete Feature Continuity**: Workspaces, WhatsApp integration, focus sessions, AI writing tools, task management, password manager, Chrome extensions, and shortcut bindings remain 100% intact.

This release is distributed without a publicly trusted Authenticode signature. Windows may display an **Unknown publisher** or Microsoft Defender SmartScreen warning. Download only from the official InvictaTill Browser GitHub release page.
