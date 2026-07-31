# InvictaTill Browser 2.6.4

## What's New

### Download Manager Redesign

The downloads side-panel has been completely redesigned with a rich, Opera-inspired UI:

- **Colour-coded file type badges** — each download card now shows a coloured extension badge based on file type:
  - Green — Images (PNG, JPG, GIF, WebP, SVG)
  - Red — PDF documents
  - Cyan — Spreadsheets (XLS, XLSX, CSV)
  - Blue — Word documents (DOC, DOCX, TXT)
  - Orange — Presentations (PPT, PPTX)
  - Purple — Archives (ZIP, RAR, 7Z)
  - Amber — Executables and scripts (EXE, MSI, BAT) with warning chip
  - Violet — Videos (MP4, MKV, AVI)
  - Pink — Audio (MP3, WAV, FLAC)

- **Animated progress bar** — active downloads show a shimmering cyan/green gradient progress bar (upgraded from 3px to 5px)

- **Rich download status** — active items now show live download speed and ETA (e.g. Downloading 47% - 1.2 MB of 2.6 MB - 580 KB/s - 2m left)

- **Danger file warning chip** — executable files display a prominent amber warning pill under the file name

- **File missing state** — when a downloaded file has been deleted from disk, the Open button is greyed out with a tooltip

- **Left-anchored action buttons** — Open / Folder / Link / Remove buttons align cleanly under the file icon column

- **Bolder accent stripes** — the coloured left-side border stripe is now 3px on all card states

- **FILES AND TRANSFERS subtitle** — the panel eyebrow displays in uppercase letter-spaced style

- **Improved card hover effects** — subtle brightness lift on hover for all card states

## Bug Fixes

- Removed two duplicate JS functions (downloadMetaText and renderDownloadPopout) that were silently shadowing each other
- Fixed data-danger attribute not being set on download cards in the popout panel

## Internal

- renderer.js and style.css: download panel refactored and polished
