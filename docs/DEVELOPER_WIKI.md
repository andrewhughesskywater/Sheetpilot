# SheetPilot Developer Wiki

**Last Updated**: November 12, 2025  
**Purpose**: Consolidated reference for developers working on SheetPilot

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Critical Configuration](#critical-configuration)
4. [Material Design 3 (M3) System](#material-design-3-m3-system)
5. [Handsontable Integration](#handsontable-integration)
6. [Auto-Updates](#auto-updates)
7. [Performance](#performance)
8. [Coding Standards](#coding-standards)
9. [Error Handling](#error-handling)
10. [Testing Strategy](#testing-strategy)
11. [Dependency Validation](#dependency-validation)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)
14. [Fast Development Mode](#fast-development-mode)
15. [Architecture Documentation Guide](#architecture-documentation-guide)
16. [Feature Documentation](#feature-documentation)
17. [Changelog](#changelog)

---

## Quick Start

### Development Setup

```bash
# Install dependencies
npm install
cd src/renderer && npm install && cd ../..

# Run development mode
npm run dev

# Run tests
npm test

# Build production
npm run build
```

### Project Structure

```text
src/
├── main/                           # Main process (Electron)
│   ├── bootstrap-plugins.ts        # Plugin registration
│   ├── main.ts                     # Application entry point
│   └── preload.ts                  # Preload script (IPC bridge)
│
├── services/                       # Backend services
│   ├── bot/                        # Browser automation
│   │   └── src/                    # Bot implementation
│   ├── plugins/                    # Service layer plugins
│   │   ├── memory-data-service.ts
│   │   ├── mock-submission-service.ts
│   │   ├── playwright-bot-service.ts
│   │   ├── sqlite-credential-service.ts
│   │   └── sqlite-data-service.ts
│   ├── database.ts                 # Database layer
│   └── timesheet_importer.ts       # Timesheet import logic
│
├── shared/                         # Shared code (main + renderer)
│   ├── contracts/                  # Service contracts
│   │   ├── ICredentialService.ts
│   │   ├── IDataService.ts
│   │   ├── ILoggingService.ts
│   │   └── ISubmissionService.ts
│   ├── logger.ts                   # Logging system
│   ├── plugin-config.ts            # Plugin configuration
│   ├── plugin-registry.ts          # Plugin registry
│   └── plugin-types.ts             # Plugin type system
│
└── renderer/                       # Renderer process (React + Vite)
    ├── assets/                     # Static assets
    │   ├── fonts/                  # Font files
    │   ├── icons/                  # Icon files
    │   └── images/                 # Image files
    ├── logic/                      # Pure business logic
    │   ├── dropdown-logic.ts       # Cascading dropdown rules
    │   ├── timesheet-normalization.ts
    │   └── timesheet-validation.ts # Validation rules
    ├── components/                 # React components
    │   ├── DatabaseViewer.tsx
    │   ├── GridFactory.tsx         # Grid resolution
    │   ├── Help.tsx
    │   ├── ModernSegmentedNavigation.tsx
    │   ├── TimesheetGrid.tsx       # Legacy grid (reference)
    │   ├── TimesheetGridContainer.tsx
    │   └── UserManual.tsx
    ├── contexts/                   # React contexts
    │   └── DataContext.tsx
    ├── contracts/                  # UI contracts
    │   ├── IGridAdapter.ts
    │   └── ITimesheetGrid.ts
    ├── hooks/                      # React hooks
    │   └── useTheme.ts
    ├── utils/                      # Frontend utilities
    │   └── theme-manager.ts
    ├── tests/                      # Frontend tests
    ├── App.tsx                     # Main React component
    ├── index.html                  # HTML entry point
    ├── main.tsx                    # React entry point
    ├── m3-tokens.css              # Material Design 3 tokens
    ├── m3-components.css          # M3 component styles
    ├── m3-mui-overrides.css       # M3 MUI overrides
    ├── theme.css                  # Theme definitions
    └── vite.config.ts             # Vite configuration

__tests__/                          # Integration tests
build/                              # Build outputs
docs/                               # Documentation
plugin-config.json                  # Plugin configuration
```

---

## Architecture Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI** | React + TypeScript | Renderer process |
| **Styling** | Material Design 3 | Design system |
| **Grid** | Handsontable 16.1.1 | Spreadsheet UI |
| **Main Process** | Electron | Desktop app framework |
| **Database** | SQLite (better-sqlite3) | Local data storage |
| **Automation** | Playwright | Browser automation |
| **Build** | electron-builder | Application packaging |
| **Updates** | electron-updater | Auto-update system |

### Key Patterns

- **IPC Communication**: Main ↔ Renderer via `window.timesheet` preload API
- **State Management**: React Context for global state
- **Logging**: Dual system (local + network, non-blocking)
- **Data Persistence**: SQLite + localStorage backup
- **Theme System**: CSS custom properties with M3 tokens
- **Plugin Architecture**: Modular, replaceable components

---

## Plugin Architecture

### Overview

SheetPilot uses a comprehensive plugin architecture that makes all major components replaceable at runtime. This enables A/B testing, alternative implementations, and future-proofing.

### Core Plugin System

**Files:**

- `src/shared/plugin-types.ts` - Base plugin interfaces and type definitions
- `src/shared/plugin-registry.ts` - Central plugin management (singleton pattern)
- `src/shared/plugin-config.ts` - Configuration loader with feature flags
- `plugin-config.json` - Default plugin configuration
- `src/main/bootstrap-plugins.ts` - Plugin registration and initialization

**Features:**

- Namespace-based plugin organization
- Active plugin selection per namespace
- Feature flags for A/B testing
- Configuration from JSON or environment variables
- User-based rollout percentages for gradual feature deployment

### Service Layer Plugins

#### Contracts (Interfaces)

All services implement clean interface contracts:

- `src/shared/contracts/IDataService.ts` - Data persistence operations
- `src/shared/contracts/ICredentialService.ts` - Credential management
- `src/shared/contracts/ISubmissionService.ts` - Timesheet submission
- `src/shared/contracts/ILoggingService.ts` - Logging operations

#### Implementations

**Data Services:**

- `sqlite-data-service` - Production SQLite persistence
- `memory-data-service` - In-memory storage for testing

**Credential Services:**

- `sqlite-credential-service` - Production SQLite credential storage

**Submission Services:**

- `playwright-bot-service` - Production browser automation
- `mock-submission-service` - Mock submission for testing

### UI Layer Plugins

#### Business Logic (Pure Functions)

Extracted business logic is UI-independent and reusable:

- `src/logic/timesheet-validation.ts` - All validation rules
- `src/logic/dropdown-logic.ts` - Cascading dropdown rules
- `src/logic/timesheet-normalization.ts` - Data normalization

#### Grid Contracts

- `src/renderer/contracts/ITimesheetGrid.ts` - Grid component interface
- `src/renderer/contracts/IGridAdapter.ts` - Grid adapter pattern

#### Grid Implementations

- `HandsontableGridPlugin` - Production grid using Handsontable
- Future: `SimpleTableGridPlugin`, `AGGridPlugin`, etc.

#### Grid Factory

- `src/renderer/components/GridFactory.tsx` - Resolves grid implementation
- `src/renderer/components/TimesheetGridContainer.tsx` - Stable container

### Configuration

#### Plugin Configuration File

**File:** `plugin-config.json`

```json
{
  "plugins": {
    "data": { 
      "active": "sqlite", 
      "alternatives": ["memory"] 
    },
    "credentials": { 
      "active": "sqlite" 
    },
    "submission": { 
      "active": "playwright", 
      "alternatives": ["mock"] 
    },
    "ui": { 
      "active": "handsontable", 
      "alternatives": ["simple-table"] 
    }
  },
  "featureFlags": {
    "experimentalGrid": { 
      "enabled": false, 
      "variant": "simple-table" 
    },
    "mockSubmission": { 
      "enabled": false 
    }
  }
}
```

#### Environment Variable Override

```bash
# Override entire config
export SHEETPILOT_PLUGIN_CONFIG='{"plugins":{"submission":{"active":"mock"}}}'

# Override user ID for feature flag targeting
export SHEETPILOT_USER_ID="test.user@company.com"
```

#### LocalStorage Override (Grid Only)

```javascript
// Switch grid implementation
localStorage.setItem('sheetpilot_grid_type', 'simple-table');
```

### Swapping Implementations

#### Example: Use Mock Submission for Testing

Edit `plugin-config.json`:

```json
{
  "plugins": {
    "submission": {
      "active": "mock"  // Changed from "playwright"
    }
  }
}
```

#### Example: Add New Data Service

1. Create new service implementing `IDataService`:

```typescript
export class PostgresDataService implements IDataService {
  // Implement all IDataService methods
}
```

2. Register in `bootstrap-plugins.ts`:

```typescript
PluginRegistry.getInstance().register('data', 'postgres', new PostgresDataService());
```

3. Update `plugin-config.json`:

```json
{
  "plugins": {
    "data": { "active": "postgres" }
  }
}
```

### Architecture Benefits

- **Clean Separation**: Business logic decoupled from UI
- **Testability**: Pure functions, mock implementations available
- **Replaceability**: Components swappable via configuration
- **Zero Vendor Lock-in**: Easy to migrate to different libraries
- **A/B Testing**: Test alternatives without code changes
- **Future-Proof**: New implementations added without breaking existing code

---

## Critical Configuration

### ⚠️ NSIS Installer Required for Auto-Updates

**CRITICAL**: Auto-updates ONLY work with NSIS installer, NOT portable builds.

```json
// package.json
"win": {
  "target": "nsis"  // ✅ Required for auto-updates
}
```

### Per-User Installation (No UAC)

```json
"nsis": {
  "oneClick": false,
  "perMachine": false,  // ✅ Per-user - NO UAC required
  "allowToChangeInstallationDirectory": true
}
```

### Network Path Configuration

```json
// package.json
"publish": {
  "provider": "generic",
  "url": "file://\\\\swfl-file01\\Maintenance\\Python Programs\\SheetPilot"
}
```

### Handsontable Version Lock

```json
// package.json
"handsontable": "^16.1.1",
"@handsontable/react-wrapper": "^16.1.1"
```

**⚠️ DO NOT upgrade to v17.0+ without reviewing deprecation fixes**

---

## Material Design 3 (M3) System

### Design Tokens

All visual properties MUST use M3 design tokens from `m3-tokens.css`:

#### Color Roles

```css
/* Primary colors */
--md-sys-color-primary
--md-sys-color-on-primary
--md-sys-color-primary-container
--md-sys-color-on-primary-container

/* Surface colors */
--md-sys-color-surface
--md-sys-color-on-surface
--md-sys-color-surface-container
--md-sys-color-on-surface-variant

/* Semantic colors */
--md-sys-color-error
--md-sys-color-tertiary
--md-sys-color-secondary
```

#### Typography Scale

```css
/* Headings */
--md-sys-typescale-headline-large    /* 32px / 400 */
--md-sys-typescale-headline-medium   /* 28px / 400 */
--md-sys-typescale-headline-small    /* 24px / 400 */

/* Body */
--md-sys-typescale-body-large        /* 16px / 400 */
--md-sys-typescale-body-medium       /* 14px / 400 */
--md-sys-typescale-body-small        /* 12px / 400 */

/* Labels */
--md-sys-typescale-label-large       /* 14px / 500 */
```

#### Elevation & Shape

```css
/* Elevation (shadows) */
--md-sys-elevation-level0
--md-sys-elevation-level1
--md-sys-elevation-level2

/* Shape (border-radius) */
--md-sys-shape-corner-small          /* 8px */
--md-sys-shape-corner-medium         /* 12px */
--md-sys-shape-corner-large          /* 16px */
--md-sys-shape-corner-full           /* 999px */
```

### State Layers

All interactive elements use M3 state layers:

```css
.interactive-element::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 100ms;
}

.interactive-element:hover::before {
  background: currentColor;
  opacity: 0.08;  /* M3 hover state */
}
```

### Styling Rules

✅ **DO**:

- Use design tokens for ALL visual properties
- Apply M3 classes: `md-typescale-body-large`, `md-button`, etc.
- Use `color-mix()` for state layers: `color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent)`

❌ **DO NOT**:

- Use hardcoded colors in component files
- Use inline `sx` props with colors
- Create custom shadow/elevation values

### Theme Switching

```typescript
import { useTheme } from './hooks/useTheme';

const { themeMode, effectiveTheme, toggleTheme } = useTheme();

// Modes: 'light', 'dark', 'auto'
```

---

## Handsontable Integration

### Module Registration

**REQUIRED** at the top of every file using Handsontable:

```typescript
import { registerAllModules } from 'handsontable/registry';
registerAllModules();
```

### CSS Imports (Modular - v16+)

```typescript
// ✅ CORRECT (modular imports)
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';

// ❌ WRONG (legacy full bundle)
import 'handsontable/dist/handsontable.full.min.css';
```

### Theme Configuration

```typescript
<HotTable
  themeName="ht-theme-horizon"
  licenseKey="non-commercial-and-evaluation"
  // ... other props
/>
```

### Configuration Cascading

Handsontable uses a 3-tier cascading system:

```typescript
// Global Level
<HotTable
  rowHeaders={true}
  contextMenu={['row_above', 'remove_row', 'copy']}
/>

// Column Level (overwrites global)
columns={[
  { data: 'date', type: 'date', dateFormat: 'YYYY-MM-DD' },
  { data: 'project', type: 'dropdown', source: projects }
]}

// Cell Level (overwrites column & global)
cells={(row, col) => {
  if (col === 4 && !projectNeedsTools(rowData?.project)) {
    return { readOnly: true, className: 'htDimmed' };
  }
  return {};
}}
```

### Custom State Management

**⚠️ PersistentState plugin is deprecated (removed in v17.0)**

Use custom hooks instead:

```typescript
// Save state
const handleAfterColumnSort = useCallback((currentSort, newSort) => {
  try {
    localStorage.setItem('sheetpilot_columnSorting', JSON.stringify(newSort));
  } catch (error) {
    console.error('[TimesheetGrid] Could not save column sorting state:', error);
  }
}, []);

// Restore state
useEffect(() => {
  if (!hotTableRef.current?.hotInstance) return;
  const hot = hotTableRef.current.hotInstance;
  
  try {
    const saved = localStorage.getItem('sheetpilot_columnSorting');
    if (saved) {
      const sortPlugin = hot.getPlugin('columnSorting');
      sortPlugin?.setSortConfig(JSON.parse(saved));
    }
  } catch (error) {
    console.error('[TimesheetGrid] Could not load column sorting state:', error);
  }
}, [timesheetDraftData]);
```

### Data Updates

```typescript
// ✅ CORRECT: Preserves UI state (selection, scroll)
const updateTableData = useCallback((newData: TimesheetRow[]) => {
  if (hotTableRef.current?.hotInstance) {
    hotTableRef.current.hotInstance.updateData(newData);
  }
}, []);

// ❌ WRONG: Resets table (loses selection/scroll)
// hotTableRef.current.hotInstance.loadData(newData);
```

### Common Hooks

```typescript
afterChange={(changes, source) => {
  if (!changes || source === 'loadData') return;
  // Handle data changes
}}

beforeValidate={(value, row, prop) => {
  // Custom validation
  return errorMessage || value;
}}

afterValidate={(isValid, value, row, prop) => {
  // Conditional validation rules
  return isValid;
}}
```

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `sheetpilot_columnSorting` | Column sort state |
| `sheetpilot_columnWidths` | Column width preferences |
| `sheetpilot_rowHeights` | Row height preferences |
| `sheetpilot_timesheet_backup` | Data backup with timestamp |

### Sorting Configuration

#### Default Sort Order

The Timesheet grid uses multi-level sorting by default:

```typescript
columnSorting={{
  initialConfig: [
    { column: 0, sortOrder: 'asc' },  // Date: least recent to most recent
    { column: 1, sortOrder: 'asc' }   // Time In: earliest to latest (secondary)
  ],
  indicator: true,
  headerAction: true,
  sortEmptyCells: true
}}
```

**Behavior**:

- Primary sort: Date column (ascending - oldest first)
- Secondary sort: Time In column (ascending - earliest first)
- Empty cells sorted to end
- User can override by clicking column headers

#### State Persistence

Sort configuration is loaded only once on component mount to prevent re-sorting on every user interaction:

```typescript
const hasLoadedInitialStateRef = useRef(false);

useEffect(() => {
  if (!hotTableRef.current?.hotInstance || hasLoadedInitialStateRef.current) return;
  
  const hot = hotTableRef.current.hotInstance;
  hasLoadedInitialStateRef.current = true;
  
  // Load saved sort config from localStorage
  const saved = localStorage.getItem('sheetpilot_columnSorting');
  if (saved) {
    const sortPlugin = hot.getPlugin('columnSorting');
    sortPlugin?.setSortConfig(JSON.parse(saved));
  }
}, []); // Empty dependency array = run once on mount
```

**Key Points**:

- Sort state loads once on mount, not on every data change
- User-initiated sort changes are saved to localStorage
- Prevents table from re-sorting when user edits cells
- Preserves user's preferred sort order across sessions

#### Customizing Sort Order

To change the default sort behavior:

```typescript
// Single column sort
initialConfig: { column: 0, sortOrder: 'desc' }

// Multi-column sort (evaluated in order)
initialConfig: [
  { column: 0, sortOrder: 'asc' },   // Primary
  { column: 1, sortOrder: 'desc' },  // Secondary
  { column: 3, sortOrder: 'asc' }    // Tertiary
]
```

**Column Indices**:

- 0: Date
- 1: Time In
- 2: Time Out
- 3: Project
- 4: Tool
- 5: Charge Code
- 6: Task Description

---

## Auto-Updates

### How It Works

SheetPilot uses `electron-updater` with GitHub Releases for automatic updates:

1. **Startup Check**: App checks GitHub API for new releases
2. **Version Comparison**: Compares installed version with latest release
3. **Background Download**: Downloads new version if available
4. **Verification**: Verifies SHA512 hash of downloaded installer
5. **Auto-Install on Quit**: Installs when user closes app
6. **Automatic Restart**: New version launches after installation

### Configuration

#### package.json

```json
"publish": {
  "provider": "github",
  "owner": "andrewhughesskywater",
  "repo": "Sheetpilot"
}
```

### Publishing a New Release

#### 1. Update Version

```json
// In package.json, increment the version
"version": "1.1.3"
```

**Important**: Do NOT include 'v' prefix in package.json version.

#### 2. Build Application

```bash
npm run build
```

This generates in `build/` directory:

- `Sheetpilot-Setup.exe` - Windows installer
- `Sheetpilot-Setup.exe.blockmap` - Delta update support
- `latest.yml` - Update metadata with SHA512 hashes

#### 3. Create GitHub Release

1. Go to GitHub repository releases
2. Create new tag: `v1.1.3` (note: tag MUST have 'v' prefix)
3. Set release title: `Sheetpilot v1.1.3`
4. Add release notes
5. Upload these files:
   - `Sheetpilot-Setup.exe`
   - `Sheetpilot-Setup.exe.blockmap`
   - `latest.yml`
6. Publish release

**Critical**: Tag must be `v{version}`, package.json must be `{version}` (without 'v').

### Windows-Specific Behavior

#### First-Run File Lock

```typescript
// main.ts handles Squirrel.Windows first-run file lock
if (process.platform === 'win32' && process.argv.includes('--squirrel-firstrun')) {
  appLogger.info('Skipping update check on first run (Squirrel.Windows file lock)');
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 10000);
  return;
}
```

### Event Handlers

```typescript
autoUpdater.on('checking-for-update', () => {
  appLogger.info('Checking for updates');
});

autoUpdater.on('update-available', (info) => {
  appLogger.info('Update available', { version: info.version });
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', (info) => {
  appLogger.info('Update not available');
});

autoUpdater.on('download-progress', (progress) => {
  // Logs download percentage, transferred bytes, total size
});

autoUpdater.on('update-downloaded', (info) => {
  appLogger.info('Update downloaded', { version: info.version });
  // Update installs on app quit
});

autoUpdater.on('error', (err) => {
  appLogger.error('AutoUpdater encountered error', { error: err.message });
});
```

### Testing Updates

#### Local Testing

1. Install older version (e.g., 1.0.0)
2. Create GitHub release for newer version (e.g., 1.0.1)
3. Launch installed application
4. Check logs: `%APPDATA%\sheetpilot\sheetpilot_*.log`

#### Log Inspection

```powershell
# Find latest log file
dir $env:APPDATA\sheetpilot\*.log | sort LastWriteTime -Descending | select -First 1

# Search for update messages
Select-String -Path "$env:APPDATA\sheetpilot\*.log" -Pattern "update|Update|AutoUpdater"
```

### Troubleshooting Updates

| Issue | Solution |
|-------|----------|
| Updates not detected | Verify version incremented in package.json |
| Tag format error | Tag must be `v1.1.3`, package.json must be `1.1.3` |
| Download fails | Check GitHub release is published (not draft) |
| Won't install | Ensure NSIS target (not portable) |
| UAC prompts | Verify `perMachine: false` in nsis config |
| SHA512 mismatch | Rebuild and re-upload all files together |

### Delta Updates

Delta updates download only changed portions of the installer:

- Enabled by default through `.blockmap` files
- Significantly reduces download size for minor updates
- Requires both old and new `.blockmap` files on GitHub

### Security

- All downloads verified with SHA512 hashes stored in `latest.yml`
- All update checks use HTTPS via GitHub API
- Hash mismatch causes download rejection

---

## Performance

### Startup Optimizations

**Goal**: Window shows in < 1 second

#### Dual Logging System

```typescript
// Primary: Local logs (synchronous, fast)
log.transports.file.resolvePathFn = () => path.join(localLogPath, logFileName);
log.transports.file.maxSize = 15 * 1024 * 1024; // 15MB

// Secondary: Network logs (asynchronous, non-blocking)
networkTransport = (message: any) => {
  fs.appendFile(networkLogFile, message.text + '\n', (err) => {
    // Silently fail - network logging should not block app
  });
};
```

### Renderer-to-Main Logging Bridge

Frontend logs are sent to the main process for file logging:

**File:** `src/main/preload.ts`

```typescript
window.logger = {
  error: (message, data?) => ipcRenderer.invoke('log:error', message, data),
  warn: (message, data?) => ipcRenderer.invoke('log:warn', message, data),
  info: (message, data?) => ipcRenderer.invoke('log:info', message, data),
  verbose: (message, data?) => ipcRenderer.invoke('log:verbose', message, data),
  debug: (message, data?) => ipcRenderer.invoke('log:debug', message, data),
  userAction: (action, data?) => ipcRenderer.invoke('log:userAction', action, data)
};
```

**File:** `main.ts`

```typescript
// IPC handlers route renderer logs to main process logger
ipcMain.handle('log:error', (_, message, data) => {
  ipcLogger.error(message, data);
});

ipcMain.handle('log:userAction', (_, action, data) => {
  ipcLogger.info(`User action: ${action}`, data);
});
// ... other log level handlers
```

**Usage in Renderer:**

```typescript
// User interactions
window.logger.userAction('submit-timesheet-clicked');
window.logger.userAction('tab-change', { from: 0, to: 1 });

// Informational
window.logger.info('Submitting timesheet', { rowCount: rows.length });

// Errors
window.logger.error('Timesheet submission error', { error: err.message });
```

**Global Error Handlers:**

```typescript
// File: src/renderer/main.tsx
window.addEventListener('error', (event) => {
  window.logger.error('Uncaught error in renderer', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  window.logger.error('Unhandled promise rejection', {
    reason: event.reason
  });
});
```

**Benefits:**

- Complete audit trail of all user actions
- All frontend errors captured in log files
- Troubleshooting without DevTools open
- Compliance with SOC2/ISO9000 requirements

#### Lazy Database Initialization

```typescript
let schemaEnsured = false;

export function openDb(opts?: BetterSqlite3.Options): BetterSqlite3.Database {
  const db = new DatabaseCtor(DB_PATH, opts);
  
  if (!schemaEnsured) {
    ensureSchemaInternal(db);
    schemaEnsured = true;
  }
  
  return db;
}
```

#### Deferred Background Tasks

```typescript
// Show window FIRST
createWindow();

// Configure updates asynchronously
setImmediate(() => {
  configureAutoUpdater();
  checkForUpdates();
});
```

### Performance Metrics

- **Time to Window**: < 1 second
- **Blocking Operations**: 0 (all deferred or async)
- **Network Timeouts**: No impact on startup

---

## Coding Standards

### Logging Language Standards

#### Active Voice

✅ **DO**: "Could not connect to database"  
❌ **AVOID**: "Connection failed"

#### Tense Rules

| Context | Tense | Example |
|---------|-------|---------|
| Current states | Present | "Database unavailable" |
| Completed actions | Past | "Database initialized successfully" |
| Ongoing actions | Present continuous | "Checking for updates" |

#### Error Verbs

| ❌ Avoid | ✅ Use |
|---------|--------|
| "Failed to load" | "Could not load" |
| "Failed to save" | "Could not save" |
| "Error occurred" | "Encountered error" |

#### Examples

```typescript
// ✅ CORRECT
logger.error('Could not load credentials');
logger.info('Checking for updates');
logger.info('Database initialized successfully');

// ❌ WRONG
logger.error('Failed to load credentials');
logger.info('Update checking');
logger.info('Database was initialized');
```

### File Organization

- **One class per file** [[memory:4983670]]
- **Build in isolation** - Each component self-contained
- **Small files** - Keep files focused and manageable

### Naming Conventions

```typescript
// Contracts (not interfaces) for external services
export type TimesheetContract = { /* ... */ };

// Components: PascalCase
export function TimesheetGrid() { /* ... */ }

// Utilities: camelCase
export function getToolOptions() { /* ... */ }

// Constants: UPPER_SNAKE_CASE
export const DB_PATH = '...';
```

### Error Handling

```typescript
// Always include context
logger.error('Could not save timesheet entry', { 
  error: err.message,
  rowId: row.id
});

// Use try-catch for async operations
try {
  await window.timesheet.submitTimesheet(rows);
} catch (error) {
  logger.error('Could not submit timesheet', { error });
}
```

---

## Error Handling

### Overview

SheetPilot uses structured error handling with domain-specific error classes to improve error tracking, logging, and debugging. All errors follow ISO9000 and SOC2 compliance standards.

### Error Architecture

All errors extend `AppError` from `app/shared/errors.ts` with these properties:

- **code**: Programmatic error identifier (e.g., `DB_CONNECTION_ERROR`)
- **message**: Human-readable error message
- **category**: Error category for filtering/monitoring
- **context**: Additional structured data
- **timestamp**: ISO 8601 timestamp

```typescript
abstract class AppError extends Error {
    readonly code: string;
    readonly context: Record<string, unknown>;
    readonly timestamp: string;
    readonly category: ErrorCategory;
}
```

### Error Categories

| Category | Use Case |
|----------|----------|
| `database` | Database connection, query, transaction errors |
| `credentials` | Credential storage, retrieval, authentication |
| `submission` | Timesheet submission failures |
| `validation` | Input validation errors |
| `network` | Network connectivity issues |
| `ipc` | Inter-process communication errors |
| `configuration` | Configuration/setup errors |
| `business_logic` | Business rule violations |
| `system` | System-level errors |

### Error Classes

#### Database Errors

```typescript
DatabaseConnectionError    // Connection failed
DatabaseQueryError         // Query execution failed
DatabaseSchemaError        // Schema initialization failed
DatabaseTransactionError   // Transaction rollback
```

#### Credentials Errors

```typescript
CredentialsNotFoundError      // Credentials not found
CredentialsStorageError       // Failed to store credentials
CredentialsRetrievalError     // Failed to retrieve credentials
InvalidCredentialsError       // Invalid credentials provided
```

#### Submission Errors

```typescript
SubmissionServiceUnavailableError  // Service unavailable
SubmissionFailedError               // Submission failed
NoEntriesToSubmitError              // No entries to submit
```

#### Validation Errors

```typescript
InvalidDateError          // Invalid date format
InvalidTimeError          // Invalid time format
RequiredFieldError        // Required field missing
InvalidFieldValueError    // Invalid field value
```

### Usage Patterns

#### Throwing Errors

```typescript
import { CredentialsNotFoundError, DatabaseQueryError } from '../../shared/errors';

// Provide context
if (!credentials) {
  throw new CredentialsNotFoundError('smartsheet', {
    email: userEmail,
    action: 'retrieve'
  });
}
```

#### Catching Errors

```typescript
import { isAppError, createUserFriendlyMessage } from '../../shared/errors';

try {
  const result = await submitTimesheet();
} catch (err: unknown) {
  if (isAppError(err)) {
    logger.error('Operation failed', {
      code: err.code,
      category: err.category,
      context: err.context
    });
    return { error: err.toUserMessage() };
  }
  
  // Handle unknown errors
  const errorMessage = createUserFriendlyMessage(err);
  return { error: errorMessage };
}
```

#### IPC Error Handling

```typescript
ipcMain.handle('credentials:store', async (_event, service, email, password) => {
  try {
    return storeCredentials(service, email, password);
  } catch (err: unknown) {
    if (isAppError(err)) {
      ipcLogger.security('credentials-storage-error', 'Could not store credentials', {
        code: err.code,
        service,
        context: err.context
      });
      return { success: false, error: err.toUserMessage() };
    }
    return { success: false, error: 'Unknown error occurred' };
  }
});
```

### Utility Functions

```typescript
// Error extraction
extractErrorMessage(error)      // Get error message
extractErrorCode(error)         // Get error code
extractErrorContext(error)      // Get error context

// Error checking
isAppError(error)               // Check if AppError
isDatabaseError(error)          // Check if DatabaseError
isCredentialsError(error)       // Check if CredentialsError
isRetryableError(error)         // Check if error is retryable
isSecurityError(error)          // Check if security concern

// User-friendly messages
createUserFriendlyMessage(error)  // Create user-friendly message
```

### Best Practices

✅ **DO**:

- Always provide context when throwing errors
- Use appropriate error types for the domain
- Log with structured data (code, category, context)
- Handle security errors with special logging
- Return user-friendly messages to UI

❌ **DO NOT**:

- Use generic `Error` for application errors
- Log sensitive data in error context
- Return technical error details to users

### Compliance

**ISO9000/SOC2 Requirements:**

- All errors include ISO 8601 timestamp for audit trail
- Error codes enable programmatic handling
- Context provides debugging information
- Security errors logged separately

```typescript
// Security event logging
if (isCredentialsError(error)) {
  logger.security('credentials-access-violation', message, context);
}
```

---

## Testing Strategy

### Overview

SheetPilot uses a comprehensive, multi-layered testing strategy designed to prevent regressions and ensure code quality. The strategy includes contract validation, unit tests, integration tests, and E2E tests organized in tiers for both speed and comprehensive coverage.

### Test Organization

```
app/backend/tests/
├── contracts/          # Contract validation tests
├── unit/              # Fast unit tests for business logic
├── smoke/             # Quick smoke tests for CI/CD
├── fixtures/          # Reusable test data
├── helpers/           # Test utilities and builders
├── services/          # Service-specific tests
└── vitest.config.*.ts # Test configurations

app/frontend/tests/
├── components/        # Component tests
├── setup.ts          # Test setup
└── vitest.config.ts  # Frontend test config
```

### Test Tiers

1. **Smoke Tests** (~10s): Critical path validation
2. **Unit Tests** (~30s): Business logic, validation, utilities
3. **Integration Tests** (~2min): IPC handlers, database operations, plugin system
4. **E2E Tests** (~5min): Full workflows with mocked external services

### Test Types

#### 1. Contract Tests

**Purpose**: Prevent breaking changes to data contracts between layers

**Files**:
- `tests/contracts/ipc-contracts.spec.ts` - IPC payload schemas
- `tests/contracts/database-schema.spec.ts` - Database schema integrity
- `tests/contracts/plugin-contracts.spec.ts` - Plugin interface implementations
- `tests/contracts/renderer-main-contracts.spec.ts` - Renderer-main communication

**Key Validations**:
- IPC handler signatures match renderer expectations
- Database schema matches TypeScript interfaces
- Plugin implementations satisfy required contracts
- Time/date format consistency across layers

#### 2. Unit Tests

**Purpose**: Protect critical business rules from modification

**Files**:
- `tests/unit/validation-rules.spec.ts` - All validation logic
- `tests/unit/dropdown-cascading.spec.ts` - Dropdown dependency rules
- `tests/unit/quarter-validation.spec.ts` - Quarter availability logic
- `tests/unit/time-normalization.spec.ts` - Time format conversions
- `tests/unit/date-normalization.spec.ts` - Date format conversions

**Critical Rules Tested**:
- Date validation (mm/dd/yyyy format, valid dates, quarter availability)
- Time validation (HH:MM or numeric, 15-minute increments)
- Time out > time in validation
- Project → Tool → ChargeCode cascading
- Required field validation
- Database constraints

#### 3. Integration Tests

**Purpose**: Validate layer interactions and workflows

**Files**:
- `tests/ipc-handlers-comprehensive.spec.ts` - IPC communication
- `tests/ipc-workflow-integration.spec.ts` - Full workflows
- `tests/database.spec.ts` - Database operations
- `tests/timesheet_submission_integration.spec.ts` - E2E submission

**Test Patterns**:

```typescript
// Lifecycle testing
describe('Browser Lifecycle', () => {
  it('validates start() initializes browser', async () => {
    await orchestrator.start();
    expect(orchestrator.browser).toBeDefined();
  });
  
  it('validates operations fail without start()', async () => {
    await expect(orchestrator.run_automation()).rejects.toThrow();
  });
});

// Integration testing
it('validates complete timesheet submission workflow', async () => {
  await window.timesheet.saveDraft(draftEntry);
  const result = await window.timesheet.submitTimesheet(rows);
  const remaining = await window.timesheet.getPendingDrafts();
  expect(remaining).toHaveLength(0);
});
```

#### 4. Smoke Tests

**Purpose**: Fast validation for CI/CD pipeline

**File**: `tests/smoke/critical-paths.spec.ts`

**Critical Paths** (must complete in <10s):
- Application launches without errors
- Database schema initializes correctly
- IPC handlers register successfully
- TimesheetGrid renders with blank row
- Basic validation rules work
- Save/load draft IPC calls succeed

### Running Tests

```bash
# All tests
npm test

# Specific test types
npm run test:smoke          # Smoke tests only
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests only
npm run test:contracts      # Contract tests only

# Development
npm run test:watch          # Watch mode
npm test -- database.spec.ts  # Specific suite
npm test -- --coverage      # With coverage
```

### Test Infrastructure

**Files**:
- `tests/fixtures/timesheet-data.ts` - Reusable test data
- `tests/fixtures/in-memory-db-mock.ts` - In-memory database for tests
- `tests/helpers/test-builders.ts` - Builder pattern for test data
- `tests/helpers/markdown-reporter.ts` - Test result reporting
- `tests/vitest.config.smoke.ts` - Smoke test configuration
- `tests/vitest.config.integration.ts` - Integration test configuration
- `tests/vitest.config.e2e.ts` - E2E test configuration

### AI Regression Protection

The test suite is designed to prevent AI-induced regressions:

1. **Contract Guards**: Schema and interface validation
2. **Business Rule Guards**: Validation matrix testing
3. **Data Integrity Guards**: Round-trip testing
4. **UI Behavior Guards**: Event handler verification

### Success Metrics

- **Contract Tests**: 100% coverage of all interfaces and schemas
- **Business Logic**: 100% coverage of validation and cascading rules
- **Component Tests**: 90%+ coverage of UI components
- **Integration Tests**: All critical workflows covered
- **E2E Tests**: All user journeys covered
- **Smoke Tests**: Complete in <10 seconds
- **Full Suite**: Complete in <8 minutes

### CI/CD Integration

```yaml
# Smoke tests run on every commit
- run: npm run test:smoke

# Full test suite on PRs
- run: npm run test:all
```

### Best Practices

1. Always run smoke tests before committing
2. Update test data when business rules change
3. Add new tests for any new business logic
4. Keep test execution times within limits
5. Use descriptive test names and assertions
6. Mock external dependencies appropriately
7. Validate both success and failure scenarios

---

## Dependency Validation

### Overview

The dependency validation system catches missing or misplaced dependencies **before** running a full build, saving time by identifying issues early rather than discovering them one-by-one during the build process.

### Quick Start

#### Run Validation

```bash
# Manual validation
npm run validate:deps

# Automatic validation (runs before build)
npm run build          # Validates first, then builds
npm run build:dir      # Validates first, then builds to directory
```

#### Skip Validation (Not Recommended)

```bash
npm run build:main && npm run build:renderer && npm run build:bot && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder
```

### What Gets Checked

| Check | Description | Fix |
|-------|-------------|-----|
| **Dependency Locations** | All deps in correct node_modules | `npm install` |
| **Native Modules** | better-sqlite3 rebuilt for Electron | `npm run rebuild` |
| **Peer Dependencies** | electron-log available for shared package | `npm install` |
| **Shared Package** | Workspace links configured | Verify package.json |
| **Build Output** | Compiled files exist | `npm run build:main/renderer/bot` |
| **Builder Config** | electron-builder patterns valid | Check package.json build section |

### Understanding Workspace Hoisting

This project uses **npm workspaces**, which automatically hoists shared dependencies to the root `node_modules/` for optimization. This is **normal and expected** behavior.

```text
✅ electron-log hoisted to root (workspace optimization)
✅ better-sqlite3 hoisted to root (workspace optimization)
```

**This is SUCCESS, not a warning!** No action needed.

**Why this matters:** Electron-builder includes both root and workspace node_modules patterns, so hoisted dependencies are bundled correctly.

### Dependency Locations

- **Root dependencies**: Hoisted to root `node_modules/` (workspace optimization)
- **Backend dependencies**: In `app/backend/node_modules/` or hoisted to root
- **Bot service dependencies**: In `app/backend/src/services/bot/node_modules/`

### Native Modules

Native Node.js modules must be rebuilt for Electron:

```bash
# Rebuild native modules
npm run rebuild
```

**Why this matters:** Native modules compiled for Node.js have different ABIs than Electron. Using non-rebuilt modules causes crashes like "Module version mismatch".

### Understanding Output

#### Success (Green ✅)

```text
✅ better-sqlite3 found at root level
✅ electron-log hoisted to root (workspace optimization)
✅ playwright found in bot service node_modules
✅ Main entry point (main.js) exists
```

Everything is correct. Continue with build.

#### Warning (Yellow ⚠️)

```text
⚠️ WARNING: playwright found in backend but should be in bot service node_modules
⚠️ WARNING: Build directory does not exist yet. Run `npm run build:main` first.
```

Not critical, but may indicate issues. Review and decide if action is needed.

#### Error (Red ❌)

```text
❌ ERROR: better-sqlite3 not found in backend or root node_modules
❌ ERROR: better-sqlite3 exists but is not rebuilt for Electron. Run: npm run rebuild
❌ ERROR: Main entry point (build/dist/backend/src/main.js) does not exist
```

Critical issues that will cause build failures. Must be fixed before building.

### Common Scenarios

#### Fresh Clone

```bash
git clone <repo>
cd sheetpilot
npm install
npm run validate:deps
```

**Expected warnings:**
- Build directory does not exist (run `npm run build:main`)
- Frontend not built (run `npm run build:renderer`)
- Bot service not built (run `npm run build:bot`)

**These are normal.** Run the build commands or just run `npm run build`.

#### After Adding New Dependency

```bash
# Add dependency to correct location
npm install --workspace=@sheetpilot/backend <package>

# Or for bot service
cd app/backend/src/services/bot
npm install <package>

# Validate it's in the right place
npm run validate:deps
```

#### Native Module Issues

```bash
# If you see: "better-sqlite3 not rebuilt for Electron"
npm run rebuild
npm run validate:deps  # Should now pass
```

### Exit Codes

- **0**: Validation passed (or warnings only)
- **1**: Critical errors found - build will fail

### CI/CD Integration

```yaml
# .github/workflows/build.yml
- name: Install dependencies
  run: npm install

- name: Validate dependencies
  run: npm run validate:deps

- name: Build application
  run: npm run build
```

This ensures builds fail fast with clear error messages rather than obscure bundling errors.

### Performance

- Typical runtime: 2-5 seconds
- No network requests (uses local files only)
- Safe to run frequently

### When to Run

✅ **Run validation:**
- Before first build after cloning
- After adding new dependencies
- After npm install/update
- Before committing build config changes
- When build fails with dependency errors

❌ **Skip for:**
- Every code change (only run when dependencies change)

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Validation script fails | Ensure running from project root |
| False positives | Run `npm install` to ensure all deps installed |
| Performance slow | Large node_modules slow checks, consider skipping npm audit |

---

## Deployment

### Build Process

```bash
# 1. Clean previous builds
npm run clean

# 2. Install dependencies (if needed)
npm install

# 3. Validate dependencies (optional, runs automatically)
npm run validate:deps

# 4. Build the application
npm run build
```

### Verify Build

✅ Check `build/` directory contains:

- `Sheetpilot Setup X.X.X.exe` (NOT portable)
- `latest.yml`
- Version matches `package.json`

### Deploy to Network Drive

```powershell
$networkPath = "\\swfl-file01\Maintenance\Python Programs\SheetPilot"
$version = "1.1.2"

Copy-Item "build\Sheetpilot Setup $version.exe" $networkPath
Copy-Item "build\latest.yml" $networkPath
```

### Verify Deployment

1. Confirm files on network drive
2. Verify `latest.yml` shows correct version
3. Check file permissions (users need read access)

### Rollback Procedure

1. Remove problematic installer from network drive
2. Copy previous `latest.yml` back
3. Users will download previous version on next check

---

## Troubleshooting

### Common Issues

#### Handsontable cells not clickable

**Symptom**: Cannot click cells to edit  
**Fix**: Ensure `readOnly={false}` on HotTable

```typescript
<HotTable
  readOnly={false}
  fillHandle={true}
  autoWrapRow={true}
  // ...
/>
```

#### Archive cells show selection

**Symptom**: Archive cells highlight on click  
**Fix**: Set proper non-editable config

```typescript
<HotTable
  readOnly={true}
  disableVisualSelection={true}
  selectionMode="none"
  contextMenu={false}
  // ...
/>
```

#### Auto-updates not working

**Symptom**: Updates not detected or installed  
**Fixes**:

1. Verify NSIS target (not portable)
2. Check version incremented in package.json
3. Verify network path accessible
4. Check `latest.yml` references correct filename

#### Styling not applying

**Symptom**: Custom styles not showing  
**Fixes**:

1. Verify import order in `index.css`:

   ```css
   @import './m3-tokens.css';
   @import './m3-components.css';
   @import './m3-mui-overrides.css';
   ```

2. Check for hardcoded colors (should use tokens)
3. Ensure `data-theme` attribute on `<html>`

#### Database errors on startup

**Symptom**: Database operations fail  
**Fixes**:

1. Check database file permissions
2. Verify SQLite path accessible
3. Check schema initialization in logs

#### Playwright automation fails

**Symptom**: "Page is not available; call start() first"  
**Fix**: Ensure `start()` called before `run_automation()`

```typescript
await orchestrator.start();
try {
  await orchestrator.run_automation(rows, credentials);
} finally {
  await orchestrator.close();
}
```

### Debug Logging

Enable verbose logging:

```typescript
// In development
logger.level = 'debug';

// Check specific components
logger.debug('[TimesheetGrid] Cell changed', { row, col, value });
logger.verbose('[AutoUpdater] Checking for updates');
```

### Performance Issues

If app feels slow:

1. Check network log path latency
2. Verify database operations async
3. Check for memory leaks (browser instances)
4. Review Handsontable data size

### Sophos Antivirus Configuration

**Issue:** Sophos may flag SheetPilot as malicious due to browser automation features.

**Solution: Add Exclusions**

1. Navigate to Sophos Central > Global Settings > Exclusions
2. Add path exclusions:
   - `C:\Users\*\AppData\Local\Programs\Sheetpilot\**`
   - `C:\Users\*\AppData\Roaming\SheetPilot\**`
3. Add process exclusion: `Sheetpilot.exe`
4. Scope: All scanning (on-access, on-demand)

**Verification:**

- Reinstall or run SheetPilot
- Monitor Sophos Events log to confirm no further detections

**Alternative: Submit False Positive Report**

If exclusions are not feasible, submit report to Sophos:

1. Visit: <https://support.sophos.com/support/s/filesubmission>
2. Provide information:
   - **Application**: Sheetpilot.exe
   - **Developer**: SheetPilot Team
   - **Purpose**: Business timesheet management and automation
   - **Detection**: "Lockdown" behavioral prevention
   - **Justification**: Legitimate Electron-based business application using Playwright for SmartSheet integration

**Technical Details:**

The "Lockdown" detection is a false positive triggered by:

- Browser automation behavior patterns
- Network file operations
- Unsigned executable status

SheetPilot is a legitimate business application for timesheet management and does not perform malicious activities.

---

## Quick Reference

### Essential Commands

```bash
npm run dev          # Development mode
npm test             # Run all tests
npm run build        # Production build
npm run clean        # Clean build artifacts
```

### Key Files

| File | Purpose |
|------|---------|
| `main.ts` | Main process entry |
| `src/services/database.ts` | Database layer |
| `src/renderer/src/App.tsx` | Main React component |
| `src/renderer/src/m3-tokens.css` | Design tokens |
| `package.json` | Dependencies & build config |

### Critical Patterns

1. **Always use M3 tokens** for styling
2. **Register Handsontable modules** before use
3. **Use modular CSS imports** for Handsontable
4. **Call `start()` before browser automation**
5. **Use dual logging** (local + network)
6. **Lazy initialize** heavy resources
7. **Use `updateData()`** not `loadData()`
8. **Handle errors with "Could not..."** not "Failed to..."

### Support Resources

- [Material Design 3](https://m3.material.io/)
- [Handsontable Docs](https://handsontable.com/docs/javascript-data-grid/)
- [Electron Docs](https://www.electronjs.org/docs/latest)
- [electron-updater](https://www.electron.build/auto-update)

---

## Fast Development Mode

### Performance Improvements Summary

#### Before Optimizations

- **First Start**: ~30-60 seconds
- **Subsequent Starts**: ~30-60 seconds (no caching)
- **File Change**: Manual restart required

#### After Optimizations

1. **TypeScript Incremental Compilation**: 50-80% faster on subsequent builds
2. **Skip Native Module Rebuild**: 5-15 seconds saved per start
3. **esbuild**: 10-100x faster than TypeScript compiler
4. **Watch Mode**: 0.5-2 second restart on file changes

### Available Development Modes

#### 1. `npm run dev` - Standard Mode (Recommended for Most Use)

**Uses**: TypeScript compiler with incremental compilation

```bash
npm run dev
```

**Features**:

- Full TypeScript type-checking during build
- Incremental compilation caches unchanged files
- Skips native module rebuild (now happens only during `npm install`)
- Best for: Regular development with type safety

**Speed**:

- First run: ~15-25 seconds
- Subsequent runs: ~5-10 seconds (with incremental cache)

#### 2. `npm run dev:watch` - Ultra-Fast Watch Mode ⚡

**Uses**: esbuild + nodemon for automatic restarts

```bash
npm run dev:watch
```

**Features**:

- **Lightning-fast compilation** with esbuild (10-100x faster than tsc)
- **Auto-restart** when files change (no manual restart needed)
- **Live reload** - just save your file and Electron restarts automatically
- Runs 3 processes concurrently:
  1. Vite (frontend dev server)
  2. esbuild in watch mode (backend compilation)
  3. Nodemon (auto-restart Electron on changes)

**Speed**:

- Initial build: ~2-5 seconds
- File change rebuild: ~0.5-2 seconds
- Best for: Active development with frequent changes

**How it works**:

1. esbuild watches `app/backend/src` and `app/shared`
2. When you save a `.ts` file, esbuild recompiles it instantly
3. Nodemon detects the compiled `.js` file change
4. Electron automatically restarts with your changes

**Type-checking**:

- esbuild only transpiles TypeScript (doesn't type-check)
- Run `npm run type-check` periodically to catch type errors
- Or enable TypeScript checking in your IDE (VS Code, etc.)

### Recommended Workflow

#### For Active Development (Making Lots of Changes)

```bash
npm run dev:watch
```

- Ultra-fast hot reload
- Save file → Auto restart in ~1 second
- Run `npm run type-check` before committing

#### For Occasional Development or Debugging

```bash
npm run dev
```

- Full type-checking during build
- More stable for debugging
- Catches type errors immediately

#### Before Committing

```bash
npm run type-check
npm run lint
npm test
```

### Troubleshooting Fast Dev Mode

#### "Module not found" errors

If you see module resolution errors after switching between modes:

```bash
npm run clean
npm install
```

#### Native module errors (better-sqlite3)

If Electron crashes with native module errors:

```bash
npm run rebuild
```

#### esbuild not updating

If watch mode isn't detecting changes:

1. Stop `npm run dev:watch` (Ctrl+C)
2. Clear build: `npm run clean`
3. Restart: `npm run dev:watch`

#### Type errors not showing

Remember: esbuild doesn't type-check! Run:

```bash
npm run type-check
```

### Performance Comparison

| Mode | Initial Build | File Change | Type-Checking | Auto-Restart |
|------|--------------|-------------|---------------|--------------|
| **Old `dev`** | 30-60s | Manual restart | ✅ Yes | ❌ No |
| **New `dev`** | 5-10s | Manual restart | ✅ Yes | ❌ No |
| **`dev:watch`** | 2-5s | 0.5-2s | ❌ No* | ✅ Yes |

*Use `npm run type-check` for type-checking with `dev:watch` mode

---

## Architecture Documentation Guide

### Architecture Files

This project includes comprehensive XML documentation of the application architecture:

- `docs/app-architecture-hierarchical.xml` - File structure and component responsibilities
- `docs/app-architecture-dataflow.xml` - Operation flows and data transformations

### Quick Architecture Navigation

**I want to understand...**

- 🔐 **How authentication works** → See authentication flows in dataflow XML
- 📊 **How timesheet data flows** → See timesheet operations in dataflow XML
- 🤖 **How automated submission works** → See browser automation flows
- 🔌 **How the plugin system works** → See plugin system in hierarchical XML
- 💾 **How data is persisted** → See data persistence patterns
- 🔄 **How IPC communication works** → See IPC communication patterns

### Common Architecture Tasks

#### Understanding Authentication

**Files involved**:

- `frontend/components/LoginDialog.tsx` - Login UI
- `frontend/contexts/SessionContext.tsx` - Session state management
- `backend/src/main.ts` - Auth IPC handlers
- `backend/src/services/database.ts` - Session persistence

**Key concepts**:

- Admin login bypasses credential storage
- Session tokens stored in localStorage
- Sessions table tracks expiry

#### Understanding Timesheet Operations

**Files involved**:

- `frontend/components/timesheet/TimesheetGrid.tsx` - Grid UI
- `frontend/contexts/DataContext.tsx` - Draft data state
- `backend/src/main.ts` - Timesheet IPC handlers
- `backend/src/services/database.ts` - Timesheet CRUD

**Data transformations**:

- Database: `{ time_in: 480, time_out: 1020 }` (minutes since midnight)
- Grid: `{ timeIn: "08:00", timeOut: "17:00" }` (HH:MM format)

#### Understanding Browser Automation

**Files involved**:

- `backend/src/services/timesheet-importer.ts` - Submission orchestrator
- `backend/src/services/plugins/playwright-bot-service.ts` - Bot service
- `backend/src/services/bot/src/bot_orchestation.ts` - Browser coordinator
- `backend/src/services/bot/src/authentication_flow.ts` - Web portal login
- `backend/src/services/bot/src/webform_flow.ts` - Form filling logic

**Key concepts**:

- Entries grouped by quarter (different forms per quarter)
- Playwright runs in headless mode
- Entries marked as 'in_progress' during submission
- Failed entries revert to NULL status (pending)
- Successful entries marked as 'Complete' with timestamp

### Three-Layer Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Renderer)                      │
│  React UI • Handsontable • MUI • Context API • localStorage │
│                                                              │
│  Files: frontend/src/{components,contexts,hooks,utils}      │
│  Role: User interface and client-side state management      │
└──────────────────────┬───────────────────────────────────────┘
                       │ IPC Bridge (preload.ts)
                       │ Type-safe communication
┌──────────────────────▼───────────────────────────────────────┐
│                     BACKEND (Main Process)                    │
│  Node.js • Electron • SQLite • Playwright • Plugin System   │
│                                                              │
│  Files: backend/src/{main.ts,services,repositories,bot}     │
│  Role: Business logic, database, file I/O, automation       │
└──────────────────────┬───────────────────────────────────────┘
                       │ Shared contracts and utilities
┌──────────────────────▼───────────────────────────────────────┐
│                     SHARED (Common Code)                      │
│  Interfaces • Plugin Registry • Logger • Error Classes       │
│                                                              │
│  Files: shared/{contracts,plugin-*,logger,errors}           │
│  Role: Type definitions, plugin system, cross-layer utils   │
└───────────────────────────────────────────────────────────────┘
```

---

## Feature Documentation

### Timesheet Overlap Validation

#### Overview

Validation to detect and prevent duplicate/overlapping time entries on the same date.

#### Validation Rules

**What is Rejected:**

1. **Overlapping time ranges** on the same date
   - Example: Entry A `09:00-12:00` overlaps with Entry B `11:00-14:00` ❌

2. **Exact duplicate entries** on the same date  
   - Example: Two entries with `09:00-12:00` on `01/15/2024` ❌

**What is Allowed:**

1. **Adjacent time ranges** (no overlap at boundaries)
   - Example: Entry A `09:00-12:00` followed by Entry B `12:00-15:00` ✅

2. **Overlapping times on different dates**
   - Example: `09:00-12:00` on `01/15/2024` and `09:00-12:00` on `01/16/2024` ✅

#### First-In Rule

When overlaps are detected:

- The **first entry** (earlier row) is always accepted
- The **second entry** (later row) is rejected with an error message
- Error message: "The time range you entered overlaps with a previous entry, please adjust your entry accordingly"

#### Validation Timing

- Validates when the user **moves to another cell** (on blur)
- Does not validate while actively typing
- Checks both `timeIn` and `timeOut` field changes

#### Implementation

**Files:**

- `timesheet.schema.ts` - Overlap detection functions
- `timesheet.validation.ts` - Field validation logic
- `TimesheetGrid.tsx` - Handsontable validators
- `timesheet-overlap-validation.spec.ts` - Test suite (33 tests)

**Key Functions:**

- `timeRangesOverlap()` - Checks if two time ranges overlap
- `hasTimeOverlapWithPreviousEntries()` - Checks current row against all previous rows
- `validateField()` - Enhanced for `timeIn` and `timeOut` with overlap checking

---

## Changelog

All notable changes to this project are documented here.

### [1.4.0] - 2025-11-04

#### Fixed

- **Duplicate initialization logs in development mode**: Implemented global initialization guard (`window.__appInitialized`) to prevent duplicate module-level initializations caused by Hot Module Replacement (HMR) and React StrictMode double-renders
  
- **Electron CSP security warning**: Removed `'unsafe-eval'` from Content-Security-Policy. CSP now enforces strict security without allowing unsafe evaluations

- **Excessive console logging**: Replaced console.log with console.debug, gated behind `process.env.NODE_ENV === 'development'` checks

#### Added

- **Safe initialization utility** (`app/frontend/src/utils/safe-init.ts`): New utility providing `runOnce()` function for idempotent initialization

- **Development smoke test scripts**:
  - `scripts/dev-smoke.sh` (Linux/Mac)
  - `scripts/dev-smoke.ps1` (Windows)

#### Security

- **Hardened Content-Security-Policy**: Removed `'unsafe-eval'`, explicit `object-src 'none'`

- **Electron security settings verified**:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webSecurity: true`
  - `allowRunningInsecureContent: false`

### [1.3.6] - 2025-10-30

#### Scope

Fix production build error for electron-updater

#### Fixes

- Fixed "Cannot find module 'electron-updater'" error in production builds
- Added `app/backend/package.json` to electron-builder files list
- Added `app/backend/src/services/bot/package.json` to electron-builder files list
- Configured `asarUnpack` to unpack electron-updater from app.asar (required for native binaries)

#### Developer Notes

- electron-updater requires native binaries that must be unpacked from app.asar
- Backend dependencies properly packaged via package.json files inclusion
- All subdirectory package.json files now included for proper module resolution

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-08 | Initial consolidated wiki |
| 1.1 | 2025-10-20 | Added Handsontable sorting configuration documentation |
| 2.0 | 2025-10-22 | Comprehensive consolidation: Updated auto-updates (GitHub), added plugin architecture, expanded logging system, added Sophos configuration |
| 3.0 | 2025-11-03 | Final consolidation: Added Error Handling, expanded Testing Strategy, added Dependency Validation sections |
| 4.0 | 2025-11-12 | Merged documentation: Added Fast Development Mode, Architecture Documentation Guide, Feature Documentation (Overlap Validation), and Changelog |

**Consolidated from**:

- AUTO_UPDATER.md
- DEPENDENCY_VALIDATION.md
- DEPENDENCY_VALIDATION_QUICKREF.md
- ERROR_HANDLING_GUIDE.md
- HANDSONTABLE_REQUIREMENTS.md
- IMPLEMENTATION_SUMMARY.md (Plugin Architecture)
- LOGGING_IMPROVEMENTS.md
- PERFORMANCE_OPTIMIZATION_SUMMARY.md
- PLUGIN_ARCHITECTURE_PROGRESS.md
- SOPHOS_CONFIGURATION.md
- TESTING_STRATEGY.md
- TIMESHEET_FIXES_DOCUMENTATION.md
- FAST_DEV_MODE.md
- ARCHITECTURE_DOCS.md
- timesheet-overlap-validation.md
- CHANGELOG.md

**Maintained by**: Development Team

---

**Need to add something?** Update this wiki when implementing new features or fixing bugs.  
**Found an error?** Verify with source documentation and update accordingly.
