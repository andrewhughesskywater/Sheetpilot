# SheetPilot Developer Wiki

**Last Updated**: October 8, 2025  
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
9. [Testing Strategy](#testing-strategy)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

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
    ├── business-logic/             # Pure business logic
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

- `src/renderer/business-logic/timesheet-validation.ts` - All validation rules
- `src/renderer/business-logic/dropdown-logic.ts` - Cascading dropdown rules
- `src/renderer/business-logic/timesheet-normalization.ts` - Data normalization

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

## Testing Strategy

### Test Structure

```
__tests__/
├── database.spec.ts                    # Database operations
├── ipc-handlers-comprehensive.spec.ts  # IPC communication
├── ipc-workflow-integration.spec.ts    # Full workflows
├── service-layer-edge-cases.spec.ts    # Edge cases
└── timesheet_submission_integration.spec.ts # E2E submission
```

### Running Tests

```bash
# All tests
npm test

# Specific suite
npm test -- database.spec.ts

# With coverage
npm test -- --coverage

# Watch mode (development)
npm test -- --watch
```

### Test Patterns

#### Lifecycle Testing

```typescript
describe('Browser Lifecycle', () => {
  it('validates start() initializes browser', async () => {
    await orchestrator.start();
    expect(orchestrator.browser).toBeDefined();
  });
  
  it('validates operations fail without start()', async () => {
    await expect(orchestrator.run_automation()).rejects.toThrow();
  });
  
  it('validates close() cleans up resources', async () => {
    await orchestrator.start();
    await orchestrator.close();
    expect(orchestrator.browser).toBeNull();
  });
});
```

#### Integration Testing

```typescript
it('validates complete timesheet submission workflow', async () => {
  // 1. Insert draft data
  await window.timesheet.saveDraft(draftEntry);
  
  // 2. Submit via IPC
  const result = await window.timesheet.submitTimesheet(rows);
  
  // 3. Verify database state
  const remaining = await window.timesheet.getPendingDrafts();
  expect(remaining).toHaveLength(0);
});
```

### Test Coverage Goals

- **Critical paths**: >80%
- **Execution time**: <5 minutes
- **Flakiness rate**: <1%

---

## Deployment

### Build Process

```bash
# 1. Clean previous builds
npm run clean

# 2. Install dependencies (if needed)
npm install
cd src/renderer && npm install && cd ../..

# 3. Build the application
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

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-08 | Initial consolidated wiki |
| 1.1 | 2025-10-20 | Added Handsontable sorting configuration documentation |
| 2.0 | 2025-10-22 | Comprehensive consolidation: Updated auto-updates (GitHub), added plugin architecture, expanded logging system, added Sophos configuration |

**Consolidated from**:

- AUTO_UPDATER.md
- HANDSONTABLE_REQUIREMENTS.md
- IMPLEMENTATION_SUMMARY.md (Plugin Architecture)
- LOGGING_IMPROVEMENTS.md
- PERFORMANCE_OPTIMIZATION_SUMMARY.md
- PLUGIN_ARCHITECTURE_PROGRESS.md
- SOPHOS_CONFIGURATION.md
- TIMESHEET_FIXES_DOCUMENTATION.md

**Maintained by**: Development Team

---

**Need to add something?** Update this wiki when implementing new features or fixing bugs.  
**Found an error?** Verify with source documentation and update accordingly.
