# SheetPilot

A high-performance desktop application for automated timesheet management and submission, built with Tauri v2.

## Overview

SheetPilot is a time-tracking application that combines a modern Svelte UI with automated web form submission capabilities. Built with Tauri v2 and Rust, it provides exceptional performance and a tiny deployment footprint while maintaining all the features of the original Electron version.

**Size Achievements:**

- ✅ **97.8% smaller installer**: 101.71 MB → 2.23 MB
- ✅ **98.4% smaller executable**: 384.68 MB → 6.09 MB

## Features

- **Timesheet Grid Interface**: Excel-like spreadsheet powered by Handsontable for intuitive time entry
- **Database Storage**: Fast SQLite-based storage with Rust backend
- **Archive Viewer**: View and filter submitted timesheet entries
- **Settings Panel**: Manage credentials and admin tools
- **Automated Submission**: Chromiumoxide-powered browser automation for timesheet submission
- **Authentication**: Secure session management with localStorage persistence
- **Quarter-Based Routing**: Intelligent form routing based on fiscal quarters
- **Modern UI**: Svelte 5 with Flowbite components and Tailwind CSS

## Tech Stack

### Frontend

- **Svelte 5** - Reactive UI framework
- **Flowbite Svelte 0.46** - Material Design 3 components
- **Handsontable 16.1** - Spreadsheet grid
- **Tailwind CSS 3.4** - Utility-first styling
- **Vite 6** - Build tool

### Backend

- **Tauri 2.9** - Desktop framework
- **Rust** - Native performance
- **rusqlite 0.31** - SQLite with bundled binary
- **chromiumoxide 0.7** - Browser automation
- **tokio** - Async runtime
- **chrono** - Date/time handling

## Prerequisites

- **Node.js 18+** (for frontend development)
- **Rust** (latest stable) - Install from [rustup.rs](https://rustup.rs/)

## Development Setup

### Installation

```bash
# Install dependencies
npm install
```

### Running the Application

You need **two terminals**:

**Terminal 1 - Frontend Dev Server:**

```bash
npm run dev
```

**Terminal 2 - Tauri App:**

```bash
npm run tauri:dev
```

The application will open in a native window. The frontend dev server runs on port 1420.

### Default Credentials

**Admin Account:**

- Username: `Admin`
- Password: `SWFL_ADMIN`

**Regular Users:**

- Any email/password combination creates a user account

## Building for Production

```bash
npm run tauri:build
```

The installer will be created in:

```text
backend/target/release/bundle/nsis/SheetPilot_1.4.0_x64-setup.exe
```

The portable executable:

```text
backend/target/release/sheetpilot.exe
```

## Project Structure

```text
SheetPilot/
├── frontend/                 # Frontend (Svelte)
│   ├── lib/
│   │   ├── components/       # UI components
│   │   │   ├── DatabaseViewer.svelte
│   │   │   ├── Login.svelte
│   │   │   ├── Settings.svelte
│   │   │   ├── TimesheetGrid.svelte
│   │   │   └── __tests__/   # Component tests
│   │   └── stores/           # State management
│   │       ├── data.ts       # Data store
│   │       ├── session.ts    # Session store
│   │       └── __tests__/   # Store tests
│   ├── assets/              # Static assets
│   ├── App.svelte          # Root component
│   ├── index.html          # HTML entry
│   ├── main.js             # JS entry
│   └── styles.css          # Global styles
├── backend/                 # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── commands/        # Tauri IPC handlers
│   │   │   ├── auth.rs      # Authentication commands
│   │   │   ├── credentials.rs # Credential management
│   │   │   ├── database.rs  # Database commands
│   │   │   └── submission.rs # Submission commands
│   │   ├── bot/            # Browser automation
│   │   │   ├── authentication.rs # Login flow
│   │   │   ├── automation_config.rs # Bot config
│   │   │   ├── browser.rs   # Browser control
│   │   │   ├── orchestration.rs # Submission orchestration
│   │   │   ├── quarter_config.rs # Quarter routing
│   │   │   └── webform.rs   # Form filling
│   │   ├── auth.rs         # Authentication logic
│   │   ├── database.rs     # Database layer
│   │   ├── bot.rs          # Bot module
│   │   ├── lib.rs          # Library entry
│   │   └── main.rs         # Binary entry
│   ├── icons/              # App icons
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── shared/                  # Shared code (future use)
├── tests/                   # E2E and integration tests
│   └── setup.ts
├── package.json            # Node dependencies & scripts
├── vite.config.js          # Build configuration
├── vitest.config.ts        # Test configuration
├── tailwind.config.js      # Styling configuration
└── README.md               # This file
```

## Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Generate coverage report
npm run test:coverage
```

## Database Location

**Development/Production:**

```text
Windows: C:\Users\[USERNAME]\AppData\Roaming\com.sheetpilot.app\sheetpilot.sqlite
macOS: ~/Library/Application Support/com.sheetpilot.app/sheetpilot.sqlite
Linux: ~/.config/com.sheetpilot.app/sheetpilot.sqlite
```

## Configuration

### Environment Variables

Tauri uses environment variables prefixed with `VITE_` or `TAURI_`:

```bash
# Frontend variables
VITE_API_URL=http://localhost:1420

# Tauri-specific variables (set by Tauri automatically)
TAURI_DEBUG=1
```

### Configuration Files

- `package.json` - Node dependencies and scripts
- `backend/tauri.conf.json` - Tauri configuration
- `backend/Cargo.toml` - Rust dependencies
- `vite.config.js` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `vitest.config.ts` - Test configuration

## Browser Automation

SheetPilot uses chromiumoxide to automate timesheet submission:

- **14-step authentication flow** with Azure AD SSO support
- **Quarter-based form routing** for Q1-Q4 2025
- **SmartSheets integration** with dropdown handling
- **Submission validation** with multiple success indicators

The bot connects to your system's installed Chrome browser (not bundled).

## Key Improvements Over Electron

1. **Size**: 97.8% smaller installer, 98.4% smaller executable
2. **Performance**: Native Rust backend vs Node.js
3. **Security**: Tauri's permission-based system with CSP
4. **Memory**: Lower memory footprint
5. **Startup**: Faster application startup
6. **Updates**: Smaller update downloads (when implemented)
7. **WebView**: Uses system WebView2 (no bundled Chromium)

## Troubleshooting

### Port Already in Use

If port 1420 is already in use:

```bash
# Find and kill the process using port 1420 (Windows)
netstat -ano | findstr :1420
taskkill /PID [PID] /F
```

### Rust Build Errors

Ensure you have the latest Rust toolchain:

```bash
rustup update stable
```

### Frontend Not Loading

1. Make sure the frontend dev server is running (`npm run dev`)
2. Check that it's running on port 1420
3. Restart both terminals

## Contributing

This is a private project. Contact the repository owner for contribution guidelines.

## License

Private repository - All rights reserved

## Version

Current version: **1.4.0**

---

**Migration Status**: ✅ Complete - Successfully migrated from Electron to Tauri v2
