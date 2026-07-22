# InvictaTill Browser 2.1.14

InvictaTill Browser 2.1.14 improves workspace continuity and adds standard tab-management and work-from-home productivity features.

## Workspace continuity

- Every workspace now remembers its own last active tab.
- Switching Default → Work → Default → Work returns to the tab last used in each workspace instead of the first tab.
- Last-active tabs survive browser restarts through validated session metadata.
- Closed remembered tabs fall back safely to the nearest remaining tab.
- Ctrl+Tab now stays inside the current workspace.
- Reopened tabs return to their original workspace when it still exists.

## Browser features

- Added searchable tabs and browser commands with `Ctrl+Shift+A`.
- Tab search works across every workspace and can jump directly to a result.
- Added pinned tabs with compact presentation and persistent ordering.
- Added Pin/Unpin, Copy page link, and Close other tabs actions.
- Added one-command access to history, downloads, settings, screenshots, printing, private browsing, and WFH tools.

## Work-from-home features

- Added persistent 25, 50, and 90-minute focus sessions.
- Added pause, resume, end-session, and five-minute recovery-break controls.
- Added a compact title-bar countdown that reopens the Focus panel.
- Added native completion notifications and daily focus session/minute statistics.
- Added one-click Google Meet, Calendar, Gmail, and Microsoft Teams launchers.

## Quality

- Added deterministic workspace-memory and focus-controller unit tests.
- Added live Electron regression coverage for workspace restoration, pinning, command search, focus controls, screen sharing, accessibility, and responsive geometry.
