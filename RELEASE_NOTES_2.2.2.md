# InvictaTill Browser v2.2.2 — Patch Release

This release includes minor UI refinements and stability improvements for password autofill and popup window dimensions.

## Improvements

### Login Popups
- **Improved:** OAuth login popups and authentication windows now accurately respect custom dimensions (width/height) requested by the parent site, providing a more consistent sign-in experience.

### Password Autofill
- **Improved:** Increased the reliability of the password autofill mechanism on slow-loading websites by introducing a retry policy. The browser will now attempt to detect password fields multiple times as the page loads.

### WhatsApp Panel
- **Fixed:** Resolved visual glitches with the WhatsApp panel's resize handle to ensure smoother dragging interactions.
