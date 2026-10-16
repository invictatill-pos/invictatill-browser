# InvictaTill Browser 2.8.4

Fixes the search problem shown in the Skolaro editor recording and strengthens password, permission, extension, and runtime security.

- Ctrl+F lets web editors handle their own search. The browser menu also provides an explicit **Find in page** action.
- Browser search starts a new search correctly and displays match counts instead of remaining at 0/0. Search results stay with their tab or split pane.
- Saved passwords match the exact scheme, hostname, and port, and the password manager shows that address. HTTPS credentials cannot autofill on HTTP or a different origin.
- Legacy passwords migrate conservatively to HTTPS. Save the login again at its correct address if an old HTTP or `www` entry no longer autofills.
- Proxy authentication never reuses or saves a website credential. Manual autofill checks the document origin again before inserting a password.
- WhatsApp requests camera and microphone permission instead of silently preauthorizing them.
- Extension installs reject unsafe IDs, archive paths, links, malformed ZIP data, invalid checksums, and excessive file expansion. Downloads enforce HTTPS redirects and size limits. Failed installations restore the previous version; concurrent installs are serialized.
- Updates Electron from 43.7.7 to 43.8.0 and patches supporting dependencies. Production dependency auditing reports zero findings; eight moderate findings remain in development packaging dependencies.

Validation passed syntax checks, all 75 automated tests, the Electron smoke suite, report/export workflows, and native split/fullscreen layout tests. Search coverage includes editor shortcuts, embedded frames, both split panes, next/previous matches, and no-results handling. The packaged source, Electron security fuses, installer metadata hashes, and blockmap were also verified.

This release is distributed without a publicly trusted Authenticode signature. Windows may display an **Unknown publisher** or Microsoft Defender SmartScreen warning. Download only from the official InvictaTill Browser GitHub release page.
