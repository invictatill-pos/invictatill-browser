# InvictaTill Browser 2.1.13

InvictaTill Browser 2.1.13 restores reliable internal updates and adds visible, actionable update status throughout the installed browser.

## Improvements

- Added a complete Browser Updates card in Settings with current, checking, downloading, ready, installing, disabled, and error states.
- Added a manual **Check for updates** action and a working **Restart & Install** action.
- Added clear guidance for portable builds, which use manual updates instead of the installed-build updater.
- Added a release-feed verifier for the installer, installer blockmap, portable executable, and `latest.yml`.

## Fixes

- Fixed updater success, current-version, failure, and installation events not reaching the renderer.
- Fixed the Settings installation button not being connected to the updater.
- Fixed update errors being allowlisted in preload but never displayed to the user.
- Fixed packaged builds omitting the separated updater controller.
- Added friendly messages for missing release metadata, offline/network failures, and integrity errors.
- Strengthened the draft-release gate so every required update asset is verified after upload.

## Release requirement

The Setup executable, its `.blockmap`, and `latest.yml` must be published together. The portable executable remains a manual-download option. All production executables must have valid Authenticode signatures before release.
