# Release v1.2.2

## Changes

### Code Quality Improvements

- **Type Safety Enhancements**: Improved TypeScript type assertions across components
  - Replaced unsafe `as any` type assertion with proper typed interface in TimesheetGrid
  - Fixed error message variable naming for better clarity
  - Enhanced UpdateDialog event handler typing
- **Service Type Improvements**: Enhanced type safety in timesheet importer service
  - Replaced generic type assertion with proper type casting for submission service
  - Improved type inference for submission service metadata
- **Dialog Component Fixes**: Updated UpdateDialog to use correct Material-UI prop types
  - Removed deprecated `disableBackdropClick` prop
  - Fixed event handler typing to match Dialog's onClose signature
- **Build Configuration Fixes**: Corrected electron-builder publish configuration
  - Removed invalid `disableWebInstaller` property from GitHub publish provider

### Technical Details

- **Electron version**: 38.4.0
- **Node.js version**: >= 18.0.0
- **Platform**: Windows x64
- **Build output**: `build/Sheetpilot-Setup.exe`

## Installation

Download `Sheetpilot-Setup.exe` from the latest release and run it to install the application on your Windows system.

## What's Changed

- Type Safety: Improved TypeScript type assertions
- Code Quality: Enhanced type safety in core services
- Linting: Fixed ESLint warnings and code style issues

**Full Changelog**: <https://github.com/andrewhughesskywater/Sheetpilot/compare/v1.2.1...v1.2.2>
