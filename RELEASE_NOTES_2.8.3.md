# InvictaTill Browser 2.8.3

Lookup and other website password prompts now stay in the tab that requested them. You can switch to another tab and keep working while the sign-in request waits.

- Switch tabs with the mouse or Ctrl+Tab while a website password prompt is open. The address bar follows the selected tab.
- Return to the requesting tab with the username and password you already typed preserved.
- Keep separate sign-in prompts in their own tabs when several sites ask for credentials at once.
- Keep the other split pane usable, with the password prompt confined to the requesting pane even when the browser menu is open.
- Clear pending prompts when their tab closes or navigates away, without interrupting another tab's sign-in request.
- Cancel a password prompt without retrying the sign-in or reopening the prompt.
- Update the bundled Electron runtime and supporting dependencies with security fixes.

Validation passed syntax checks, all 51 automated tests, and the Electron end-to-end smoke suite. The smoke suite checks mouse and keyboard tab switching, address-bar updates, preserved credentials, concurrent prompts, cancellation, tab closure, split-pane bounds, and existing secure password saving and reuse.

This release is distributed without a publicly trusted Authenticode signature. Windows may show **Unknown publisher** or a Microsoft Defender SmartScreen warning during download or installation. Download only from the official InvictaTill Browser GitHub release page.
