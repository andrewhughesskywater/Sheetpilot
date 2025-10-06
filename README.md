# Sheetpilot

An Electron-based desktop application for automated timesheet management and submission.

## Overview

Sheetpilot is a time-tracking application that combines a modern Electron UI with automated web form submission capabilities. It provides a streamlined interface for managing timesheet entries and automatically submits them to web-based timesheet systems.

## Features

- **Timesheet Grid Interface**: Intuitive grid-based interface for entering time entries
- **Database Storage**: SQLite-based storage for timesheet data
- **Automated Submission**: Playwright-powered bot for automated timesheet submission
- **Database Viewer**: Built-in viewer for managing stored timesheet data
- **Auto-Updates**: Built-in auto-update functionality for seamless application updates
- **Modern UI**: React-based frontend with responsive design

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Electron + Node.js + TypeScript
- **Automation**: Playwright
- **Database**: SQLite
- **Testing**: Vitest

## Project Structure

```
Sheetpilot/
├── backend/
│   ├── bot/              # Playwright automation bot
│   ├── database.ts       # Database operations
│   └── timesheet_importer.ts
├── renderer/             # React frontend
│   ├── src/
│   ├── components/
│   └── pages/
├── shared/               # Shared utilities (logger, etc.)
├── tests/                # Integration and unit tests
├── docs/                 # Documentation
└── dist/                 # Build output
```

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install root dependencies
npm install

# Install renderer dependencies
cd renderer
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

```bash
# Build the application
npm run build

# Package for distribution
npm run dist
```

The built application will be available in the `build-output` directory.

## Configuration

Configuration files:
- `package.json`: Application metadata and build configuration
- `tsconfig.json`: TypeScript configuration
- `vitest.config.ts`: Test configuration
- `eslint.config.js`: ESLint configuration

## Documentation

- [Auto Updates](docs/AUTO_UPDATES.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)
- [Update Deployment Checklist](docs/UPDATE_DEPLOYMENT_CHECKLIST.md)

## License

Private repository - All rights reserved

## Contributing

This is a private project. Contact the repository owner for contribution guidelines.

