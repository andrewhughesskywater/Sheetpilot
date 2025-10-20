# Sheetpilot Release Preparation Script
# This script prepares files for GitHub release upload

param(
    [Parameter(Mandatory=$false)]
    [string]$Version
)

# Get version from package.json if not provided
if (-not $Version) {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $Version = $packageJson.version
}

Write-Host "Preparing release for Sheetpilot v$Version" -ForegroundColor Green

# Check if build directory exists
if (-not (Test-Path "build")) {
    Write-Host "Error: build directory not found. Run 'npm run build' first." -ForegroundColor Red
    exit 1
}

# Check required files
$requiredFiles = @(
    "build/Sheetpilot-Setup.exe",
    "build/Sheetpilot-Setup.exe.blockmap",
    "build/latest.yml"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Error: Missing required files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "`nRun 'npm run build' to generate these files." -ForegroundColor Yellow
    exit 1
}

# Create release directory
$releaseDir = "build/release-v$Version"
if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir | Out-Null

# Copy files to release directory
Write-Host "`nCopying release files..." -ForegroundColor Cyan
Copy-Item "build/Sheetpilot-Setup.exe" "$releaseDir/" -Verbose
Copy-Item "build/Sheetpilot-Setup.exe.blockmap" "$releaseDir/" -Verbose
Copy-Item "build/latest.yml" "$releaseDir/" -Verbose

# Display file information
Write-Host "`nRelease files prepared:" -ForegroundColor Green
Get-ChildItem $releaseDir | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name) ($size MB)" -ForegroundColor White
}

# Read and display latest.yml
Write-Host "`nUpdate metadata (latest.yml):" -ForegroundColor Cyan
Get-Content "$releaseDir/latest.yml" | Write-Host -ForegroundColor Gray

# Generate release notes template
$releaseNotesPath = "$releaseDir/RELEASE_NOTES.md"
$releaseNotes = @"
# Sheetpilot v$Version

## Changes

- [Add your changes here]

## Installation

Download and run ``Sheetpilot-Setup.exe`` to install or update.

## Auto-Update

Existing users will receive this update automatically when they launch the application.

## Files

- ``Sheetpilot-Setup.exe`` - Windows installer
- ``Sheetpilot-Setup.exe.blockmap`` - Delta update support
- ``latest.yml`` - Update metadata

## Checksums

SHA512: ``[Will be displayed after upload]``

---

**Full Changelog**: https://github.com/andrewhughesskywater/Sheetpilot/compare/v[previous]...v$Version
"@

Set-Content -Path $releaseNotesPath -Value $releaseNotes
Write-Host "`nRelease notes template created: $releaseNotesPath" -ForegroundColor Green

# Instructions
Write-Host "`n" + ("=" * 80) -ForegroundColor Yellow
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ("=" * 80) -ForegroundColor Yellow
Write-Host "`n1. Go to: https://github.com/andrewhughesskywater/Sheetpilot/releases/new" -ForegroundColor White
Write-Host "`n2. Create tag: v$Version" -ForegroundColor White
Write-Host "`n3. Upload these files from ${releaseDir}:" -ForegroundColor White
Write-Host "   - Sheetpilot-Setup.exe" -ForegroundColor Cyan
Write-Host "   - Sheetpilot-Setup.exe.blockmap" -ForegroundColor Cyan
Write-Host "   - latest.yml" -ForegroundColor Cyan
Write-Host "`n4. Copy release notes from: $releaseNotesPath" -ForegroundColor White
Write-Host "`n5. Click 'Publish release'" -ForegroundColor White
Write-Host "`n" + ("=" * 80) -ForegroundColor Yellow

# Open release directory
Write-Host "`nOpening release directory..." -ForegroundColor Green
Invoke-Item $releaseDir

