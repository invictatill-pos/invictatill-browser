# InvictaTill Browser 2.1.17

InvictaTill Browser 2.1.17 introduces an Opera-style persistent WhatsApp Web side-panel, custom Chrome compatibility user-agent masking, and automatic InvictaTill AI cloud recovery.

## Persistent WhatsApp Web Side-Panel

- Added an Opera-style side-rail WhatsApp panel (`#whatsapp-panel`).
- Uses a dedicated, sandboxed session partition (`persist:invictatill-whatsapp`).
- Configured clean Chrome compatibility user-agent masking to eliminate "unsupported browser" warnings on WhatsApp Web.
- Retains WhatsApp login session across workspace switches and window resizes.
- Added 1-click panel popout into full browser tab.

## InvictaTill AI Cloud Recovery & Robustness

- Added automatic cloud fallback for InvictaTill AI when local model endpoints are offline.
- Real-time provider badges dynamically indicate active mode (`InvictaTill AI · Local` / `InvictaTill AI · Cloud`).
- Added automated AI connection testing and settings recovery.

## Quality & Security

- Added unit test coverage for WhatsApp surface isolation and Chrome user-agent string formatting.
- Added Electron E2E smoke tests for WhatsApp side-panel geometry, multi-workspace retention, and popout functionality.
