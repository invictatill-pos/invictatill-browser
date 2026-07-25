# InvictaTill Browser v2.2.6 — Extension Security & Reliability Update

This update introduces better safety constraints and reliability features for the Extension Store backend.

## Fixes & Improvements

### Extension Subsystem
- **Security:** Added strict size limits for downloaded extensions (`MAX_CRX_SIZE`, `MAX_UNCOMPRESSED_SIZE`, and `MAX_UNPACKED_SIZE`) to prevent malicious or malformed extensions from exhausting disk space.
- **Reliability:** Extension downloads now have a 30-second network timeout to prevent infinite hanging when the Chrome Web Store is unresponsive.
- **Reliability:** Saving the internal extension registry is now an atomic file operation to prevent data corruption during unexpected power loss or crashes.
