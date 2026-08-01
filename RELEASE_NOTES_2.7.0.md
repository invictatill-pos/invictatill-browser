# InvictaTill Browser 2.7.0

## New Feature

### HTTP Basic Authentication Support
The browser now correctly handles HTTP Basic Authentication challenges (WWW-Authenticate: Basic). Previously, the browser would immediately reject the 401 response and show the server's raw error page. Now:

- A native in-app **"Sign in"** dialog appears showing the host name and authentication realm
- Users can enter their Username and Password and click **Sign in** to authenticate
- Clicking **Cancel** sends an empty response so the page loads without credentials
- Auth requests automatically expire after 5 minutes if the dialog is ignored
- Works for all tabs and sessions, including proxied connections

### Implementation
- `app.on('login')` in the main process intercepts all 401 challenges before Electron auto-cancels them
- Credentials are relayed securely over the existing IPC bridge (`respond-http-auth`)
- The dialog is implemented as a fully styled in-app modal (no native OS dialog dependency)
