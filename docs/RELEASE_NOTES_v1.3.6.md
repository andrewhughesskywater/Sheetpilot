## Sheetpilot v1.3.6

- Released: 2025-10-30  
- Scope: Fix production build error for electron-updater

### Fixes

- Fixed "Cannot find module 'electron-updater'" error in production builds by:
  - Adding `app/backend/package.json` to electron-builder files list
  - Adding `app/backend/src/services/bot/package.json` to electron-builder files list
  - Configuring `asarUnpack` to unpack electron-updater from app.asar (required for native binaries)

### Developer notes

- electron-updater requires native binaries that must be unpacked from app.asar
- Backend dependencies properly packaged via package.json files inclusion
- All subdirectory package.json files now included for proper module resolution

### Known issues

- None tracked in code for this release.

### Upgrade notes

- Use the standard in-app updater. No manual migration steps required.

### Artifacts

- `Sheetpilot-Setup.exe`, `.blockmap`, and `latest.yml` expected with the v1.3.6 GitHub release.
