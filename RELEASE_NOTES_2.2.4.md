# InvictaTill Browser v2.2.4 — Extension Stability & Security Update

This update resolves a bug where browser extensions wouldn't load into tabs that were automatically restored when reopening the browser, and tightens security around extension extraction.

## Fixes & Improvements

### Extensions
- **Fixed:** Extensions now properly inject into tabs that are restored from a previous session on startup. Previously, these restored tabs were missing their extensions because their isolated sessions were created before the extension subsystem was fully initialized.
- **Security:** Added strict path traversal validations when extracting downloaded extension archives to prevent malicious ZIP files from writing outside the designated extensions directory.
