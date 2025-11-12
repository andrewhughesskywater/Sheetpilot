# Sheetpilot

An Electron-based desktop application for automated timesheet management and submission.

## Overview

Sheetpilot is a time-tracking application that combines a modern Electron UI with automated web form submission capabilities. It provides a streamlined interface for managing timesheet entries and automatically submits them to web-based timesheet systems.

## Features

- **Timesheet Grid Interface**: Intuitive grid-based interface for entering time entries with dynamic height and proper scrolling
- **Database Storage**: SQLite-based storage for timesheet data
- **Automated Submission**: Playwright-powered bot for automated timesheet submission
- **Database Viewer**: Built-in viewer for managing stored timesheet data
- **Auto-Updates**: Built-in auto-update functionality for seamless application updates
- **Modern UI**: React-based frontend with responsive design

## Recent Updates

- **Fixed Timesheet Scrolling**: Resolved table height and scrolling issues for better user experience
- **Database Connection Fixes**: Resolved Node.js compatibility and preload script issues
- **Improved Error Handling**: Better error messages and fallback mechanisms

For detailed information about recent fixes, see [TIMESHEET_FIXES_DOCUMENTATION.md](TIMESHEET_FIXES_DOCUMENTATION.md).

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Electron + Node.js + TypeScript
- **Automation**: Playwright
- **Database**: SQLite
- **Testing**: Vitest

## Project Structure

```text
Sheetpilot/
├── src/
│   ├── main/             # Main process (Electron)
│   ├── renderer/         # React frontend
│   │   ├── src/
│   │   ├── components/
│   │   └── pages/
│   ├── services/         # Backend services (database, bot)
│   ├── shared/           # Shared utilities (logger, etc.)
│   └── assets/           # Application assets
├── __tests__/            # Integration and unit tests
├── docs/                 # Documentation
└── build/                # Build output
```

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Environment Variables

For security purposes, certain configuration options should be set via environment variables:

**Required for Production:**
- `SHEETPILOT_ADMIN_PASSWORD` - Admin account password (admin login disabled if not set)

**Optional:**
- `SHEETPILOT_ADMIN_USERNAME` - Admin account username (default: "Admin")
- `SHEETPILOT_MASTER_KEY` - Master encryption key for password storage (default: machine-specific)

**Example .env file:**
```bash
SHEETPILOT_ADMIN_USERNAME=Admin
SHEETPILOT_ADMIN_PASSWORD=your_secure_password_here
SHEETPILOT_MASTER_KEY=your_master_encryption_key_here
```

### Installation

```bash
# Install root dependencies
npm install

# Install renderer dependencies
cd src/renderer
npm install
```

### Running in Development

```bash
# Build and run the application
npm run build
npm start
```

### Testing

```bash
# Run all tests
make test

# Run specific test suites
npm test -- --unit
npm test -- --integration
```

## Building

### Dependency Validation

Before building, validate that all dependencies are correctly configured:

```bash
# Validate dependencies manually
npm run validate:deps
```

This checks:
- All dependencies exist in correct locations (root/backend/bot service)
- Native modules (better-sqlite3) are properly rebuilt for Electron
- Peer dependencies are satisfied
- Build output structure is correct
- electron-builder configuration is valid

See [Dependency Validation Guide](docs/DEPENDENCY_VALIDATION.md) for details.

### Building the Application

```bash
# Build the application (automatically runs validation first)
npm run build

# Build without packaging (faster, for testing)
npm run build:dir
```

The built application will be available in the `release` directory.

**Note:** `npm run build` automatically validates dependencies via the `prebuild` hook. If validation fails, the build stops with clear error messages.

## Configuration

Configuration files:

- `package.json`: Application metadata and build configuration
- `tsconfig.json`: TypeScript configuration
- `__tests__/vitest.config.ts`: Test configuration
- `eslint.config.js`: ESLint configuration

## Antivirus Compatibility

Some enterprise antivirus solutions may flag Sheetpilot due to browser automation features. If you encounter issues:

1. See [Sophos Configuration Guide](docs/SOPHOS_CONFIGURATION.md)
2. Contact your IT administrator to add exclusions
3. Verified safe by: Internal security review

## Documentation

### For Users
- [User Guide](docs/USER_GUIDE.md) - Comprehensive guide for end users

### For Developers
- [Developer Wiki](docs/DEVELOPER_WIKI.md) - Complete developer reference
- [Auto Updates](docs/AUTO_UPDATES.md)
- [Dependency Validation Guide](docs/DEPENDENCY_VALIDATION.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)
- [Update Deployment Checklist](docs/UPDATE_DEPLOYMENT_CHECKLIST.md)

## License

Private repository - All rights reserved

## Contributing

This is a private project. Contact the repository owner for contribution guidelines.
