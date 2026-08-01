# InvictaTill Browser 2.6.5

## Bug Fixes

### Download Panel & Extension Store — Fixed on Loaded Websites

- **Download panel now appears correctly on all tabs** — Previously, opening the download panel while a website was active would show the old-style overlay instead of the new rich download manager. Root cause: the native BrowserView layer was not pushed aside on the first render tick because `getBoundingClientRect()` returns `0` before the browser reflows a newly-shown element. Fixed by using a safe 440px fallback width so the BrowserView is immediately repositioned whenever the download panel opens.

- **Extension Store now opens correctly on all tabs** — Previously, opening the Extension Store while browsing a website would show the modal behind the active web page (invisible). Root cause: `openExtensionStore()` did not set `state.modalOpen = true` or call `scheduleLayout()`, so the native BrowserView was never hidden. Fixed by wiring the Extension Store into the same modal management mechanism used by the command palette, site info, update, and password modals — the BrowserView now correctly hides when the store opens and reappears when it is closed.

## Notes

- No new features in this release — purely a bug-fix patch.
- The new download manager UI introduced in 2.6.4 is unchanged.
