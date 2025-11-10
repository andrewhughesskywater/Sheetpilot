# SheetPilot Architecture Documentation

This directory contains comprehensive XML documentation of the SheetPilot application architecture, designed for AI assistant consumption and developer understanding. This document serves as your **companion guide** to navigate the XML architecture files effectively.

## Quick Start

**I want to understand...**

- 🔐 **How authentication works** → See [Authentication](#authentication-login-sessions-logout)
- 📊 **How timesheet data flows** → See [Timesheet Operations](#timesheet-operations)
- 🤖 **How automated submission works** → See [Browser Automation](#browser-automation--form-submission)
- 🔌 **How the plugin system works** → See [Plugin System](#plugin-system)
- 💾 **How data is persisted** → See [Data Persistence](#data-persistence)
- 🔄 **How IPC communication works** → See [IPC Communication](#ipc-communication)

---

## Documentation Files

### app-architecture-hierarchical.xml

**Use this for**: Finding specific files, understanding component responsibilities, seeing project structure

**Organized by**: Directory structure (Backend → Frontend → Shared)

**Contains**:

- Purpose and responsibilities of each file
- Key exports and functionality
- Dependencies (what it imports)
- Data flow (inputs/outputs)

**Search by**: File path, component name, module type

### app-architecture-dataflow.xml

**Use this for**: Understanding how operations work end-to-end, seeing data transformations, debugging flows

**Organized by**: Flow categories (authentication, timesheet, submission, etc.)

**Contains**:

- Step-by-step operation flows
- Component interactions
- Data transformations
- Error handling patterns

**Search by**: Operation name, flow category, IPC channel

---

## Common Tasks & How-To Guide

### Authentication (Login, Sessions, Logout)

**Files involved** (see `app-architecture-hierarchical.xml`):

- `frontend/components/LoginDialog.tsx` - Login UI
- `frontend/contexts/SessionContext.tsx` - Session state management
- `backend/src/main.ts` - Auth IPC handlers (auth:login, auth:validateSession, auth:logout)
- `backend/src/services/database.ts` - Session persistence (createSession, validateSession)

**Flows to read** (see `app-architecture-dataflow.xml`):

- `user-login` - How login creates a session
- `session-restoration` - How sessions persist across app restarts
- `user-logout` - How logout clears sessions

**Key concepts**:

- Admin login (Admin/SWFL_ADMIN) bypasses credential storage
- Session tokens stored in localStorage for persistence
- Sessions table in database tracks expiry

**Data path**: `LoginDialog → SessionContext.login() → IPC auth:login → database.createSession() → sessions table`

---

### Timesheet Operations

#### Creating and Editing Entries

**Files involved**:

- `frontend/components/timesheet/TimesheetGrid.tsx` - Handsontable grid UI
- `frontend/contexts/DataContext.tsx` - Draft data state
- `backend/src/main.ts` - Timesheet IPC handlers (timesheet:saveDraft, timesheet:loadDraft)
- `backend/src/services/database.ts` - Timesheet CRUD operations

**Flows to read**:

- `load-draft-timesheets` - Loading pending entries on tab open
- `save-draft-entry` - Saving individual cell changes
- `batch-save-on-tab-exit` - Saving all changes when leaving tab
- `delete-draft-entry` - Deleting entries from grid

**Key concepts**:

- Debounced saves (500ms) prevent excessive database writes
- Time stored as minutes since midnight in database, displayed as HH:MM in UI
- Blank row always present for new entries
- localStorage backup for data resilience

**Data transformations**:

- Database: `{ time_in: 480, time_out: 1020 }` (minutes)
- Grid: `{ timeIn: "08:00", timeOut: "17:00" }` (strings)

#### Viewing History

**Files involved**:

- `frontend/components/archive/DatabaseViewer.tsx` - Archive viewer UI
- `frontend/contexts/DataContext.tsx` - Archive data state
- `backend/src/main.ts` - Archive IPC handlers (database:getAllArchiveData)

**Flows to read**:

- `load-archive-data` - Loading completed entries and credentials
- `export-csv` - Exporting to CSV file

---

### Browser Automation & Form Submission

**Files involved**:

- `backend/src/services/timesheet-importer.ts` - Submission orchestrator
- `backend/src/services/plugins/playwright-bot-service.ts` - Bot service plugin
- `backend/src/services/bot/src/bot_orchestation.ts` - Browser workflow coordinator
- `backend/src/services/bot/src/authentication_flow.ts` - Web portal login
- `backend/src/services/bot/src/webform_flow.ts` - Form filling logic
- `backend/src/services/bot/src/quarter_config.ts` - Quarter-based routing

**Flows to read**:

- `submit-timesheets` - Complete submission workflow (25 steps!)

**Key concepts**:

- Entries grouped by quarter (different forms per quarter)
- Playwright runs in headless mode
- Entries marked as 'in_progress' during submission to prevent conflicts
- Failed entries revert to NULL status (pending)
- Successful entries marked as 'Complete' with submitted_at timestamp

**Data path**: `StatusButton → timesheet-importer.submitTimesheets() → PlaywrightBotService.submit() → bot_orchestation → authentication_flow → webform_flow → database status updates`

**Concurrency protection**: Global `isSubmissionInProgress` flag prevents multiple simultaneous submissions

---

### Plugin System

**Files involved**:

- `shared/plugin-registry.ts` - Plugin registry (singleton)
- `shared/plugin-types.ts` - Plugin interfaces and types
- `shared/plugin-config.ts` - Configuration loader
- `backend/src/middleware/bootstrap-plugins.ts` - Plugin registration and resolution
- `backend/src/services/plugins/*` - Plugin implementations

**Flows to read**:

- `plugin-registration` - How plugins are registered at startup
- `plugin-resolution` - How active plugins are resolved at runtime
- `plugin-swap` - How to change plugins via configuration

**Plugin namespaces**:

- `data` - Data persistence (active: sqlite, available: memory)
- `credentials` - Credential storage (active: sqlite)
- `submission` - Form submission (active: playwright, available: mock)

**How to swap plugins**: Edit `plugin-config.json` and restart app

**Resolution pattern**: `getSubmissionService() → PluginRegistry.getPlugin('submission') → PlaywrightBotService instance`

---

### Data Persistence

**Database** (SQLite at `userData/sheetpilot.sqlite`):

- `timesheet` table - Draft and submitted entries
- `credentials` table - Service credentials (encrypted)
- `sessions` table - User session tokens

**localStorage** (Browser storage):

- `sessionToken` - Session persistence across restarts
- `sheetpilot_timesheet_backup` - Draft data backup
- `sheetpilot_macros` - Quick-fill templates

**File system**:

- Window state (position, size, maximized)
- Logs (NDJSON format)

**Patterns** (see `app-architecture-dataflow.xml` → data-persistence category):

- `database-persistence` - Primary SQLite storage
- `localstorage-backup` - Resilience backup
- `session-persistence` - Auto-login support
- `macro-persistence` - Template storage

---

### IPC Communication

**Communication patterns** (see `app-architecture-dataflow.xml` → ipc-communication category):

- `request-response` - Standard async operations (e.g., load data)
- `event-broadcast` - Server-push updates (e.g., download progress)
- `logging-bridge` - Renderer logs forwarded to main logger

**IPC channels by category**:

**Timesheet**: `timesheet:submit`, `timesheet:saveDraft`, `timesheet:loadDraft`, `timesheet:deleteDraft`, `timesheet:exportToCSV`

**Authentication**: `auth:login`, `auth:validateSession`, `auth:logout`, `auth:getCurrentSession`

**Database**: `database:getAllArchiveData`, `database:getAllTimesheetEntries`, `database:getAllCredentials`

**Credentials**: `credentials:store`, `credentials:get`, `credentials:list`, `credentials:delete`

**Admin**: `admin:clearCredentials`, `admin:rebuildDatabase`

**Logging**: `logger:error`, `logger:warn`, `logger:info`, `logger:verbose`, `logger:debug`, `logger:user-action`

**Bridge location**: `backend/src/preload.ts` exposes all IPC APIs via `contextBridge`

**Type safety**: TypeScript interfaces in `frontend/src/contracts/window.ts` ensure type-safe IPC calls

---

## How to Use These Docs

### For AI Assistants

**Start here when**:

- Understanding a new feature or operation
- Debugging data flow issues
- Finding where specific logic lives
- Understanding architectural patterns

**Navigation strategy**:

1. **This document (ARCHITECTURE_DOCS.md)** - Get oriented, find relevant sections
2. **app-architecture-hierarchical.xml** - Find specific files and their responsibilities
3. **app-architecture-dataflow.xml** - Understand how operations flow through the system

**Search tips**:

- Search XML by file path to find file documentation
- Search XML by operation name (e.g., "login", "submit") to find flows
- Search XML by IPC channel name (e.g., "timesheet:submit") to trace communication
- Search this document by task (e.g., "authentication", "submission")

### For Developers

**Use cases**:

- **Onboarding**: Read this document first, then explore XML files for depth
- **Feature development**: Find related files and flows before coding
- **Debugging**: Trace data flow through XML documentation
- **Code review**: Verify changes align with documented patterns

**Debugging workflows**:

1. Identify the operation (e.g., "timesheet submission")
2. Find the flow in `app-architecture-dataflow.xml`
3. Follow the step-by-step flow to identify failure point
4. Find the specific file in `app-architecture-hierarchical.xml`
5. Read the code with full context

---

## Architecture Overview

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

**Layer responsibilities** (see `app-architecture-hierarchical.xml` for file details):

**Backend** (Electron main process):

- System operations, file I/O, database
- IPC communication handlers
- Business logic via services
- Plugin system for extensibility
- Browser automation via Playwright

**Frontend** (React renderer):

- User interface rendering
- UI state management via React Context
- IPC communication via preload bridge
- Lazy loading for performance
- Client-side validation

**Shared** (common code):

- Service contracts (interfaces)
- Plugin registry implementation
- Error handling and logging
- Business configuration

---

### Key Architectural Patterns

#### 1. Plugin System

Enables swappable implementations without code changes.

**Pattern**: Namespaced registry with configuration-based activation

**Example**: Switch from real Playwright submission to mock submission for testing

- Edit `plugin-config.json`: `"submission": { "active": "mock" }`
- Restart app
- All calls to `getSubmissionService()` now return `MockSubmissionService`

**See**: [Plugin System](#plugin-system) section above and `plugin-resolution` flow in dataflow XML

#### 2. IPC Communication

Type-safe bridge between Electron processes.

**Pattern**: Preload script exposes safe APIs via `contextBridge`

**Example**: Frontend calls `window.timesheet.loadDraft()` → Preload forwards to `ipcRenderer.invoke('timesheet:loadDraft')` → Backend handler executes

**Security**: Preload script is the only bridge; renderer has no direct Node.js access

**See**: [IPC Communication](#ipc-communication) section above and `ipc-communication` patterns in dataflow XML

#### 3. State Management

React Context API with lazy loading and resilience.

**Pattern**: Context providers wrap app, data loads on-demand

**Example**: Timesheet data doesn't load until user clicks Timesheet tab

- App starts → SessionContext validates session
- User clicks Timesheet tab → App calls `DataContext.refreshTimesheetDraft()`
- DataContext loads data via IPC and stores in state
- TimesheetGrid renders with data

**Resilience**: localStorage backup protects against database failures

**See**: Files `frontend/contexts/SessionContext.tsx` and `frontend/contexts/DataContext.tsx` in hierarchical XML

#### 4. Error Handling

Structured errors with fallbacks and recovery.

**Pattern**: Custom error classes with codes, fallback mechanisms, automatic retry

**Example**: Database connection fails

1. Service throws `DatabaseConnectionError` with context
2. IPC handler catches and logs structured error
3. Frontend attempts localStorage restore as fallback
4. User sees friendly error message with actionable guidance

**See**: `error-handling` patterns in dataflow XML and `shared/errors.ts` in hierarchical XML

---

## File Structure Quick Reference

**Need to modify authentication?** → `frontend/contexts/SessionContext.tsx` + `backend/src/main.ts` (auth handlers)

**Need to modify timesheet grid?** → `frontend/components/timesheet/TimesheetGrid.tsx` + related `timesheet.*` files

**Need to modify submission logic?** → `backend/src/services/bot/src/*` + `timesheet-importer.ts`

**Need to modify database schema?** → `backend/src/services/database.ts` (ensureSchema function)

**Need to modify IPC APIs?** → `backend/src/preload.ts` (expose) + `backend/src/main.ts` (implement)

**Need to add a plugin?** → Create in `backend/src/services/plugins/` + register in `bootstrap-plugins.ts`

**Need to modify logging?** → `shared/logger.ts` (implementation) + `.cursor/rules/logging.mdc` (standards)

**Need to modify styles?** → `frontend/src/styles/m3-tokens.css` (tokens) + component CSS (usage)

---

## Searchable Keywords Index

**Authentication**: SessionContext, LoginDialog, auth:login, auth:validateSession, sessions table, credentials storage

**Timesheet**: TimesheetGrid, DataContext, timesheet:saveDraft, timesheet:loadDraft, Handsontable, draft entries, time normalization

**Submission**: timesheet-importer, PlaywrightBotService, bot_orchestation, webform_flow, authentication_flow, quarter_config

**IPC**: preload.ts, contextBridge, ipcRenderer.invoke, ipcMain.handle, request-response pattern

**Database**: database.ts, better-sqlite3, ensureSchema, credentials table, timesheet table, sessions table

**Plugin System**: plugin-registry, bootstrap-plugins, IDataService, ISubmissionService, ICredentialService, plugin-config.json

**State Management**: React Context, SessionContext, DataContext, useState, useEffect, lazy loading

**Logging**: logger.ts, electron-log, NDJSON, structured logging, PII redaction

**Styling**: m3-tokens.css, Material Design 3, design tokens, CSS custom properties

**Error Handling**: errors.ts, AppError, DatabaseConnectionError, fallback mechanisms

---

## Exclusions

These documents focus on **core application files** and exclude:

- Test files (`*.spec.ts`, `*.spec.tsx`, `*.test.ts`)
- Configuration files (`tsconfig.json`, `vite.config.ts`, `package.json`, etc.)
- Build outputs (`dist/`, `out/`, `node_modules/`)
- Generated files (auto-generated types, compiled assets)
- Development scripts (isolated dev utilities)

**Why?** These files are either:

- Self-documenting (tests describe their own behavior)
- Standard configuration (documented by their respective tools)
- Temporary or generated (not part of core architecture)

---

## Maintenance Guidelines

**Update these docs when**:

- ✅ Adding new major features or flows
- ✅ Changing architectural patterns
- ✅ Adding new layers, modules, or significant files
- ✅ Modifying data flow patterns
- ✅ Adding or changing IPC channels
- ✅ Refactoring plugin system

**Don't update for**:

- ❌ Minor bug fixes
- ❌ CSS tweaks or styling changes
- ❌ Dependency version updates
- ❌ Test additions
- ❌ Documentation-only changes

**How to update**:

1. Update relevant sections in XML files
2. Update cross-references in this companion document
3. Verify examples and data paths are still accurate
4. Update "Generated" date below

---

## Related Documents

- `DEVELOPER_WIKI.md` - Development guidelines, setup, and workflows
- `CHANGELOG.md` - Version history and release notes
- `README.md` - Project overview and quick start guide
- `.cursor/rules/*.mdc` - Coding standards (file structure, logging, styling)
- `test-results/*.md` - Test execution reports and validation

---

**Generated**: November 7, 2025  
**Format**: XML (machine-readable) + Markdown companion (human-readable navigation)  
**Target Audience**: AI assistants and developers  
**Maintenance**: Update when architecture or major features change
