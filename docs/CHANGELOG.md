# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2025-11-04

### Fixed
- **Duplicate initialization logs in development mode**: Implemented global initialization guard (`window.__appInitialized`) to prevent duplicate module-level initializations caused by Hot Module Replacement (HMR) and React StrictMode double-renders. Module-level initialization now runs exactly once.
  
- **Electron CSP security warning**: Removed `'unsafe-eval'` from Content-Security-Policy in both development and production HTML files. The CSP now enforces strict security without allowing unsafe evaluations, eliminating Electron's "Insecure Content-Security-Policy" warning.

- **Excessive console logging**: Replaced console.log statements with console.debug and gated them behind `process.env.NODE_ENV === 'development'` checks. Added performance timestamps for better debugging. React StrictMode intentionally renders twice in development; our logging now accounts for this behavior without spamming the console.

### Added
- **Safe initialization utility** (`app/frontend/src/utils/safe-init.ts`): New utility module providing `runOnce()` function to ensure idempotent initialization with performance diagnostics.

- **Development smoke test scripts**:
  - `scripts/dev-smoke.sh` (Linux/Mac): Bash script to verify single initialization and absence of CSP warnings
  - `scripts/dev-smoke.ps1` (Windows): PowerShell equivalent for Windows environments
  - Both scripts start the dev server, capture console output, and assert expected behavior (single init, no CSP warnings, acceptable render counts)

### Security
- **Hardened Content-Security-Policy**: CSP now follows best practices by removing `'unsafe-eval'` while maintaining necessary functionality. The policy allows:
  - Scripts: `'self' 'unsafe-inline'` (required for Vite HMR in development)
  - Styles: `'self' 'unsafe-inline'` (required for Material-UI dynamic styles)
  - Images: `'self' data: blob:` (required for logos and dynamic content)
  - Fonts: `'self' data:` (required for custom fonts)
  - WebSocket connections: `ws: wss:` (required for Vite HMR)
  - Explicit `object-src 'none'` to prevent plugin-based attacks

- **Electron security settings verified**: Confirmed BrowserWindow uses secure defaults:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webSecurity: true`
  - `allowRunningInsecureContent: false`

### Changed
- **React StrictMode remains enabled**: StrictMode intentionally causes double-renders in development to catch side effects. This is a feature, not a bug. Our initialization logic is now idempotent and StrictMode-safe.

- **Logging strategy**: Development logs now use `console.debug` with structured format:
  ```
  [Component] action ts:{timestamp}ms context:{data}
  ```

### Notes
- **Why StrictMode stays enabled**: React StrictMode helps detect potential problems by intentionally double-invoking certain functions (including component renders and effects) in development mode. This is documented React behavior and helps catch bugs early. Our code now handles this correctly.

- **Reverting changes**: All changes are atomic and reversible. To revert:
  1. Restore previous CSP with `'unsafe-eval'` (not recommended)
  2. Remove `runOnce()` guard and restore direct initialization calls
  3. Restore console.log statements from console.debug

## [1.3.7] - Previous Release
(Previous changelog entries would go here)

