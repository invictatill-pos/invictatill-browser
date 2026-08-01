# InvictaTill Browser 2.6.6

## Bug Fixes

### Download Panel — Fixed on Websites + Non-Movable

- **Download panel now works correctly on all tabs** — When opening the download panel while browsing any website, the native BrowserView is now correctly pushed aside so the full download panel is visible. Root cause of the previous failure: the right-offset calculation used `panelWidth + 8px` as the margin, but the panel's CSS positions it at `right: 16px`, so the BrowserView was still overlapping the panel's left edge by 8px. Fixed by computing the offset as `windowWidth − panelLeft + 8px`, which correctly accounts for the 16px CSS gap and adds a clear buffer.

- **Saved drag position cleared** — If users had previously dragged the download panel to a different position, the browser stored that position in localStorage and restored it on every launch, causing the panel to appear in unexpected locations and break the right-offset layout calculation. The saved position is now cleared and the panel always opens at its default top-right position.

- **Download panel is now non-movable** — Removed drag-to-move functionality from the download panel header. The panel is always anchored below the toolbar in the top-right corner. Also removed the resize handle (`resize: both`) so the panel has a clean, consistent fixed size.

## Internal

- Removed `initDownloadDrag` IIFE (~55 lines of drag logic)
- Removed `cursor: grab / grabbing` from `.download-popout-header`
- Removed `resize: both`, `min-width`, `min-height` from `.download-popout`
- Updated right-offset formula in `updateViewLayout()` to use `window.innerWidth - rect.left + 8` for precise BrowserView placement
