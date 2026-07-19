# InvictaTill Browser — Release & Auto-Update Guide

## One-Time Setup (Do This First)

### 1. Create a GitHub Repository

1. Go to https://github.com/new
2. Repository name: **`invictatill-browser`**
3. Set it to **Public** (required for free auto-updates)
4. Do NOT initialize with README (you already have one)
5. Click **Create repository**

### 2. Update Your GitHub Username in the Project

Open `package.json` and replace `YOUR_GITHUB_USERNAME` with your actual GitHub username in the publish block.

Also update the two download links in `invictatill-website/index.html` — search for `YOUR_GITHUB_USERNAME` and replace (2 occurrences).

### 3. Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
2. Generate a new token with "Contents" permission → Read and Write
3. Copy the token

### 4. Set the Token as Environment Variable

```powershell
$env:GH_TOKEN = "github_pat_YOUR_TOKEN_HERE"
```

Or add it permanently in Windows: System → Environment Variables → New → GH_TOKEN = your token

### 5. Push Code to GitHub

```powershell
git init
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/invictatill-browser.git
git add .
git commit -m "Initial release v1.1.0"
git push -u origin main
```

---

## Publishing a New Version (Every Release)

### Step 1 — Bump the Version in package.json
### Step 2 — Build: `npm run build:installer`
### Step 3 — Publish to GitHub Releases:

```powershell
$env:GH_TOKEN = "your_token_here"
npx electron-builder --win nsis --publish=always
```

This auto-creates a GitHub Release with the .exe, .blockmap, and latest.yml uploaded.

### Step 4 — Update the website download link version number
### Step 5 — Push website: `git add index.html && git commit -m "v1.x.x" && git push`

---

## Auto-Update Flow for Existing Users

App launches → 8 sec later checks GitHub latest.yml → if newer version: background download starts → on close/restart: auto-installs.

Users NEVER need to re-download from the website.

---

## Current Release State

| Item | Status |
|---|---|
| Version | 1.1.0 |
| Installer | dist/InvictaTill Browser Setup 1.1.0.exe |
| Auto-update code | Already in main.js |
| GitHub provider | Configured in package.json |
| GitHub repo | Needs to be created |
| GH_TOKEN | Needs to be set |
