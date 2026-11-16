# InvictaTill Browser 2.11.0

A powerful release introducing a comprehensive Migration Assistant to import your browsing history and saved passwords from older browsers, combined with the ultra-low RAM performance engine, automated tab sleeping, dark mode, and distraction-free reading mode.

- **Direct History Import from Installed Browsers**: Automatically detects installed Google Chrome, Microsoft Edge, and Brave instances on your machine. One-click import safely extracts your browsing history records into InvictaTill Browser with deduplication.
- **Universal Password Import (CSV)**: Import saved passwords exported as CSV from Chrome, Edge, Firefox, Brave, Safari, 1Password, Bitwarden, KeePass, and other vaults. Every imported password is securely encrypted with Windows DPAPI hardware-backed safe storage.
- **History File Importer**: Bring over history from exported JSON or CSV files easily via the Migration Assistant dialog.
- **Ultra-Low Memory Footprint**: Chromium V8 memory caps (`--max-old-space-size=256`, `--optimize-for-size`, `--renderer-process-limit=5`), aggressive cache trimming, and background tab process throttling.
- **Intelligent Inactive Tab Sleep System**: Inactive tabs idle for 10+ minutes automatically sleep to reclaim RAM. A 💤 icon appears on sleeping tabs, and clicking any sleeping tab wakes it smoothly and instantly. Audio-playing and pinned tabs are preserved.
- **Real-Time Memory Pill**: Displays live RAM consumption in the titlebar, with a one-click purge to clear memory caches instantly across workspaces.
- **Full Dark Theme**: Switch between Light, Dark, and System color schemes in Settings.
- **Distraction-Free Reading Mode**: Dedicated toolbar button to clean up web articles for a distraction-free reading experience.
- **100% Feature Continuity**: Multi-login Workspaces, WhatsApp side panel, InvictaTill AI writing tools, Chrome extensions, and all security boundaries remain 100% intact.

This release is distributed without a publicly trusted Authenticode signature. Windows may display an **Unknown publisher** or Microsoft Defender SmartScreen warning. Download only from the official InvictaTill Browser GitHub release page.
