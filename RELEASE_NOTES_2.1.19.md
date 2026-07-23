# InvictaTill Browser 2.1.19

InvictaTill Browser 2.1.19 introduces real-time inline InvictaTill AI writing and grammar assistance, privacy exclusions for sensitive input fields, and toolbar AI button consolidation.

## Live InvictaTill AI Writing & Grammar Assistant

- Added real-time inline spelling, grammar, and sentence writing suggestions powered directly by InvictaTill AI.
- Displays a floating Shadow DOM suggestion chip (`[data-invicta-writing-assistant]`) over active text fields.
- One-click **Apply** replaces text in-place with proper grammar, spelling, and phrasing.
- One-click **Dismiss** closes suggestions for the current input.

## Privacy & Security Safeguards

- Sensitive field exclusion: Writing assistance automatically ignores passwords, passcodes, credit card numbers, CVVs, and search inputs.
- Private window isolation: In-page writing suggestions are completely disabled inside private browsing windows.
- Origin verification: Enforces `isTrusted` user input event validation and origin checking (`trustedWritingSender`).

## Toolbar Consolidation

- Removed the legacy duplicate top-toolbar AI button (`#btn-ai-drawer`), consolidating AI access onto the primary left side app-rail (`#btn-invicta-ai`).
