# Copilot Instructions for Sheetpilot

## Project Overview
Sheetpilot is an Electron desktop application for automated timesheet management. Frontend (React/Vite) and backend (Node.js) communicate via IPC channels. SQLite stores timesheet/credential data. Plugin architecture allows swappable implementations for data storage and submission.

## Critical Architecture Patterns

### 1. IPC Communication (Renderer ↔ Main Process)
- **Namespace Pattern**: All channels follow `namespace:action` format (e.g., `timesheet:saveDraft`, `auth:login`)
- **Registration Location**: [app/backend/src/ipc/index.ts](app/backend/src/ipc/index.ts#L1) - Central registry calls `registerAllIPCHandlers(mainWindow)`
- **Handler Organization**: Separate files per namespace ([app/backend/src/ipc/*-handlers.ts](app/backend/src/ipc))
- **Security**: Always validate sender with `isTrustedIpcSender(event)` before processing
- **Key Channels**:
  - `timesheet:saveDraft`, `timesheet:loadDraft`, `timesheet:deleteDraft`, `timesheet:submit`
  - `auth:login`, `auth:validateSession`, `auth:logout`
  - `credentials:store`, `credentials:get`, `credentials:list`, `credentials:delete`

### 2. Database (SQLite + better-sqlite3)
- **Singleton Connection**: [app/backend/src/repositories/connection-manager.ts](app/backend/src/repositories/connection-manager.ts#L1) - Thread-safe singleton
- **Critical**: `getDb()` returns the persistent connection. **NEVER close it** - lifecycle is managed
- **Path Configuration**: Via `setDbPath()` (default: `app.getPath('userData')/sheetpilot.sqlite`)
- **Schema Initialization**: [ensureSchemaInternal()](app/backend/src/repositories/connection-manager.ts#L420) creates tables on first run
- **Migrations**: [app/backend/src/repositories/migrations.ts](app/backend/src/repositories/migrations.ts#L1) - Version-based, auto-runs at startup
- **WAL Mode**: Enabled for better concurrency (`PRAGMA journal_mode = WAL`)
- **Tables**: `timesheet`, `credentials`, `sessions`, `schema_info`

### 3. Plugin Architecture
- **Contract Interfaces**: [app/shared/contracts/](app/shared/contracts/)
  - `IDataService` - Timesheet persistence (saveDraft, loadDraft, deleteDraft, getArchiveData, getAllTimesheetEntries)
  - `ICredentialService` - Credential storage (store, get, list, delete)
  - `ISubmissionService` - Timesheet submission (submit, validateEntry, isAvailable)
- **Registry**: [app/shared/plugin-registry.ts](app/shared/plugin-registry.ts#L1) - Global `PluginRegistry` singleton
- **Base Interface**: All plugins implement `IPlugin` with `metadata` and optional `initialize()`, `dispose()`
- **Active Implementations**:
  - Data: `SQLiteDataService` ([app/backend/src/services/plugins/sqlite-data-service.ts](app/backend/src/services/plugins/sqlite-data-service.ts#L1))
  - Credentials: `SQLiteCredentialService` ([app/backend/src/services/plugins/sqlite-credential-service.ts](app/backend/src/services/plugins/sqlite-credential-service.ts#L1))
  - Submission: `ElectronBotService` ([app/backend/src/services/bot/](app/backend/src/services/bot/))
- **Adding New Plugin**: Implement contract interface → add metadata → register via `pluginRegistry.registerPlugin(namespace, name, impl)`

### 4. Error Handling
- **Custom Errors**: [app/shared/errors.ts](app/shared/errors.ts#L1) - Categorized (DATABASE, CREDENTIALS, SUBMISSION, etc.)
- **User-Friendly Messages**: `AppError.toUserMessage()` - never leak technical details
- **Logging Integration**: All errors logged with context; use `error`, `warn`, `info` via appLogger/dbLogger
- **Contracts Validate**: Test suite enforces error response structure (use assertion helpers)

### 5. Logging Standards
- **Channels**: `appLogger`, `dbLogger`, `ipcLogger`, `botLogger`, `importLogger` (all in [app/shared/logger](app/shared/logger))
- **Format Requirements** (see [.cursor/rules/logging.mdc](.cursor/rules/logging.mdc)):
  - Use **active voice**: "Could not connect" not "Connection failed"
  - **Tense**: States (present), completed actions (past), ongoing (continuous)
  - **Pattern**: `"[Action] [resource]"` with structured `data` object (camelCase fields)
  - **Levels**: `error` (failures), `warn` (fallbacks), `info` (state changes), `verbose` (operational detail)
- **Example**: `logger.info('Database initialized successfully', { dbPath, schemaVersion: 1 })`

### 6. Styling (Material Design 3)
- **Design Tokens Only**: Never hard-code colors, spacing, fonts
- **Token Sources**: [app/frontend/src/m3-tokens.css](app/frontend/src/m3-tokens.css) - Central definition
- **Usage**: `var(--md-sys-color-primary)`, `var(--space-4)`, `var(--md-sys-shape-corner-medium)`
- **Pairing Rule**: Surface colors must pair with `on-*` colors (e.g., `--md-sys-color-surface` + `--md-sys-color-on-surface`)
- **Exception**: Only hard-code base unit in token files (`:root { --space-unit: 4px; }`)

## Developer Workflows

### Build & Dev
- **Development**: `npm run dev` - Vite + Electron, watches rebuilds, hot reload
- **Type Check**: `npm run type-check` - Validates root + backend + frontend + bot + tests
- **Lint**: `npm run lint:fix` - ESLint with auto-fix (max-warnings: 0)
- **Testing**: 
  - Unit: `npm run test:unit`
  - Integration: `npm run test:integration`
  - E2E: `npm run test:e2e`
  - Smoke: `npm run test:smoke`
  - All: `npm test`

### Testing Conventions
- **Contract Tests Prevent Regressions**: [app/backend/tests/contracts/](app/backend/tests/contracts/) - Validate IPC channels, plugin interfaces, data structures
- **Mocking Pattern**: Vitest mocks with global `__test_handlers` for IPC interception
- **Database Tests**: Use isolated test DB via `createTestDatabase()` → cleanup with `closeConnectionForTesting()`
- **Plugin Tests**: Assert method signatures and response structures with `assertPluginInterface()`

### Database Operations
```typescript
// Import from repositories
import { getDb, setDbPath, ensureSchema } from './repositories/connection-manager';

// Get connection (never close it)
const db = getDb();

// Execute queries
const stmt = db.prepare('SELECT * FROM timesheet WHERE id = ?');
const result = stmt.get(id);

// Schema is auto-initialized; manual call only needed in tests after cleanup
ensureSchema();
```

### Handling IPC in Backend
```typescript
// In app/backend/src/ipc/*-handlers.ts
import { ipcMain } from 'electron';
import { ipcLogger } from '../../../shared/logger';

export function registerMyHandlers(): void {
  ipcMain.handle('namespace:action', async (event, arg) => {
    if (!isTrustedIpcSender(event)) return;
    try {
      // Process arg, return result
      return { success: true, data: result };
    } catch (error) {
      ipcLogger.error('Could not process request', { error: error?.message });
      return { success: false, error: 'User-friendly message' };
    }
  });
}
```

### Plugin Registration (Main Process)
```typescript
// In app/backend/src/main.ts after IPC registration
const registry = PluginRegistry.getInstance();

// Register data persistence
const dataService = new SQLiteDataService();
await registry.registerPlugin('data', 'sqlite', dataService);
registry.setActivePlugin('data', 'sqlite');

// Use plugin
const dataPlugin = registry.getPlugin<IDataService>('data');
const result = await dataPlugin?.saveDraft(entry);
```

## Project-Specific Conventions

### File Organization
- **Backend**: `src/` → `bootstrap/` (init), `ipc/` (handlers), `repositories/` (DB), `services/` (business logic + plugins), `middleware/`, `validation/`
- **Frontend**: `src/` → `components/`, `pages/`, `hooks/`, `context/`, `services/` (API clients), `styles/`, `contracts/`
- **Shared**: `types/`, `contracts/` (interfaces), `utils/`, `plugin-*.ts`, `errors.ts`, `logger.ts`
- **Tests**: Mirror source structure; use `*.spec.ts` suffix; helpers in `tests/helpers/`

### Naming Conventions
- **IPC Handlers**: `*-handlers.ts`, export `register*Handlers()`
- **Plugins**: `*-service.ts` (e.g., `sqlite-data-service.ts`)
- **Contracts**: `I*.ts` (e.g., `IDataService.ts`)
- **Database Utilities**: `*-repository.ts` or in `repositories/` (e.g., `credential-repository.ts`)

### Time/Duration Storage
- **Database**: Store as **minutes since midnight** (integer) in `time_in`, `time_out` columns
- **Display**: Convert via `formatMinutesToTime()` utility
- **Input**: Parse via `parseTimeToMinutes()` utility
- **Example**: 9:00 AM = 540 minutes, 5:00 PM = 1020 minutes

### Cross-Process Logging Bridge
- **Renderer Logs → Main**: Renderer logs via `window.logger.*()` (exposed via preload)
- **IPC Handler**: [app/backend/src/ipc/logger-handlers.ts](app/backend/src/ipc/logger-handlers.ts#L1) - Routes renderer logs to `ipcLogger`
- **Console Messages**: Renderer console captured at [app/backend/src/bootstrap/windows/create-main-window.ts](app/backend/src/bootstrap/windows/create-main-window.ts#L86)

## Critical Gotchas

1. **Never Close DB**: `getDb()` returns singleton. Closing breaks all queries. Tests use `closeConnectionForTesting()` + `resetPreventReconnectionFlag()` for cleanup.
2. **Thread Safety**: better-sqlite3 is NOT thread-safe. Single persistent connection prevents race conditions.
3. **Plugin Metadata Required**: Every plugin must export `metadata: PluginMetadata` with `name`, `version`, `author`.
4. **IPC Channel Naming**: Must be `namespace:action` or `ping`. Contract tests validate this pattern.
5. **Window References**: IPC handlers receive `mainWindow` at initialization. Store via `setMainWindow()` to send events to renderer.
6. **Schema Initialization**: Only happens once. Reset via `schemaInitialized = false` after `closeConnection()` in tests.
7. **Material Design Tokens**: Using hard-coded colors in components breaks dark theme. Always use `var(--md-sys-color-*)`.
8. **Error Category Matching**: IPC responses must have `success: boolean` + `error?: string` structure. Contract tests check this.

## Key Documentation References
- Architecture: [docs/README.md](docs/README.md) → links to DEVELOPER_WIKI.md
- Security: [docs/SECURITY.md](docs/SECURITY.md) - IPC, CSP, credentials, logs
- Styling Rules: [.cursor/rules/styling.mdc](.cursor/rules/styling.mdc) - M3 tokens, no hard-codes
- Logging Rules: [.cursor/rules/logging.mdc](.cursor/rules/logging.mdc) - Active voice, patterns
- File Structure: [.cursor/rules/filestructure.mdc](.cursor/rules/filestructure.mdc) - Layer responsibilities
