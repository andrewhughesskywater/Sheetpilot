# File Structure Reorganization

## Overview

This document describes the comprehensive reorganization of the Sheetpilot project file structure to align with industry standards for Electron applications and Node.js projects.

## Changes Made

### 1. Directory Structure Reorganization

#### Before:
```
├── main.ts                    # Main process entry point
├── preload.ts                 # Preload script
├── backend/
│   ├── database.ts           # Database service
│   ├── timesheet_importer.ts # Timesheet service
│   └── bot/                  # Bot service
├── shared/
│   └── logger.ts             # Shared utilities
├── assets/
│   └── images/               # Application assets
├── tests/                    # Test files
├── dist/                     # Build output
└── build-output/             # Electron builder output
```

#### After:
```
├── src/
│   ├── main/                 # Main process code
│   │   ├── main.ts          # Main process entry point
│   │   └── preload.ts       # Preload script
│   ├── services/            # Backend services
│   │   ├── database.ts      # Database service
│   │   ├── timesheet_importer.ts # Timesheet service
│   │   └── bot/             # Bot service
│   ├── shared/              # Shared utilities
│   │   └── logger.ts        # Logging utilities
│   ├── assets/              # Application assets
│   │   ├── images/          # Image assets
│   │   ├── icons/           # Icon assets
│   │   └── fonts/           # Font assets
│   └── renderer/            # Renderer process code (future)
├── __tests__/               # Test files
├── build/                   # All build outputs
│   └── dist/               # Compiled JavaScript
└── renderer/               # Existing renderer code (unchanged)
```

### 2. Configuration Updates

#### package.json Changes:
- Updated `main` entry point: `dist/main.js` → `build/dist/main.js`
- Updated build scripts to use new paths:
  - `main.ts` → `src/main/main.ts`
  - `preload.ts` → `src/main/preload.ts`
  - `dist` → `build/dist`
  - `backend/bot` → `src/services/bot`
- Updated icon paths: `icon.ico` → `src/assets/images/icon.ico`
- Updated build output directory: `build-output` → `build`

#### tsconfig.json Changes:
- Updated `outDir`: `dist` → `build/dist`
- Updated `rootDir`: `.` → `src`
- Updated `include` patterns: `main.ts`, `preload.ts`, `backend/**/*.ts` → `src/**/*.ts`
- Updated `exclude` patterns to reflect new structure
- Updated `tsBuildInfoFile`: `dist/.tsbuildinfo` → `build/dist/.tsbuildinfo`

#### vitest.config.ts Changes:
- Updated test paths: `tests/**/*.spec.ts` → `__tests__/**/*.spec.ts`
- Updated setup file path: `./tests/setup.ts` → `./__tests__/setup.ts`

### 3. Import Path Updates

#### main.ts Updates:
- Updated service imports:
  - `./backend/database` → `../services/database`
  - `./backend/timesheet_importer` → `../services/timesheet_importer`
  - `./shared/logger` → `../shared/logger`
- Updated asset paths:
  - Icon path: `assets/images/icon.ico` → `src/assets/images/icon.ico`
  - Renderer path: `renderer/dist/index.html` → `renderer/dist/index.html` (adjusted relative path)

### 4. Benefits of New Structure

#### Industry Standard Compliance:
- **Main Process Code**: Organized in `src/main/` following Electron best practices
- **Services**: Separated into `src/services/` for better modularity
- **Shared Code**: Centralized in `src/shared/` to avoid duplication
- **Assets**: Properly organized in `src/assets/` with subdirectories by type
- **Tests**: Moved to `__tests__/` following Jest/Vitest conventions
- **Build Output**: Consolidated in `build/` directory

#### Improved Maintainability:
- Clear separation of concerns
- Easier to locate and modify specific functionality
- Better organization for team collaboration
- Follows established patterns familiar to developers

#### Enhanced Build Process:
- Cleaner build output structure
- Better separation of source and compiled code
- Improved CI/CD pipeline compatibility

### 5. Migration Impact

#### Files Moved:
- `main.ts` → `src/main/main.ts`
- `preload.ts` → `src/main/preload.ts`
- `backend/database.ts` → `src/services/database.ts`
- `backend/timesheet_importer.ts` → `src/services/timesheet_importer.ts`
- `backend/bot/` → `src/services/bot/`
- `shared/logger.ts` → `src/shared/logger.ts`
- `assets/images/*` → `src/assets/images/*`
- `tests/*` → `__tests__/*`
- `dist/` → `build/dist/`
- `build-output/*` → `build/*`

#### Directories Removed:
- `backend/` (contents moved)
- `shared/` (contents moved)
- `assets/` (contents moved)
- `tests/` (contents moved)
- `build-output/` (contents moved)

### 6. Verification Steps

To verify the reorganization was successful:

1. **Build Process**: Run `npm run build` to ensure compilation works
2. **Development Mode**: Run `npm run dev` to verify development workflow
3. **Tests**: Run `npm test` to ensure test discovery works
4. **Electron App**: Launch the application to verify runtime functionality

### 7. Future Considerations

#### Recommended Next Steps:
1. **Renderer Integration**: Consider moving renderer-specific code to `src/renderer/`
2. **Type Definitions**: Organize type definitions in `src/types/`
3. **Utilities**: Create `src/utils/` for common utility functions
4. **Constants**: Create `src/constants/` for application constants
5. **API Layer**: Consider creating `src/api/` for external service integrations

#### Documentation Updates:
- Update README.md with new directory structure
- Update development setup instructions
- Update CI/CD pipeline configurations
- Update deployment scripts if necessary

## Conclusion

The file structure reorganization brings the Sheetpilot project in line with modern Electron and Node.js development practices. The new structure provides better organization, improved maintainability, and follows industry standards that will make the codebase more accessible to new developers and easier to maintain long-term.
