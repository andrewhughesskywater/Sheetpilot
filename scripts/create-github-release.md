# Creating GitHub Release for Auto-Updates

## Overview

Sheetpilot uses GitHub Releases for automatic updates. When you build and publish a new version, you need to create a GitHub release and upload the installer.

## Steps to Create a Release

### 1. Build the Application

```bash
npm run build
```

This creates the installer in `build/Sheetpilot-Setup.exe` and `build/latest.yml`.

### 2. Create a GitHub Release

1. Go to https://github.com/andrewhughesskywater/Sheetpilot/releases/new
2. Click "Choose a tag" and type `v1.0.1` (or your current version)
3. Click "Create new tag: v1.0.1 on publish"
4. Set the release title to `v1.0.1` or `Sheetpilot v1.0.1`
5. Add release notes describing changes (optional but recommended)
6. Upload the following files from the `build/` directory:
   - `Sheetpilot-Setup.exe` (the installer)
   - `Sheetpilot-Setup.exe.blockmap` (required for delta updates)
   - `latest.yml` (update metadata)
7. Click "Publish release"

### 3. Verify Auto-Update Configuration

The `package.json` is now configured for GitHub releases:

```json
"publish": {
  "provider": "github",
  "owner": "andrewhughesskywater",
  "repo": "Sheetpilot"
}
```

### 4. How Auto-Updates Work

1. When users launch Sheetpilot, it checks `https://api.github.com/repos/andrewhughesskywater/Sheetpilot/releases/latest`
2. If a newer version is found, it downloads `Sheetpilot-Setup.exe` from the release
3. The update installs automatically when the user closes the application
4. electron-updater uses `latest.yml` for version comparison and file verification

## Testing Auto-Updates

### Manual Test

1. Install version 1.0.0 (or older)
2. Create a GitHub release for version 1.0.1
3. Launch the installed application
4. Check logs for update messages: `%APPDATA%\sheetpilot\*.log`
5. Look for: "Update available", "Download progress", "Update downloaded"

### Automated Test

Run the auto-updater tests:

```bash
npm test -- __tests__/auto-updater.spec.ts
```

## Important Notes

- **Public vs Private Repositories**: 
  - Public repos: auto-updates work immediately
  - Private repos: requires GitHub token configuration
  
- **Version Format**: Must follow semver (e.g., `1.0.1`, `2.0.0-beta.1`)

- **File Names**: electron-builder automatically generates correct file names
  - Installer: `${productName}-Setup.${ext}` → `Sheetpilot-Setup.exe`
  - Metadata: `latest.yml`
  - Blockmap: `Sheetpilot-Setup.exe.blockmap`

- **Delta Updates**: The `.blockmap` file enables delta updates (downloading only changed parts)

## Troubleshooting

### Updates Not Detected

1. Check version in `package.json` is newer than installed version
2. Verify GitHub release is published (not draft)
3. Check application logs for error messages
4. Ensure files are uploaded to the release correctly

### Download Errors

1. Verify `Sheetpilot-Setup.exe` is accessible from the release
2. Check file size matches `latest.yml`
3. Verify SHA512 hash matches

### For Private Repositories

Add GitHub token to electron-builder configuration:

```json
"publish": {
  "provider": "github",
  "owner": "andrewhughesskywater",
  "repo": "Sheetpilot",
  "token": "${GH_TOKEN}"
}
```

Set environment variable before building:
```bash
$env:GH_TOKEN="your_github_personal_access_token"
npm run build
```

## Quick Command Reference

```bash
# Build application
npm run build

# Test auto-updater
npm test -- __tests__/auto-updater.spec.ts

# Find latest log file
dir $env:APPDATA\sheetpilot\*.log | sort LastWriteTime -Descending | select -First 1
```

