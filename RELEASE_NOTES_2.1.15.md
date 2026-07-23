# InvictaTill Browser 2.1.15

InvictaTill Browser 2.1.15 improves tab strip responsiveness, adding dynamic auto-scaling and container query support for dense workloads with many open tabs.

## Dynamic tab strip auto-scaling

- Open tabs now shrink dynamically to fit the available window width without horizontal overflow.
- Added `@container` query responsive styling for tab elements (`.tab-title`, state indicators, favicons, and close buttons).
- Tab titles and indicators hide cleanly when tabs shrink, keeping close buttons accessible even in compact views.
- Fixed tab strip layout containment when opening numerous browser tabs across active workspaces.

## Quality

- Added DOM contract test coverage for tab container width flex and container queries.
- Added Electron E2E smoke test verification for dense tab strip auto-scaling.
