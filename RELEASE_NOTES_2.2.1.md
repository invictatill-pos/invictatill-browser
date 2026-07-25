# InvictaTill Browser v2.2.1 — Bug Fix Release

This patch release resolves several reported issues with extensions, WhatsApp, spell check, login popups, and downloads.

## Bug Fixes

### Chrome Extensions
- **Fixed:** Extensions installed via the Extension Store were not loading into browser tabs. They are now correctly loaded into all workspace sessions and apply to every tab.

### WhatsApp Panel
- **New:** The WhatsApp side panel now has a drag-to-resize handle on its right edge — drag to widen or narrow the panel. Arrow keys also work when the handle is focused (Shift+Arrow for large steps).

### Spell Check
- **Fixed:** Instant spell checking (red underlines on misspelled words and right-click suggestions) was not activating. Spell check now works correctly in all tabs and in the WhatsApp panel.

### Login Popups & Google OAuth
- **Fixed:** Sites that open a login or sign-in popup via window.open() — including AnyLookup, Google Sign-In, and other third-party OAuth providers — now open in a proper popup window. The popup shares the same session as the originating tab so authentication cookies are preserved.

### Report Downloads (Excel, PDF, CSV)
- **Fixed:** Generating reports from web applications was failing because the download confirmation or preview popup was being blocked. Report downloads now work as expected.

### Downloads Tab UI
- **Improved:** The Downloads drawer now uses an Opera-inspired design with coloured file-type badges, file size and progress info, the source domain, and clearly labelled action buttons (Open, Show in folder, Pause/Resume, Cancel, Retry).

## Internal
- Extension manager refactored to support multiple Electron sessions simultaneously.
- Spell-check language lists applied to all workspace, WhatsApp, and main browser sessions.
