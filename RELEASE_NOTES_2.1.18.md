# InvictaTill Browser 2.1.18

InvictaTill Browser 2.1.18 integrates InvictaTill AI directly into the left side app-rail and upgrades the AI composer UI with glassmorphism card styling.

## Left App Rail InvictaTill AI Integration

- Integrated InvictaTill AI directly into the left side app-rail (`#btn-invicta-ai`).
- Opening InvictaTill AI expands the shared left panel attached directly to the app-rail.
- Shifts the browser stage smoothly on desktop and overlays cleanly on smaller viewports.
- Configured mutual exclusivity between WhatsApp Web and InvictaTill AI side-panels for uncluttered workspace multitasking.
- Synchronized active rail button states (`aria-expanded="true"`, `.active`).

## Glassmorphism AI Composer UI

- Redesigned quick action cards into a responsive 2-column grid (`.quick-actions`, `.chip-button`, `.chip-button.wide`).
- Added subtle micro-animations and hover transitions for quick prompt chips.
- Added glassmorphism composer container (`.ai-composer`) and rounded bubble styling.

## Quality & Tests

- Updated DOM contract tests for `#btn-invicta-ai` app-rail button and accessibility attributes.
- Updated Electron E2E smoke tests for left panel attachment geometry, viewport stage shifting, and rail button interactions.
