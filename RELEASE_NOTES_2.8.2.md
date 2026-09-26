# InvictaTill Browser 2.8.2

Report exports opened in a new tab now preserve the original request instead of being recreated as a plain GET. This fixes a browser-side cause of reports returning to a listing page, losing filters, or failing to download.

- Preserves POST form fields, multipart submissions, cookies, referrer policy, opener relationships, and session storage when Chromium creates a report tab.
- Supports generated `about:blank` report documents, named-window reuse, and pages that close their own temporary tabs.
- Lets the server response determine whether a URL is a page or a download; words such as `report` and `export` no longer force a download.
- Removes unused download tabs after Chromium hands the file to the download manager and restores the source tab.
- Retries downloads with the originating workspace or WhatsApp session. Form-based exports explain when a fresh submission is required, and interrupted downloads restore as stopped after a restart.
- Keeps HTML fullscreen content at full-window size in either split pane and restores both panes when exiting fullscreen.
- Clears split view when switching workspaces and prevents a second pane from displaying another workspace's tab.

Validation uses isolated browser profiles and local report fixtures, including POST exports, HTML previews, popup nesting, downloads, fullscreen, and workspace isolation. The signed-in Skolaro production workflow still requires confirmation in the updated app.

This release is distributed without a publicly trusted Authenticode signature. Windows may show **Unknown publisher** or a Microsoft Defender SmartScreen warning during download or installation. Download only from the official InvictaTill Browser GitHub release page.
