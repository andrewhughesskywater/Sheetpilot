# SheetPilot: AI Copilot Instructions

**Version**: 1.6.0 | **Last Updated**: January 15, 2026

## Project Overview

SheetPilot is a desktop timesheet management application built with Electron, TypeScript, and SQLite. It syncs time entries with SmartSheet and provides secure credential storage with automated submission workflows.

**Tech Stack**: Electron (main/renderer) + TypeScript + better-sqlite3 (SQLite3 wrapper) + Vite (frontend build) + Vitest (testing) + ESM modules (no CommonJS)

---

## Architecture: Big Picture

### 1. **Multi-Process Architecture (Electron)**

- **Main Process** (`app/backend/src/main.ts`): Handles app lifecycle, windows, database, IPC handlers, file system, credentials
- **Renderer Process** (`app/frontend/src`): Browser UI built with React/Vite, communicates with main via preload bridges
- **Preload Script** (`app/backend/src/preload.ts`): Secure API surface exposed to renderer (context isolation)
- **Shared Modules** (`app/shared`): Logging, types, error classes, plugin system used by both processes

### 2. **IPC Communication Pattern**

All frontend→backend communication uses **contextIsolation + preload bridges** (not direct ipcRenderer):

```typescript
// WRONG: Frontend imports ipcRenderer directly
import { ipcRenderer } from 'electron'; // ❌ Blocked by contextIsolation

// CORRECT: Use preload bridge
const result = await window.database.getAllArchiveData(token);
```

**IPC Handler Location**: `app/backend/src/routes/` contains handler registrations:
- `auth-handlers.ts` - Login, session validation
- `credentials-handlers.ts` - SmartSheet credential storage
- `timesheet-handlers.ts` - Timesheet CRUD operations
- `database-handlers.ts` - Archive/history viewing
- `admin-handlers.ts` - Admin-only operations (clear credentials, rebuild DB)

**Preload Bridges**: `app/backend/src/preload/bridges/` expose safe contracts to renderer.

### 3. **Database Layer**

- **SQLite via better-sqlite3**: Synchronous, embedded database at `~/.sheetpilot/sheetpilot.sqlite`
- **Models/Repositories**: `app/backend/src/models/index.ts` exports CRUD functions (no ORM—raw SQL)
- **Key Tables**: `timesheet`, `credentials`, `sessions`, `business_config`
- **Bootstrap**: `app/backend/src/bootstrap/database/bootstrap-database.ts` initializes schema on startup

### 4. **Plugin System**

SheetPilot uses a plugin registry for extensibility:

- **Plugin Types**: `app/shared/plugin-types.ts` defines `IPlugin` interface
- **Plugin Registry**: `app/shared/plugin-registry.ts` manages active plugins
- **Default Plugins**: `app/backend/src/bootstrap/plugins/register-default-plugins.ts` registers built-in plugins
- **Use case**: Swap implementations (e.g., different credential stores, submission strategies)

### 5. **Logging Architecture**

Structured, machine-parsable JSON logging with **SOC2 compliance**:

- **Logger Module**: `app/shared/logger.ts` provides categorized loggers:
  - `appLogger` - General app events
  - `ipcLogger` - IPC handler calls (with security/audit logs)
  - `dbLogger` - Database operations
  - `botLogger` - SmartSheet submission bot
- **Log Format**: NDJSON (one JSON object per line), includes `sessionId`, `timestamp`, user info
- **Security**: Username redacted in production unless `SHEETPILOT_LOG_USERNAME=true`
- **Rules** (from `.cursor/rules/logging.mdc`):
  - Active voice only: "Could not connect" not "Connection failed"
  - Structured context passed as 2nd argument: `logger.error('message', { context })`
  - Use specific verbs (not "Failed to", use "Could not")

---

## Critical Workflows & Developer Commands

### **Development**

```bash
# Hot reload dev environment (Vite + backend + Electron)
npm run dev

# Watch mode (separate processes, easier debugging)
npm run dev:watch

# Type checking all workspaces
npm run type-check

# Linting with auto-fix
npm run lint

# Reset development database
npm run reset-db
```

### **Testing**

```bash
# Run unit tests in backend
npm run -w @sheetpilot/backend test:unit

# Run integration tests
npm run -w @sheetpilot/backend test:integration

# Run all test suites
npm run -w @sheetpilot/backend test

# Run e2e tests (requires Playwright)
npm run -w @sheetpilot/backend test:e2e

# Test quality metrics
npm run test:quality
```

**Test Organization** (`app/backend/vitest.config.unit.ts`):
- **Unit tests**: `tests/unit/**/*.spec.ts` (70% coverage minimum)
- **Validation tests**: `tests/validation/**/*.spec.ts` (90% coverage required)
- **Logic tests**: `tests/logic/**/*.spec.ts` (85% coverage required)
- **IPC tests**: `tests/ipc/**/*.spec.ts` (comprehensive handler testing)
- **Contract tests**: `tests/contracts/**/*.spec.ts` (interface contracts)

### **Build & Release**

```bash
# Build production app
npm run build

# Debug build output
npm run build:debug

# Release (standard-version)
npm run release           # Patch
npm run release:minor     # Minor
npm run release:major     # Major
npm run release:alpha     # Prerelease

# Version syncing
npm run sync-version      # Syncs package.json to CHANGELOG
```

---

## Project-Specific Conventions

### 1. **Module System: ESM Only**

- **All files must use ESM** (`import`/`export`, not `require`/`module.exports`)
- Package.json has `"type": "module"`
- TypeScript files compile to ESM
- No mixing with CommonJS

### 2. **File Structure**

```
app/
  backend/          # Main process, API routes, database
    src/
      main.ts       # Entry point
      bootstrap/    # Initialization: logging, DB, plugins, windows
      core/         # App coordination (AppController)
      routes/       # IPC handler registrations
      services/     # Business logic (timesheet importer, etc.)
      models/       # Database CRUD functions
      validation/   # Input validation schemas (Zod)
      middleware/   # Auth, logging, validation
    tests/          # Test files (mirrors src structure)
  
  frontend/         # Renderer process (React + Vite)
    src/
      components/   # UI components
      services/     # API clients (use window.database, window.auth, etc.)
      contexts/     # React context for global state
  
  shared/           # Shared between backend & frontend
    logger.ts       # Logging module
    plugin-*.ts     # Plugin system
    errors.ts       # Custom error classes
    logger-*.ts     # Logger configuration & formatting
```

### 3. **Validation Pattern (Zod)**

Use Zod schemas for runtime input validation:

```typescript
import { z } from 'zod';

const StorageSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export function validateInput<T>(schema: ZodSchema, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(result.error.message);
  return result.data as T;
}
```

### 4. **Error Handling**

Custom errors in `app/shared/errors.ts`:

```typescript
// Use specific error classes
throw new CredentialsNotFoundError('SmartSheet credentials not found');
throw new CredentialsStorageError('Could not store credentials');

// Catch and log with context
catch (err: unknown) {
  ipcLogger.error('Could not submit timesheet', {
    error: err instanceof Error ? err.message : String(err),
    userId: session.userId
  });
}
```

### 5. **IPC Handler Pattern**

Handlers must:
1. Check `isTrustedIpcSender(event)` for security
2. Validate session with `validateSession(token)`
3. Log security events: `ipcLogger.security(category, message, metadata)`
4. Return typed response objects with `success`, `data|error` fields

```typescript
ipcMain.handle('timesheet:update', async (event, token, data) => {
  if (!isTrustedIpcSender(event)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  const session = validateSession(token);
  if (!session.valid) {
    ipcLogger.security('session-invalid', 'Invalid token', { handler: 'timesheet:update' });
    return { success: false, error: 'Session expired' };
  }
  
  try {
    const entry = validateInput(TimesheetSchema, data);
    insertTimesheetEntry(entry);
    return { success: true, data: entry };
  } catch (err) {
    ipcLogger.error('Could not update timesheet', { error: String(err) });
    return { success: false, error: String(err) };
  }
});
```

### 6. **Material Design 3 (M3) Styling**

Frontend uses M3 design tokens (never hard-coded colors/sizes):

```css
/* WRONG */
button { background: #6750A4; padding: 12px; }

/* CORRECT */
button {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: var(--space-3);
}
```

Tokens defined in: `app/frontend/src/m3-tokens.css` and `app/frontend/src/theme.css`

### 7. **Test Naming & Structure**

Use Vitest with nested describe blocks:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('timesheet-handlers', () => {
  describe('timesheet:insert handler', () => {
    it('should insert entry when authenticated', async () => {
      // Arrange
      const handler = registerTimesheetHandlers();
      
      // Act
      const result = await handler({}, validToken, timesheetData);
      
      // Assert
      expect(result.success).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      // ...
    });
  });
});
```

### 8. **Constants & Configuration (Centralized, Not Hard-Coded)**

**RULE: NEVER hard-code constants, configuration values, timeouts, selectors, or magic numbers directly in code. All must be defined in centralized config files at the highest parent folder.**

**Central Configuration Files:**
- `app/shared/src/constants/index.ts` - Application constants (versions, settings, feature flags)
- `app/bot/src/engine/config/automation_config.ts` - Automation behavior, timeouts, selectors, wait times
- `app/bot/src/engine/config/quarter_config.ts` - Quarterly form definitions (form URLs, IDs, date ranges)
- `app/shared/plugin-config.ts` - Plugin registry and feature flags

**Examples of what should be centralized:**

```typescript
// ❌ WRONG - Hard-coded magic number
function waitForElement() {
  return new Promise(resolve => setTimeout(resolve, 3000)); // Hard-coded timeout
}

// ✅ CORRECT - Use centralized constant
import { DYNAMIC_FIELD_MAX_DOM_TIMEOUT } from '@sheetpilot/bot/engine/config/automation_config';
function waitForElement() {
  return new Promise(resolve => setTimeout(resolve, DYNAMIC_FIELD_MAX_DOM_TIMEOUT * 1000));
}

// ❌ WRONG - Hard-coded selector
const submitBtn = page.locator("button[data-client-id='form_submit_btn']");

// ✅ CORRECT - Use centralized constant
import { SUBMIT_BUTTON_LOCATOR } from '@sheetpilot/bot/engine/config/automation_config';
const submitBtn = page.locator(SUBMIT_BUTTON_LOCATOR);

// ❌ WRONG - Hard-coded version
console.log('App v1.5.1');

// ✅ CORRECT - Use centralized constant
import { APP_VERSION } from '@sheetpilot/shared/src/constants';
console.log(`App v${APP_VERSION}`);
```

**Environment Variable Pattern:**
Constants can be overridden via environment variables, but defaults must be in config files:

```typescript
// CORRECT - Default in config, override via env
export const SHORT_WAIT_TIMEOUT: number = Number(
  process.env["SHORT_WAIT_TIMEOUT"] ?? "0.3"
);

// WRONG - No default fallback
export const SHORT_WAIT_TIMEOUT: number = Number(process.env["SHORT_WAIT_TIMEOUT"]);
```

**When Adding New Constants:**
1. Determine the scope: global (`app/shared/`), bot-specific (`app/bot/`), or module-specific
2. Add to appropriate config file with JSDoc comment explaining usage
3. Export from the config file (never as inline values)
4. Import where needed: `import { CONSTANT } from '@sheetpilot/shared/src/constants';`
5. Update tests in `app/shared/tests/unit/constants.spec.ts` or bot tests

---

### 9. **Import Aliases (Mandatory for Production Code)**

**RULE: Use aliased imports for all non-parent-folder imports. Only use relative imports (`../`) for importing from parent directories.**

Defined aliases (auto-enforced by ESLint):

```typescript
// Backend (inside app/backend/src/**/*.ts)
import { getDb } from '@/models';           // ✅ Aliased (same workspace)
import { ipcLogger } from '@sheetpilot/shared/logger';  // ✅ Aliased (shared)

// WRONG - Never use relative imports for same-level or descendant directories
import { getDb } from '../../models';       // ❌ Relative import (use @/ instead)
import Logger from '../../../shared/logger'; // ❌ Relative import (use @sheetpilot/shared)

// Exception: Parent directory imports are OK with relative paths
import { AppController } from '../core';    // ✅ OK - parent directory
import { getDb } from '../../../../models'; // ❌ NOT OK - use alias instead
```

**Available Aliases:**
- `@/*` → `app/backend/src/*` (backend production code)
- `@sheetpilot/shared` → `app/shared/index.ts` (shared types, logger, errors)
- `@sheetpilot/shared/*` → `app/shared/*` (specific modules in shared)
- `@sheetpilot/bot` → `app/bot/src/index.ts` (bot service)
- `@sheetpilot/bot/*` → `app/bot/src/*` (bot modules)

The ESLint rule `@dword-design/import-alias/prefer-alias` **automatically enforces** this and can auto-fix with `npm run lint --fix`.

---

### 10. **Linting & Code Quality**

**Run linting:**
```bash
npm run lint                  # Check and auto-fix all issues
npm run type-check           # Type checking (stricter than compile)
npm run test:quality         # Test organization and coverage analysis
```

**Key ESLint Rules:**

| Rule | Severity | Details |
|------|----------|---------|
| `no-explicit-any` | Error | Never use `any` type—use `unknown` + type guard instead |
| `prefer-alias` | Error | Use `@/` or `@sheetpilot/` instead of relative imports |
| `consistent-type-imports` | Error | Type-only imports use `import type` syntax |
| `ban-ts-comment` | Error | `@ts-expect-error` only with description; `@ts-ignore` forbidden |
| `complexity` | Warn | Cyclomatic complexity: 10 (default), 20 (services), 15 (handlers) |
| `max-lines` | Warn | File size: 300 (default), 500 (services), 400 (handlers/logic) |
| `cognitive-complexity` | Warn | Human readability: 15 (default), 25 (services), 18 (handlers/logic) |

**Complexity Thresholds by File Type:**

```
├── app/backend/src/
│   ├── services/** ......... Complexity: 20, MaxLines: 500, Cognitive: 25
│   ├── routes/** ........... Complexity: 15, MaxLines: 400, Cognitive: 18
│   ├── logic/** ............ Complexity: 15, MaxLines: 400, Cognitive: 18
│   ├── models/** ........... Complexity: 10, MaxLines: 300, Cognitive: 12
│   ├── middleware/** ....... Complexity: 10, MaxLines: 300, Cognitive: 12
│   └── bootstrap/** ........ Complexity: 15, MaxLines: 400, Cognitive: 18
├── app/frontend/** ......... Complexity: 10, MaxLines: 300, Cognitive: 15
└── app/shared/** ........... Complexity: 10, MaxLines: 300, Cognitive: 12
```

**Type Strictness (Non-Negotiable):**
- `strict: true` - Full type checking
- `noImplicitAny: true` - Forbid `any` without explicit annotation
- `noUnusedLocals: false` - Allow unused (catch with ESLint)
- `noUnusedParameters: false` - Allow unused (catch with ESLint)
- Prefer `unknown` over `any`, with type guards to narrow
- Use `type` imports for type-only imports to reduce bundle size

---

## Workspace & Monorepo Structure

SheetPilot uses **npm workspaces** for monorepo management:

```json
"workspaces": [
  "app/backend",
  "app/bot", 
  "app/frontend",
  "app/shared"
]
```

**Workspace Commands:**
```bash
# Run command in specific workspace
npm run -w @sheetpilot/backend test:unit
npm run -w @sheetpilot/frontend build

# Install dependency in specific workspace
npm install -w @sheetpilot/backend <package>

# Run script across all workspaces
npm run build --workspaces
```

**Dependency Management:**
- **Root `package.json`**: Shared dev dependencies (ESLint, TypeScript, Vitest, Electron, build tools)
- **Workspace `package.json`**: Workspace-specific dependencies
- **Shared dependencies**: Installed at root, accessible by all workspaces
- **Better-sqlite3**: Requires rebuild after install: `npm run rebuild`

---

## Security & Credential Handling

SheetPilot implements **production-grade security** for credential storage:

### Credential Encryption

```typescript
// app/backend/src/models/credentials-repository.ts

// AES-256-GCM encryption with:
// - Machine-specific master key derived from hostname + username
// - Random 16-byte initialization vector (IV) per encryption
// - 16-byte authentication tag for integrity
// - PBKDF2 key derivation (100,000 iterations)

function encryptPassword(password: string): string {
  const key = getMasterKey(); // Derived from system
  const iv = crypto.randomBytes(16); // Random IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  // ... returns base64-encoded: IV + authTag + encrypted
}
```

**Security Rules:**
- ✅ **Never log passwords** (even in debug mode)
- ✅ **Never store plaintext credentials** in database
- ✅ **Redact PII in production logs** (username hashed unless `SHEETPILOT_LOG_USERNAME=true`)
- ✅ **Use parameterized SQL queries** (prevents injection)
- ✅ **Validate all IPC inputs** with Zod schemas
- ❌ **Never expose encryption keys** in logs or error messages

### PII Redaction Pattern

```typescript
// Logs automatically redact username in production
const REDACT_PII = process.env['SHEETPILOT_LOG_USERNAME'] !== 'true' 
                   && process.env['NODE_ENV'] === 'production';

function getLogUsername(): string {
  if (REDACT_PII) {
    return crypto.createHash('sha256')
      .update(CURRENT_USER)
      .digest('hex')
      .substring(0, 8);
  }
  return CURRENT_USER;
}
```

---

## Playwright/Browser Automation

The bot uses **Playwright** for SmartSheet form automation:

### Bot Architecture

```
runTimesheet (high-level API)
    ↓
BotOrchestrator (workflow coordinator)
    ↓
├── BrowserLauncher (Chromium with stealth)
├── WebformSessionManager (contexts/pages)
├── LoginManager (authentication)
├── FormInteractor (field filling + dropdown detection)
└── SubmissionMonitor (verify success)
```

**Key Patterns:**
- **Stealth mode**: Removes `navigator.webdriver`, sets realistic headers/user-agent
- **Dynamic waits**: Adaptive timeouts based on network/DOM activity
- **Dropdown detection**: Smartsheet-specific logic for combobox selection
- **Quarterly routing**: Auto-selects correct form URL based on entry dates (`quarter_config.ts`)

**Configuration**: All bot behavior in `app/bot/src/engine/config/automation_config.ts`:
- Timeouts: `SHORT_WAIT_TIMEOUT`, `DYNAMIC_FIELD_MAX_ELEMENT_TIMEOUT`
- Selectors: `SUBMIT_BUTTON_LOCATOR`, `LOGIN_STEPS`
- Retry logic: `SUBMIT_CLICK_RETRY_DELAY_S`, `SUBMIT_RETRY_DELAY`

---

## Key Files to Study

When working on specific features, consult these:

| Feature | Key Files |
|---------|-----------|
| **IPC Communication** | `app/backend/src/routes/index.ts`, `app/backend/src/preload/index.ts` |
| **Database** | `app/backend/src/models/index.ts`, `app/backend/src/bootstrap/database/` |
| **Logging** | `app/shared/logger.ts`, `.cursor/rules/logging.mdc` |
| **Testing** | `app/backend/vitest.config.unit.ts`, `app/backend/tests/` |
| **Styling** | `app/frontend/src/m3-tokens.css`, `.cursor/rules/styling.mdc` |
| **Plugin System** | `app/shared/plugin-types.ts`, `app/shared/plugin-registry.ts` |
| **App Startup** | `app/backend/src/main.ts`, `app/backend/src/core/AppController.ts` |
| **Validation** | `app/backend/src/validation/`, schemas using Zod |

---

## Common Patterns & Anti-Patterns

### ✅ Do

- Use preload bridges for frontend→backend: `window.database.getEntries(token)`
- Log with context: `logger.info('Entry created', { id, date, hours })`
- Validate all IPC inputs with Zod schemas
- Use native SQLite transactions for atomic operations
- Check sender trust in IPC handlers: `isTrustedIpcSender(event)`
- Create isolated test databases in `beforeEach` hooks
- Use M3 CSS variables for all styling

### ❌ Don't

- Import `ipcRenderer` directly in frontend (use preload bridges)
- Hard-code colors/spacing in CSS (use design tokens)
- Mix ESM and CommonJS (all ESM)
- Log sensitive data (PII, tokens, passwords)
- Skip validation on IPC handlers
- Use `any` types (prefer strict TypeScript)
- Write console.log in production code (use logger)

---

## Extension Points

If adding new features:

1. **New IPC Handler**: Create file in `app/backend/src/routes/`, register in `routes/index.ts`, add preload bridge in `preload/bridges/`
2. **New Plugin**: Implement `IPlugin` interface, register in `bootstrap/plugins/`
3. **New Logger**: Extend logger config in `app/shared/logger-config.ts`
4. **New Validation**: Add Zod schema in `app/backend/src/validation/`
5. **New Database Table**: Update schema in `bootstrap/database/schema.sql`, add repository functions

---

## Questions or Unclear Sections?

If this guide is unclear about any aspect (architecture, workflow, pattern), ask for clarification before implementing. The project uses sophisticated patterns (plugin system, context isolation, structured logging) that differ from simpler apps.
