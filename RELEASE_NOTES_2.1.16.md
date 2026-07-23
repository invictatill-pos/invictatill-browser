# InvictaTill Browser 2.1.16

InvictaTill Browser 2.1.16 adds native password manager & autofill, dismissible background downloads, direct InvictaTill AI writing assistance, and isolated remote page preloads.

## Password Manager & Autofill

- Added secure, encrypted password save and update prompts for web logins.
- Added cross-workspace password autofill popups with origin validation.
- Password submission detection uses an isolated page script (`remote-preload.js`) without exposing privileged main-process bridges.
- Saved credentials stay encrypted via OS-level Windows `safeStorage` boundaries.

## Background Downloads

- Added a dismissible background download progress popout.
- Displays live download state, speed, filename, and progress.
- Dismissing the download popout keeps the file downloading seamlessly in the background without reopening popups.

## InvictaTill AI Writing Assistant

- Added native inline writing and text rewrite assistant capabilities powered directly by InvictaTill AI.
- Updated AI drawer chat experience to focus purely on native InvictaTill AI intelligence.

## Security & Architecture

- Added `remote-preload.js` to package build files and security suite assertions.
- Enhanced origin verification for page credential prompts and writing script replacements.
