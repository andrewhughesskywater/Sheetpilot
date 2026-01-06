# AI Assistant Instructions for Sheetpilot

**Purpose:** Essential knowledge for AI agents to be immediately productive in this Electron-based timesheet management codebase.

## Architecture Overview 🔧

**Electron app with two independent runtimes:**

1. **Main Process (Backend)** — `app/backend/src/main.ts`
   - Database bootstrap (SQLite via `better-sqlite3`)
   - Plugin system initialization (`registerDefaultPluginsBootstrap()`)
   - IPC handler registration (all handlers live in `app/backend/src/ipc/`)
   - Window management and lifecycle

2. **Renderer Process (Frontend)** — `app/frontend` (React + Vite)
   - Compiled Vite assets loaded by window loader (`bootstrap/windows/load-renderer`)
   - Communicates with main process via typed IPC bridges in preload

3. **Shared Layer** — `app/shared`
   - Types, plugin registry, feature flags, business constants
   - `plugin-config.ts` resolves active plugins from `plugin-config.json` or `SHEETPILOT_PLUGIN_CONFIG` env var
   - `logger.ts` provides structured logging contract for both runtimes

**Key architectural patterns:**
- **IPC Pattern**: Main registers handlers via `registerAllIPCHandlers()` → preload exposes as `window.<domain>.*` (e.g., `window.timesheet.submit()`)
- **Plugin System**: Configuration-driven; namespace boundaries (data, credentials, submission, ui) initialized in bootstrap
- **Separation**: Frontend never imports backend modules directly; all communication flows through IPC and preload bridges

## Priority Files 📚

| Purpose | File |
|---------|------|
| Application startup & lifecycle | `app/backend/src/main.ts` |
| Preload API surface | `app/backend/src/preload.ts` |
| IPC handler registration & list | `app/backend/src/ipc/index.ts` |
| Domain-scoped handlers | `app/backend/src/ipc/*-handlers.ts` (auth, credentials, timesheet, etc.) |
| Plugin configuration | `plugin-config.json`, `app/shared/plugin-config.ts` |
| Test setup & mocks | `app/backend/tests/setup.ts` |
| Architecture reference | `docs/app-architecture-{hierarchical,dataflow}.xml` |

## Development Commands ⚙️

**Setup:**
```bash
npm install                    # Install all workspaces
npm run rebuild               # Rebuild native modules (required for better-sqlite3)
npm run install:browsers      # Install Playwright browsers for testing
```

**Development:**
```bash
npm run dev                   # Start Vite + build main + launch Electron
npm run dev:watch            # Same with auto-rebuild on main changes
npm run vite                 # Frontend only (Vite server on :5173)
npm run reset-db             # Clear dev database
```

**Testing:**
```bash
npm test                     # Run all suites (smoke → unit → integration → e2e → renderer)
npm run test:unit           # Backend unit tests
npm run test:integration    # Backend integration tests
npm run test:e2e            # Backend e2e with bot
npm run test:renderer       # Frontend component tests
npm run test:watch          # Watch mode for unit tests
```

**Build & Validation:**
```bash
npm run validate:quick       # typecheck + compile + bundle validation
npm run validate:full        # quick + rebuild + package + packaged deps check
npm run build               # Full build → electron-builder
npm run build:dir           # Package-only (no signing)
```

## Conventions & Patterns 📏

**IPC & Preload:**
- Handler names: `<domain>:<action>` (e.g., `timesheet:submit`, `credentials:store`)
- Register in `app/backend/src/ipc/index.ts` via domain-scoped modules
- Preload file (`app/backend/src/preload.ts`) explicitly exposes `window.<domain>` objects with type safety
- Keep preload surface minimal; prefer delegating logic to handlers

**Logging & Debugging:**
- Use `shared/logger` (imported as `appLogger` or `dbLogger` in bootstrap)
- **Logging rules** (from `.cursor/rules/logging.mdc`):
  - Use active voice: "Could not load credentials" not "Credentials loading failed"
  - Include context as second argument: `logger.error('Could not submit', { service, error: err.message })`
  - **Never log** passwords, tokens, or PII (auto-redacted in production unless `SHEETPILOT_LOG_USERNAME=true`)
  - Appropriate levels: `error` (failed ops), `warn` (fallbacks), `info` (state changes), `verbose` (detail)

**Plugin & Feature Flags:**
- Plugin selection: modify `plugin-config.json` or set `SHEETPILOT_PLUGIN_CONFIG` env var
- Feature flags (e.g., `experimentalGrid`, `mockSubmission`) switch plugin behavior
- Resolve variants via `app/shared/plugin-config.ts` helpers before rendering

**UI & Styling:**
- Use Material Design 3 tokens, never hard-coded colors
- Token sources: `--md-sys-color-*`, `--md-sys-typescale-*`, `--space-*` (see `.cursor/rules/styling.mdc`)
- Centralize design tokens in CSS files; avoid inline styles

## Testing Gotchas ✅

**Global mocks in `app/backend/tests/setup.ts`:**
- `better-sqlite3` **must be mocked synchronously** (no async mocks—breaks hoisting)
- In-memory database fixtures used; tests avoid real SQLite initialization
- Playwright/Electron mocked to prevent real browser windows during unit tests

**Vitest configuration:**
- Separate configs per suite: `vitest.config.{ts,unit,integration,e2e,smoke}.ts`
- Always run tests with correct npm script (e.g., `npm run test:unit`, not generic `vitest`)
- CI uses `cross-env VITEST=true` to disable Electron auto-start

## Troubleshooting ⚠️

| Issue | Solution |
|-------|----------|
| `NODE_MODULE_VERSION` mismatch on rebuild | Run `npm run rebuild` after Electron/Node.js version change |
| Tests import native modules and fail | Ensure `app/backend/tests/setup.ts` mocks are applied before import |
| Preload API not available in renderer | Check `app/backend/src/preload.ts` exports and `exposePreloadBridges()` call in `main.ts` |
| Database not persisting between app restarts | Verify DB path configured correctly; check `app/backend/src/bootstrap/database/bootstrap-database.ts` |
| Playwright browser not found in CI | Run `npm run install:browsers` or ensure postinstall scripts execute |

## File Structure Reference 📁

```
app/
├── backend/src/
│   ├── main.ts                          # Startup entry
│   ├── preload.ts                       # Renderer API surface
│   ├── ipc/
│   │   ├── index.ts                     # Handler registration
│   │   ├── *-handlers.ts                # Domain-scoped (timesheet, auth, etc.)
│   │   └── handlers/                    # Handler implementations
│   ├── bootstrap/                       # Initialization modules
│   ├── services/                        # Business logic (submission bot, etc.)
│   ├── repositories/                    # Database access
│   └── middleware/                      # Logging, validation, auth
├── frontend/src/
│   ├── App.tsx                          # Root component
│   ├── components/                      # Reusable UI (Grid, Forms, etc.)
│   ├── contexts/                        # Global state (Auth, Theme)
│   └── services/                        # IPC client wrappers
├── shared/
│   ├── plugin-config.ts                 # Plugin resolver
│   ├── plugin-registry.ts               # Plugin definitions
│   ├── logger.ts                        # Structured logging
│   ├── constants.ts                     # Business constants
│   └── contracts/                       # Shared type definitions
└── tests/
    ├── setup.ts                         # Global mocks
    ├── fixtures/                        # Test data & in-memory DB
    └── {unit,integration,e2e,smoke}/
```

## Key Environment Variables 🔐

- `SHEETPILOT_ADMIN_PASSWORD` — Admin account (required for admin login)
- `SHEETPILOT_ADMIN_USERNAME` — Admin username (default: "Admin")
- `SHEETPILOT_MASTER_KEY` — Encryption key for credential storage (default: machine-specific)
- `SHEETPILOT_PLUGIN_CONFIG` — JSON override for `plugin-config.json`
- `SHEETPILOT_LOG_USERNAME` — Set to allow username in logs (else auto-redacted)
- `NODE_PATH` — Set during dev/test for module resolution (configured in package.json scripts)