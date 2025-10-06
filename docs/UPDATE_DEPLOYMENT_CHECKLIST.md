# Update Deployment Checklist

## Pre-Deployment

- [ ] Update version in `package.json` (e.g., 1.0.0 → 1.0.1)
- [ ] Test all changes locally
- [ ] Update changelog/release notes if applicable
- [ ] Commit all changes to version control

## Build Process

```bash
# 1. Clean previous builds
npm run clean

# 2. Install dependencies (if needed)
npm install
cd renderer && npm install && cd ..
cd backend/bot && npm install && cd ../..

# 3. Build the application
npm run build
```

## Verify Build

- [ ] Check `release/` directory contains new installer
- [ ] Verify `latest.yml` is present
- [ ] Confirm version number in filename matches `package.json`

## Deploy to Network Drive

```bash
# Example PowerShell commands (adjust paths as needed)
$networkPath = "\\SERVER\Share\sheetpilot-updates"
$version = "1.0.1"

Copy-Item "release\Sheetpilot Setup $version.exe" $networkPath
Copy-Item "release\latest.yml" $networkPath
```

Manual steps:

1. Navigate to `release/` directory
2. Copy `Sheetpilot Setup X.X.X.exe` to network drive
3. Copy `latest.yml` to network drive (overwrite existing)

## Verify Deployment

- [ ] Confirm files are on network drive
- [ ] Verify `latest.yml` shows correct version
- [ ] Check file permissions (users need read access)

## Test Update

1. Install previous version on test machine
2. Launch app
3. Check logs for update detection
4. Close app to trigger installation
5. Verify new version launches

## Network Path Configuration

Update these files with your network path before first deployment:

**package.json:**

```json
"publish": {
  "provider": "generic",
  "url": "file://\\\\YOUR_SERVER\\YOUR_SHARE\\sheetpilot-updates"
}
```

**dev-app-update.yml:**

```yaml
provider: generic
url: file://\\\\YOUR_SERVER\\YOUR_SHARE\\sheetpilot-updates
```

## Rollback Procedure

If update causes issues:

1. Remove problematic installer from network drive
2. Copy previous version's `latest.yml` back to network drive
3. Users will download the previous version on next update check

## Common Issues

| Issue | Solution |
|-------|----------|
| "Update not detected" | Verify version was incremented in package.json |
| "Download fails" | Check network path accessibility |
| "File not found" | Ensure latest.yml references correct filename |
| "Permission denied" | Verify user has read access to network share |
