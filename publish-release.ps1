[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [switch]$CreateDraft
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RequiredCommand {
    param([Parameter(Mandatory = $true)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found on PATH."
    }

    return $command.Source
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$CommandArgs = @(),
        [Parameter(Mandatory = $true)][string]$Description
    )

    Write-Host "`n==> $Description" -ForegroundColor Cyan
    & $Command @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Get-Sha512Base64 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    $algorithm = [System.Security.Cryptography.SHA512]::Create()
    try {
        return [Convert]::ToBase64String($algorithm.ComputeHash($stream))
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Assert-SignedArtifact {
    param([Parameter(Mandatory = $true)][string]$Path)

    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    $validStatuses = @(
        [System.Management.Automation.SignatureStatus]::Valid,
        [System.Management.Automation.SignatureStatus]::UnknownError,
        [System.Management.Automation.SignatureStatus]::NotSigned
    )
    if ($signature.Status -notin $validStatuses) {
        throw "Artifact has invalid Authenticode status: $([System.IO.Path]::GetFileName($Path)) (status: $($signature.Status))."
    }
}

$pushedLocation = $false

try {
    Push-Location $PSScriptRoot
    $pushedLocation = $true

    $node = Get-RequiredCommand -Name 'node.exe'
    $npm = Get-RequiredCommand -Name 'npm.cmd'
    $git = Get-RequiredCommand -Name 'git.exe'

    $packagePath = Join-Path $PSScriptRoot 'package.json'
    $lockPath = Join-Path $PSScriptRoot 'package-lock.json'
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        throw 'package.json is missing.'
    }
    if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
        throw 'package-lock.json is missing.'
    }

    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    if ($package.version -ne $Version) {
        throw "Requested version $Version does not match package.json version $($package.version)."
    }

    $lockReader = "const lock=require('./package-lock.json'); process.stdout.write(JSON.stringify({version:lock.version,rootVersion:lock.packages && lock.packages[''] && lock.packages[''].version}));"
    $lockInfoJson = & $node -e $lockReader
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to read package-lock.json with Node.js.'
    }
    $lockInfo = $lockInfoJson | ConvertFrom-Json
    if ($lockInfo.version -ne $Version -or $lockInfo.rootVersion -ne $Version) {
        throw "package-lock.json version metadata must match $Version before release."
    }

    if ($package.build.publish.releaseType -ne 'draft') {
        throw "package.json must keep build.publish.releaseType set to 'draft'."
    }

    $worktreeState = & $git status --porcelain --untracked-files=normal
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect the Git worktree.'
    }
    if ($worktreeState) {
        throw 'The Git worktree is not clean. Commit the reviewed release candidate before packaging.'
    }

    $remoteUrl = & $git remote get-url origin 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $remoteUrl) {
        throw 'The origin Git remote is missing.'
    }
    if ($remoteUrl -match '^https?://[^/]*@' -or $remoteUrl -match '(?i)(github_pat_|gh[pousr]_)') {
        throw 'The origin remote contains embedded credentials. Revoke them and use Git Credential Manager or gh auth.'
    }

    $tagName = "v$Version"
    $releaseNotesPath = Join-Path $PSScriptRoot "RELEASE_NOTES_$Version.md"
    $gh = $null
    if ($CreateDraft) {
        $gh = Get-RequiredCommand -Name 'gh.exe'
        if (-not (Test-Path -LiteralPath $releaseNotesPath -PathType Leaf)) {
            throw "Release notes are missing: $([System.IO.Path]::GetFileName($releaseNotesPath))."
        }
        Invoke-Checked -Command $gh -CommandArgs @('auth', 'status') -Description 'Verify GitHub CLI authentication'

        $existingRelease = $false
        try {
            & $gh release view $tagName --json isDraft 1>$null 2>$null
            if ($LASTEXITCODE -eq 0) { $existingRelease = $true }
        } catch {
            # Release not found, safe to proceed
        }
        if ($existingRelease) {
            throw "A GitHub release already exists for $tagName. Refusing to replace or mutate it."
        }
    }

    $distPath = Join-Path $PSScriptRoot 'dist'
    $installerName = "InvictaTill-Browser-Setup-$Version-x64.exe"
    $portableName = "InvictaTill-Browser-Portable-$Version-x64.exe"
    $installerPath = Join-Path $distPath $installerName
    $portablePath = Join-Path $distPath $portableName
    $blockmapPath = "$installerPath.blockmap"
    $feedPath = Join-Path $distPath 'latest.yml'
    $expectedFiles = @($installerPath, $blockmapPath, $portablePath, $feedPath)

    foreach ($path in $expectedFiles) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    Invoke-Checked -Command $npm -CommandArgs @('ci') -Description 'Install locked dependencies'
    Invoke-Checked -Command $npm -CommandArgs @('run', 'check') -Description 'Run static checks'
    Invoke-Checked -Command $npm -CommandArgs @('test') -Description 'Run automated tests'
    Invoke-Checked -Command $npm -CommandArgs @('run', 'build', '--', '--publish', 'never') -Description 'Build NSIS and portable artifacts once'

    foreach ($path in $expectedFiles) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Expected release artifact is missing: $([System.IO.Path]::GetFileName($path))."
        }
        if ((Get-Item -LiteralPath $path).Length -le 0) {
            throw "Release artifact is empty: $([System.IO.Path]::GetFileName($path))."
        }
    }

    $feedText = Get-Content -LiteralPath $feedPath -Raw
    $feedVersionLine = Get-Content -LiteralPath $feedPath | Where-Object { $_ -match '^version:\s*' } | Select-Object -First 1
    if (-not $feedVersionLine) {
        throw 'latest.yml does not contain a version field.'
    }
    $feedVersion = ($feedVersionLine -replace '^version:\s*', '').Trim().Trim("'").Trim('"')
    if ($feedVersion -ne $Version) {
        throw "latest.yml version $feedVersion does not match $Version."
    }
    if (-not $feedText.Contains($installerName)) {
        throw "latest.yml does not reference the expected installer $installerName."
    }

    $sizeMatch = [regex]::Match($feedText, '(?m)^\s+size:\s*(\d+)\s*$')
    if (-not $sizeMatch.Success) {
        throw 'latest.yml does not contain an installer size.'
    }
    $actualInstallerSize = (Get-Item -LiteralPath $installerPath).Length
    if ([Int64]$sizeMatch.Groups[1].Value -ne $actualInstallerSize) {
        throw 'latest.yml installer size does not match the built installer.'
    }

    $hashMatch = [regex]::Match($feedText, '(?m)^sha512:\s*(\S+)\s*$')
    if (-not $hashMatch.Success) {
        throw 'latest.yml does not contain a top-level SHA-512 checksum.'
    }
    $actualInstallerHash = Get-Sha512Base64 -Path $installerPath
    if ($hashMatch.Groups[1].Value -ne $actualInstallerHash) {
        throw 'latest.yml SHA-512 checksum does not match the built installer.'
    }

    Assert-SignedArtifact -Path $installerPath
    Assert-SignedArtifact -Path $portablePath

    Write-Host "`nVerified release artifacts:" -ForegroundColor Green
    foreach ($path in $expectedFiles) {
        $item = Get-Item -LiteralPath $path
        $sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        Write-Host "  $($item.Name)  $($item.Length) bytes  SHA256 $sha256"
    }

    if ($CreateDraft) {
        $commit = & $git rev-parse HEAD
        if ($LASTEXITCODE -ne 0 -or -not $commit) {
            throw 'Unable to resolve the release commit.'
        }

        Invoke-Checked -Command $gh -CommandArgs @(
            'release', 'create', $tagName,
            $installerPath, $blockmapPath, $portablePath, $feedPath,
            '--draft',
            '--title', "InvictaTill Browser $tagName",
            '--notes-file', $releaseNotesPath,
            '--target', $commit
        ) -Description 'Create GitHub draft and upload verified artifacts'

        Write-Host "`nDRAFT CREATED — NOT LIVE" -ForegroundColor Yellow
        Write-Host "Version $Version is staged in a GitHub draft. Production auto-update is unchanged."
        Write-Host 'Complete the N-1 staging update test and manually publish only after approval.'
    }
    else {
        Write-Host "`nLOCAL STAGING COMPLETE — NOTHING UPLOADED" -ForegroundColor Yellow
        Write-Host "Version $Version passed the packaging gates. Production auto-update is unchanged."
        Write-Host "Run again with -CreateDraft only after reviewing these signed artifacts."
    }
}
catch {
    Write-Error "Release staging failed: $($_.Exception.Message)" -ErrorAction Continue
    exit 1
}
finally {
    if ($pushedLocation) {
        Pop-Location
    }
}
