# InvictaTill Browser 2.2.0

InvictaTill Browser 2.2.0 introduces 5 major feature updates: full Chrome Extension support with a built-in Extension Store, Grammarly-style spelling and grammar assistance with floating badges, an Opera GX-style floating and draggable download window, Developer Tools & Inspect Element for all users, and a critical fix for Excel, CSV, and PDF report downloads.

## 1. Chrome Extension Support & Extension Store
- **Full Extension Support**: Load and run Chrome Manifest V2 and V3 extensions directly inside InvictaTill Browser.
- **Built-in Extension Store**: Browse, search, and install popular extensions (uBlock Origin, Bitwarden, Dark Reader, etc.) or install from local `.crx` / `.zip` files.
- **Extension Toolbar**: Access active extension icons directly in the browser chrome bar.

## 2. Grammarly-Style Spelling & Grammar Correction
- **Floating Badge Indicator**: Persistent ✦ indicator badge on active text fields showing real-time correction counts.
- **Full Field Scanning**: Lower detection thresholds to catch individual misspellings and grammar issues instantly.
- **Quick Apply & Dismiss**: One-click correction insertion into inputs, textareas, and contenteditable fields.

## 3. Floating Download Window (Opera GX Style)
- **Draggable & Resizable**: Position the download popout anywhere on your screen with saved position persistence.
- **Unlimited List Scrolling**: Removed 4-item view limits to display all active and past downloads with file-specific iconography (📄 PDF, 📊 Excel, 📋 CSV, 📦 ZIP, ⚙️ Executables).
- **Auto-Flyout**: Automatically expands on new download creation.

## 4. Developer Tools & Inspect Element
- **Universal DevTools Access**: Inspect Element available in right-click context menus for all users.
- **Keyboard Shortcuts**: Added standard F12, Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), and Ctrl+U (View Page Source).
- **Developer Options Submenu**: Clean organized submenu for developer inspection and source viewing.

## 5. Report Download Fix (Excel / CSV / PDF)
- **Blob & Data URL Support**: Fixed blocked downloads for dynamically generated report files (e.g. Skolaro, ERPs) using `blob:` and `data:` schemes.
