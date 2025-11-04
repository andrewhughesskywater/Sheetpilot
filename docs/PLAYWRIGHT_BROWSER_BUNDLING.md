# Playwright Browser Bundling

## Problem

Users were reporting an error when trying to submit timesheets:

```
Error: Could not launch bundled Chromium browser: browserType.launch: Executable doesn't exist at C:\Users\[username]\AppData\Local\ms-playwright\chromium-1194\chrome-win\chrome.exe
```

The issue was that Playwright browsers were not being bundled with the Electron application. While the Playwright library code was included, the browser executables stored in the user's local cache were not.

## Root Cause

1. The `postinstall` script runs `npx playwright install chromium`, which downloads browsers to the local cache directory (`%USERPROFILE%\AppData\Local\ms-playwright\`)
2. The electron-builder configuration included Playwright's node_modules files but NOT the browser binaries
3. When the app was packaged and distributed, Playwright would try to launch browsers from the expected cache location, which doesn't exist on end users' machines

## Solution

The fix involves three components:

### 1. Browser Bundling Script (`scripts/bundle-playwright-browsers.js`)

This script:
- Locates the Playwright browser cache directory based on the OS
- Finds the Chromium browser directory (e.g., `chromium-1194`)
- Copies the entire browser directory to `build/playwright-browsers/`
- Runs as part of the build process before electron-builder packages the app

### 2. Runtime Browser Detection (`app/backend/src/services/bot/src/webform_flow.ts`)

The `WebformFiller` class now includes:
- `getBundledBrowserPath()` method that:
  - Checks if running in production (`app.isPackaged`)
  - In development: uses system Playwright browsers (default behavior)
  - In production: locates and returns the path to bundled browsers
- `_launch_browser()` method updated to:
  - Call `getBundledBrowserPath()` to get the executable path
  - Set `executablePath` in launch options if bundled browsers are found
  - Falls back to default behavior if bundled browsers aren't available

### 3. Build Configuration Updates (`package.json`)

Updated electron-builder configuration to:
- Add `bundle:browsers` script that runs the bundling script
- Include `npm run bundle:browsers` in both `build` and `build:dir` scripts
- Add `build/playwright-browsers/**/*` to the `files` array
- Add `**/build/playwright-browsers/**/*` to the `asarUnpack` array (ensures browsers are extracted from ASAR)

## How It Works

### Development Mode
- Playwright uses browsers from the system cache (`%USERPROFILE%\AppData\Local\ms-playwright\`)
- No changes to developer workflow
- `postinstall` script ensures browsers are available

### Production Mode
- During build:
  1. `npm run bundle:browsers` copies browsers from cache to `build/playwright-browsers/`
  2. electron-builder packages the browsers with the app
  3. Browsers are unpacked from ASAR to `resources/app.asar.unpacked/build/playwright-browsers/`
- At runtime:
  1. `getBundledBrowserPath()` detects `app.isPackaged === true`
  2. Locates bundled browsers in `resources/app.asar.unpacked/build/playwright-browsers/`
  3. Returns the platform-specific executable path
  4. Playwright launches using the bundled browser

## Platform Support

The solution supports all platforms:
- **Windows**: `chrome-win/chrome.exe`
- **macOS**: `chrome-mac/Chromium.app/Contents/MacOS/Chromium`
- **Linux**: `chrome-linux/chrome`

## Build Process

```bash
# The build command now includes browser bundling:
npm run build

# Which executes:
# 1. npm run build:main
# 2. npm run build:renderer
# 3. npm run build:bot
# 4. npm run bundle:browsers  <- New step
# 5. electron-builder
```

## Verification

To verify the fix:

1. Build the application: `npm run build`
2. Check that `build/playwright-browsers/chromium-*/` exists
3. Install the built application on a clean machine (without Playwright installed)
4. Try submitting timesheets - should work without errors

## File Size Impact

The Chromium browser adds approximately 280-350 MB to the application size depending on the platform. This is necessary for offline browser automation functionality.

## Future Considerations

- The browser version is locked to the version installed during build
- To update the browser, run `npx playwright install chromium` and rebuild
- Consider adding a checksum/version validation if browser updates become critical


