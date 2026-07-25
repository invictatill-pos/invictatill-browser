# InvictaTill Browser v2.2.3 — UI & Compatibility Polish

This release introduces dynamic zooming for the WhatsApp panel, better handling for report downloads, and a fix for the extension store UI.

## Improvements

### WhatsApp Panel
- **New:** The WhatsApp panel now dynamically scales (zooms) its content when you resize the panel to ensure it always fits comfortably. 
- **Improved:** The minimum width of the WhatsApp panel has been increased from 380px to 420px to prevent visual clipping of chats.

### Export & Download Popups
- **Fixed:** Clicking on export or report generation links (like CSVs, PDFs, Excel sheets) that attempt to open in a new window are now cleanly handled as small popup windows, ensuring the downloads trigger correctly without being blocked.

### Extension Store
- **Fixed:** The Extension Store modal's height and layering (z-index) have been adjusted so it no longer overlaps with the main browser toolbar or gets clipped on smaller screens.
