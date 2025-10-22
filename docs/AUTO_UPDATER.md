# Auto-Updater Configuration

## Overview

Sheetpilot uses `electron-updater` with GitHub Releases for automatic application updates. When users launch the app, it checks for newer versions and downloads/installs them automatically.

## Configuration

### Package.json Settings

```json
{
  "version": "1.1.2",
  "repository": {
    "type": "git",
    "url": "https://github.com/andrewhughesskywater/Sheetpilot.git"
  },
  "build": {
    "publish": {
      "provider": "github",
      "owner": "andrewhughesskywater",
      "repo": "Sheetpilot"
    }
  }
}
```

### Main Process Configuration

The auto-updater is configured in `main.ts`:

- **Auto-download**: Disabled initially, manually triggered after update detection
- **Auto-install**: Enabled on app quit for seamless updates
- **Production only**: Updates only check in packaged/production builds
- **Squirrel.Windows**: Special handling for first-run file locks

## Publishing a New Release

### 1. Update Version

```bash
# In package.json, increment the version
"version": "1.1.2"
```

### 2. Build Application

```bash
npm run build
```

This generates:

- `build/Sheetpilot-Setup.exe` - Windows installer
- `build/Sheetpilot-Setup.exe.blockmap` - Delta update support
- `build/latest.yml` - Update metadata

### 3. Prepare Release Files

```bash
powershell -ExecutionPolicy Bypass -File scripts/prepare-release.ps1
```

This script:

- Verifies all required files exist
- Creates a `build/release-v{version}` directory
- Copies installer and metadata files
- Generates release notes template
- Opens the release directory

### 4. Create GitHub Release

1. Go to <https://github.com/andrewhughesskywater/Sheetpilot/releases/new>
2. Create tag: `v1.1.2` (must match package.json version with 'v' prefix)
3. Set release title: `Sheetpilot v1.1.2`
4. Add release notes from `build/release-v{version}/RELEASE_NOTES.md`
5. Upload these files:
   - `Sheetpilot-Setup.exe`
   - `Sheetpilot-Setup.exe.blockmap`
   - `latest.yml`
6. Click "Publish release"

## How Auto-Updates Work

### Update Check Flow

1. **App Launch**: When Sheetpilot starts, `configureAutoUpdater()` is called
2. **Version Check**: electron-updater queries GitHub API for latest release
3. **Comparison**: Compares installed version with latest release version
4. **Download**: If newer version exists, downloads installer automatically
5. **Verification**: Verifies SHA512 hash of downloaded file
6. **Installation**: On app quit, installer runs automatically

### Update Events

```typescript
autoUpdater.on('checking-for-update', () => {
  // Logged: "Checking for updates"
});

autoUpdater.on('update-available', (info) => {
  // Logged: "Update available", version info
  // Triggers automatic download
});

autoUpdater.on('update-not-available', (info) => {
  // Logged: "Update not available"
});

autoUpdater.on('download-progress', (progress) => {
  // Logged: Download percentage, transferred bytes, total size
});

autoUpdater.on('update-downloaded', (info) => {
  // Logged: "Update downloaded", version info
  // Update will install on app quit
});

autoUpdater.on('error', (err) => {
  // Logged: Error details
});
```

### User Experience

- **Silent Check**: Update check happens in background, no user interaction
- **Silent Download**: Update downloads without interrupting workflow
- **Install on Quit**: Update installs when user closes the app
- **Automatic Restart**: New version launches after installation (NSIS default)

## Testing Updates

### Local Testing

1. Install version 1.0.0 (or older version)
2. Create GitHub release for version 1.0.1
3. Launch installed application
4. Check logs: `%APPDATA%\sheetpilot\sheetpilot_*.log`
5. Look for update messages

### Log Inspection

```powershell
# Find latest log file
dir $env:APPDATA\sheetpilot\*.log | sort LastWriteTime -Descending | select -First 1

# Search for update messages
Select-String -Path "$env:APPDATA\sheetpilot\*.log" -Pattern "update|Update|AutoUpdater"
```

### Test Scenarios

**Scenario 1: Update Available**

- Current version: 1.0.0
- Latest release: 1.0.1
- Expected: Download and install update

**Scenario 2: No Update**

- Current version: 1.0.1
- Latest release: 1.0.1
- Expected: "Update not available" logged

**Scenario 3: Network Error**

- No internet connection
- Expected: Error logged, app continues normally

## Troubleshooting

### Updates Not Detected

**Check version format:**

```json
// Correct
"version": "1.1.2"
// Tag: v1.0.1

// Incorrect
"version": "v1.0.1"  // No 'v' in package.json
```

**Verify GitHub release:**

- Release must be published (not draft)
- Tag must start with 'v' (e.g., `v1.0.1`)
- Files must be attached to release

**Check logs:**

```powershell
Select-String -Path "$env:APPDATA\sheetpilot\*.log" -Pattern "error|Error" -Context 2
```

### Download Fails

**File accessibility:**

- Verify files are uploaded correctly
- Check file size matches `latest.yml`
- Ensure repository is public or token is configured

**SHA512 mismatch:**

- Rebuild application to regenerate `latest.yml`
- Re-upload all files together

**Network issues:**

- Check firewall settings
- Verify GitHub API accessibility
- Check proxy configuration

### Common Errors

**"ClientRequest only supports http: and https: protocols"**

- **Cause**: Using `file://` protocol (network drive)
- **Solution**: Use GitHub releases (already configured)

**"Update not available" for newer version**

- **Cause**: Tag format mismatch
- **Solution**: Tag must be `v{version}`, not just `{version}`

**"Error: ENOENT: no such file"**

- **Cause**: Missing files in GitHub release
- **Solution**: Upload `Sheetpilot-Setup.exe`, `.blockmap`, and `latest.yml`

## Advanced Configuration

### Private Repositories

If using a private repository, configure GitHub token:

```bash
# Set environment variable
$env:GH_TOKEN="ghp_yourPersonalAccessToken"

# Build with token
npm run build
```

Update `package.json`:

```json
"publish": {
  "provider": "github",
  "owner": "andrewhughesskywater",
  "repo": "Sheetpilot",
  "token": "${GH_TOKEN}",
  "private": true
}
```

### Delta Updates

Delta updates download only changed portions of the installer:

- Enabled by default through `.blockmap` files
- Significantly reduces download size for minor updates
- Requires both old and new `.blockmap` files

### Custom Update Channels

Support beta/alpha channels:

```json
"publish": {
  "provider": "github",
  "owner": "andrewhughesskywater",
  "repo": "Sheetpilot",
  "channel": "beta"
}
```

Create pre-releases on GitHub for beta channel.

## Security Considerations

### File Integrity

- All downloads verified with SHA512 hashes
- Hashes stored in `latest.yml`
- Mismatch causes download rejection

### HTTPS Only

- All update checks use HTTPS
- GitHub API provides secure download URLs
- Man-in-the-middle attacks prevented

### Code Signing

Currently disabled for development:

```json
"forceCodeSigning": false
```

For production, consider:

- Windows: EV code signing certificate
- SmartScreen reputation building
- Timestamp server for long-term validation

## Monitoring

### Log Analysis

All update events are logged with structured data:

```json
{
  "timestamp": "2025-10-14T13:40:06.191Z",
  "level": "info",
  "component": "Application",
  "message": "Checking for updates"
}
```

### Metrics to Track

- Update check frequency
- Download success rate
- Installation success rate
- Version distribution
- Error patterns

## References

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [GitHub Releases Guide](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)
