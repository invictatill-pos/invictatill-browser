# =====================================================
# InvictaTill Browser — GitHub Release Publisher
# Usage: .\publish-release.ps1
# Set GH_TOKEN env var before running!
# =====================================================

param(
    [string]$Version = ""
)

# Read version from package.json
$pkg = Get-Content "package.json" | ConvertFrom-Json
$Version = $pkg.version
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  InvictaTill Browser Release Tool" -ForegroundColor Cyan
Write-Host "  Version: v$Version" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check GH_TOKEN
if (-not $env:GH_TOKEN) {
    Write-Host "ERROR: GH_TOKEN environment variable is not set!" -ForegroundColor Red
    Write-Host "Get one from: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "Then run: `$env:GH_TOKEN = 'your_token_here'" -ForegroundColor Yellow
    exit 1
}

# Build installer
Write-Host "Building installer for v$Version..." -ForegroundColor Green
npm run build:installer
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Publish to GitHub Releases (invictatill-pos/invictatill-website)
Write-Host ""
Write-Host "Publishing to GitHub Releases..." -ForegroundColor Green
npx electron-builder --win nsis --publish=always
if ($LASTEXITCODE -ne 0) {
    Write-Host "Publish failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  DONE! Release v$Version is LIVE!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Release URL:" -ForegroundColor Cyan
Write-Host "  https://github.com/invictatill-pos/invictatill-website/releases/tag/v$Version" -ForegroundColor White
Write-Host ""
Write-Host "Download URL:" -ForegroundColor Cyan
Write-Host "  https://github.com/invictatill-pos/invictatill-website/releases/latest/download/InvictaTill%20Browser%20Setup%20$Version.exe" -ForegroundColor White
Write-Host ""
Write-Host "Existing users will auto-update on next app launch." -ForegroundColor Yellow
