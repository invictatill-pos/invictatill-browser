# InvictaTill Browser — Staged Release Guide

This workflow builds and verifies a release candidate, optionally uploads it as a GitHub **draft**, and stops. A release becomes public only after a maintainer completes the update test and manually publishes the verified draft.

## 1. Credential incident response

The repository was found with a GitHub personal access token embedded in its local remote URL. Treat that token as compromised even if it was never committed.

1. Revoke the exposed token in GitHub immediately and review its recent use.
2. Replace the credential-bearing remote without printing or copying the old URL:

   ```powershell
   git remote set-url origin https://github.com/invictatill-pos/invictatill-browser.git
   ```

3. Authenticate with Git Credential Manager or GitHub CLI so credentials remain in the operating-system credential store:

   ```powershell
   gh auth login
   gh auth status
   ```

4. Inspect CI logs, terminal transcripts, backups, and local Git configuration for accidental copies. If a credential was committed, rotate it first, then coordinate a repository-history cleanup.

Never place access tokens in Git URLs, source files, package configuration, release scripts, or documentation. The release script uses the authenticated `gh` session and never accepts a token argument.

## 2. Release prerequisites

- A clean clone of the intended release commit with no uncommitted files.
- Node.js 22.12 or newer and the lockfile committed with the release.
- GitHub CLI installed only when creating the draft; `gh auth status` must succeed.
- A Windows code-signing identity configured through an approved secret store or CI signing service.
- Timestamped Authenticode signatures for the packaged application, NSIS installer, and portable executable.
- A disposable Windows 10/11 x64 VM for installation and update tests.
- A dedicated staging update feed or staging repository. GitHub draft releases are intentionally invisible to the production auto-updater.

Do not release from a long-lived developer checkout or from a machine whose dependency tree was installed with `npm install`.

## 3. Prepare and validate the candidate

1. Create a fresh clone or clean CI workspace and check out the exact candidate commit.
2. Confirm `git status --short` is empty and the remote URL contains no embedded credentials.
3. Align the release version in all sources before building:

   - `package.json` `version`
   - top-level and root-package versions in `package-lock.json`
   - in-app release notes and displayed version text
   - intended tag and release title
   - artifact names and update channel

4. Run the clean verification pipeline:

   ```powershell
   npm ci
   npm run check
   npm test
   npm run test:e2e
   ```

   The release is blocked if any command fails or if the E2E release suite is unavailable. E2E coverage must include startup, tabs and session restore, navigation, downloads, permissions, private windows, find/mute/zoom, screenshot, print/PDF, split view, AI local/cloud error paths, and opt-in privacy behavior.

The release script repeats `npm ci`, `npm run check`, and `npm test` as its own clean packaging gate. It executes each once and performs a single combined NSIS/portable build. E2E tests remain a separate precondition because they require the disposable desktop environment.

## 4. Build a local staging candidate

From the clean release checkout:

```powershell
.\publish-release.ps1 -Version 2.0.0
```

The script:

1. Rejects a version that differs from `package.json` or `package-lock.json`.
2. Rejects a dirty worktree or a credential-bearing Git remote.
3. Runs `npm ci`, `npm run check`, and `npm test` once.
4. Runs `npm run build` once, producing both Windows targets.
5. Requires these exact files:

   - `dist/InvictaTill-Browser-Setup-<version>-x64.exe`
   - `dist/InvictaTill-Browser-Setup-<version>-x64.exe.blockmap`
   - `dist/InvictaTill-Browser-Portable-<version>-x64.exe`
   - `dist/latest.yml`

6. Validates the feed version, installer filename, byte size, SHA-512 checksum, and Authenticode signatures.

Without `-CreateDraft`, nothing is uploaded and existing users are unaffected.

## 5. Create a GitHub draft

After local verification succeeds:

```powershell
gh auth status
.\publish-release.ps1 -Version 2.0.0 -CreateDraft
```

The command creates a new draft release and uploads the already verified installer, blockmap, portable executable, and `latest.yml`. It does not create a public release. It fails if GitHub CLI is missing, authentication is invalid, or a release for that version already exists.

Download the draft assets on a separate machine and repeat signature, hash, install, launch, uninstall, and malware-scanning checks. Confirm the draft contains artifacts from one build only; never combine an installer with `latest.yml` from another build.

## 6. Test N-1 to N updating

Because GitHub drafts cannot be seen by the production updater, copy the exact signed draft artifacts to the dedicated staging feed or staging repository. Do not point production clients at it.

On a snapshot-backed VM:

1. Install the current public N-1 build and create representative history, settings, tasks, bookmarks, and restored tabs.
2. Point only the test build/profile at the staging update channel.
3. Check for N, download it, restart, and confirm the signed installer is applied.
4. Verify the reported application version, preserved regular-profile data, private-session cleanup, and update UI.
5. Test offline, interrupted download, corrupt-feed/checksum rejection, proxy, standard-user installation, and rollback instructions.
6. Compare `dist/latest.yml` against the staged installer again after upload.

Record the commit, version, artifact hashes, signature identity/timestamp, VM results, and reviewer approval in the draft notes.

## 7. Manually publish and synchronize

Only a maintainer may publish the verified GitHub draft through the GitHub release UI. Before selecting **Publish release**, confirm:

- The draft tag and title match the verified version.
- The tag resolves to the reviewed release commit.
- All required checks and N-1 update tests passed.
- Every public artifact is signed and its hash matches the recorded build.
- `latest.yml` names and hashes the uploaded installer exactly.
- Release notes disclose user-visible behavior and privacy changes.

After the GitHub release is public, synchronize the website. Update its displayed version, direct-download files, links, checksums, and copied update metadata from the same verified build. Download the website artifact once and confirm its file version and hash. Never update the website before the release is public.

Finally, test the public N-1 to N update once more from a clean VM and retain the previous signed release for rollback. Do not reuse a version number or replace assets on an already published release.
