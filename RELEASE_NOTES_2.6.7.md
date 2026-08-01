# InvictaTill Browser 2.6.7

## Critical Hotfix

### CSS Regression — Full Browser Styling Restored

A critical CSS parsing error introduced in v2.6.6 broke the entire browser UI styling. The closing brace `}` of the `.download-popout-header` CSS rule was accidentally omitted during the drag-removal edit, causing all subsequent CSS rules to be ignored by the browser engine — destroying fonts, colours, layouts, and all visual styling throughout the browser.

**Fix:** The missing closing brace has been restored. All browser styling is back to normal.

## Notes

- No functional changes beyond the CSS fix.
- The download panel bugfixes from v2.6.6 (fixed on websites, non-movable) remain in place.
