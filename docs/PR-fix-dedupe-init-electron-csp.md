# PR: Fix Dedupe Dev Logs + Hardened Electron CSP

## Summary

This PR fixes duplicate initialization logs in development mode and eliminates the Electron CSP security warning by implementing safe, reversible guardrails. Includes comprehensive smoke tests to verify the fixes.

## Problem Statement

### Issues Identified

1. **Duplicate Initialization Logs**: The renderer was logging initialization messages multiple times due to:
   - React StrictMode double-renders (intentional React behavior)
   - Hot Module Replacement (HMR) re-importing modules
   - No idempotency guard on module-level initialization code

2. **Electron CSP Security Warning**: Console showed:
   ```
   Electron Security Warning (Insecure Content-Security-Policy)
   This renderer process has either no Content Security Policy set or a policy with "unsafe-eval" enabled.
   ```
   Both HTML files had `'unsafe-eval'` in their CSP, exposing users to XSS attacks.

3. **Excessive Console Logging**: Component render logs appeared 14+ times per reload, making debugging difficult.

### Reproduction Steps (Before Fix)

1. Run `npm run dev`
2. Open DevTools Console
3. Observe:
   - Multiple "=== APP LOADING ===" logs
   - Multiple "[APIFallback] Initializing..." logs
   - Electron CSP warning message
   - 14+ "=== APP CONTENT RENDERING ===" logs

## Solution

### Changes Made

#### 1. Global Initialization Guard (`app/frontend/src/utils/safe-init.ts`)

**New file** providing idempotent initialization:

```typescript
declare global {
  interface Window {
    __appInitialized?: boolean;
  }
}

export function runOnce(initFn: () => void, debugLabel: string): void {
  if (!window.__appInitialized) {
    window.__appInitialized = true;
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[app] init:1 ts:${performance.now().toFixed(2)}ms label:${debugLabel}`);
    }
    initFn();
  }
}
```

**Why safe**:
- Uses global flag to prevent duplicate execution
- No side effects beyond setting flag
- Fully reversible by removing guard
- Development-only diagnostic logging

#### 2. Updated Renderer Entry Point (`app/frontend/src/main.tsx`)

**Before**:
```typescript
// Initialize logger fallback for development mode
initializeLoggerFallback();

// Initialize API fallbacks for development mode
initializeAPIFallback();
```

**After**:
```typescript
// Initialize logger and API fallbacks for development mode (idempotent with guard)
runOnce(() => {
  initializeLoggerFallback();
  initializeAPIFallback();
}, 'renderer-init');
```

**Risk**: Low - Guard is fail-safe, worst case initialization runs twice (original behavior)

#### 3. Hardened CSP in HTML Files

**Before** (`app/frontend/index.html` and `app/frontend/public/index.html`):
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: wss:; ..." />
```

**After**:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none';" />
```

**Changes**:
- ❌ Removed `'unsafe-eval'` (security vulnerability)
- ✅ Kept `'unsafe-inline'` for scripts (required for Vite HMR)
- ✅ Kept `'unsafe-inline'` for styles (required for Material-UI)
- ✅ Added `object-src 'none'` (blocks plugins)
- ✅ Maintained `ws: wss:` for WebSocket (Vite HMR)

**Risk**: Low - Application doesn't use `eval()`, `new Function()`, or similar constructs

**Revert if needed**: Restore previous CSP (not recommended for security)

#### 4. Improved Logging in App.tsx

**Before**:
```typescript
console.log('=== APP LOADING ===');
console.log('Environment:', ...);
console.log('Active tab:', activeTab);
```

**After**:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.debug(`[App] render ts:${performance.now().toFixed(2)}ms env:${import.meta.env.DEV ? 'dev' : 'prod'}`);
}
```

**Benefits**:
- Reduced console noise
- Performance timestamps for debugging
- Acknowledges React StrictMode behavior
- Gated behind development check

#### 5. Development Smoke Tests

**New files**:
- `scripts/dev-smoke.sh` (Linux/Mac)
- `scripts/dev-smoke.ps1` (Windows)

**What they verify**:
- ✅ Exactly one initialization (`init:1` appears once)
- ✅ No CSP warnings in console
- ✅ Acceptable render counts (1-4 for StrictMode)

**Usage**:
```bash
# Linux/Mac
bash scripts/dev-smoke.sh

# Windows
powershell scripts/dev-smoke.ps1

# Or via npm
npm run dev:smoke
```

## Testing

### Automated Tests

1. **Existing tests pass**:
   ```bash
   npm run test        # All test suites
   npm run lint        # ESLint checks
   npm run type-check  # TypeScript compilation
   ```

2. **New smoke test**:
   ```bash
   bash scripts/dev-smoke.sh  # Verifies fixes
   ```

### Manual Verification Steps

1. **Verify single initialization**:
   ```bash
   npm run dev
   # Open DevTools Console
   # Search for "init:1" - should appear exactly once
   # Search for "init:skipped" - may appear on HMR
   ```

2. **Verify no CSP warnings**:
   ```bash
   npm run dev
   # Open DevTools Console
   # Search for "Insecure Content-Security-Policy" - should be 0 results
   ```

3. **Verify reduced logging**:
   ```bash
   npm run dev
   # Open DevTools Console
   # Enable "Verbose" level to see debug logs
   # Observe clean, structured logging with timestamps
   ```

4. **Verify app functionality**:
   - Login works
   - Timesheet grid loads
   - Archive tab loads
   - Help tab loads
   - All IPC communication works

### Smoke Test Output Example

**Expected output** (PASS):
```
🚀 Starting development smoke test...

📦 Starting dev server...
⏳ Waiting for dev server to start (10 seconds)...
✅ Dev server started successfully (PID: 12345)

🔍 Analyzing console output...

📊 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Initialization count: 1 (expected: 1)
✅ CSP warnings: 0 (expected: 0)
✅ App renders: 2 (acceptable: 1-4 for StrictMode)
✅ AppContent renders: 2 (acceptable: 1-4 for StrictMode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All smoke tests PASSED

Summary:
  - Single initialization verified
  - No CSP warnings detected
  - Render counts are within acceptable range
```

## Risk Assessment

### Low Risk Changes ✅

- Global initialization guard (fail-safe design)
- Console logging improvements (cosmetic)
- Smoke test scripts (diagnostic only)

### Medium Risk Changes ⚠️

- CSP hardening (removed `'unsafe-eval'`)
  - **Mitigation**: Application code doesn't use `eval()`
  - **Tested**: Full functionality verification passed
  - **Reversible**: Restore previous CSP if issues arise

### High Risk Changes ❌

- None. All changes are safe, tested, and reversible.

## Reverting Changes

If issues arise, revert in this order:

### Revert CSP Changes (if eval required for dev tools)
```bash
git checkout HEAD -- app/frontend/index.html app/frontend/public/index.html
```

### Revert Initialization Guard
```bash
git checkout HEAD -- app/frontend/src/utils/safe-init.ts app/frontend/src/main.tsx
```

### Revert All Changes
```bash
git revert <commit-hash>
```

## Security Considerations

### Before This PR

- ❌ CSP allowed `'unsafe-eval'` (enables XSS attacks)
- ⚠️ Electron showed security warning
- ⚠️ Potential for malicious script injection

### After This PR

- ✅ CSP blocks `eval()` and `new Function()`
- ✅ No Electron security warnings
- ✅ Maintains functionality (Vite HMR, Material-UI)
- ✅ Follows OWASP CSP best practices

### Future Improvements

For even stricter security (not in this PR):

1. **Remove `'unsafe-inline'` for scripts**: Requires rewriting Vite HMR or using nonces
2. **Remove `'unsafe-inline'` for styles**: Requires CSS-in-JS with nonces or hashes
3. **Strict CSP**: Use `strict-dynamic` with nonces

These changes require significant refactoring and are out of scope for this fix.

## React StrictMode Note

**Why StrictMode double-renders in development**:

React StrictMode intentionally invokes certain functions twice to help detect side effects. This includes:
- Component render functions
- Component body (useState, useMemo, useReducer)
- Constructor
- Functions passed to useState, useMemo, or useReducer

This is **documented React behavior** and helps catch bugs. Our code now handles this correctly with idempotent initialization.

**StrictMode remains enabled** as it provides valuable development-time checks. To temporarily disable for debugging (not recommended for production):

```typescript
// In main.tsx (temporary debugging only)
createRoot(document.getElementById('root')!).render(
  // <StrictMode>  // Comment out temporarily
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {mountSplash ? <Splash /> : <App />}
    </ThemeProvider>
  // </StrictMode>
);
```

**Never disable StrictMode in production or permanent branches.**

## Checklist

- [x] All changes are atomic and reversible
- [x] No credentials, secrets, or hardcoded paths added
- [x] React StrictMode remains enabled
- [x] No `nodeIntegration` or `'unsafe-eval'` in production
- [x] Changes gated behind `NODE_ENV === 'development'` where appropriate
- [x] Smoke tests pass
- [x] Linter passes
- [x] Type checking passes
- [x] All existing tests pass
- [x] Manual functionality verification complete
- [x] CHANGELOG updated
- [x] PR description complete

## Files Changed

```
Modified:
  app/frontend/src/main.tsx              (Added initialization guard)
  app/frontend/src/App.tsx                (Improved logging)
  app/frontend/index.html                 (Hardened CSP)
  app/frontend/public/index.html          (Hardened CSP)
  package.json                            (Added dev:smoke script)

Added:
  app/frontend/src/utils/safe-init.ts    (Initialization guard utility)
  scripts/dev-smoke.sh                    (Bash smoke test)
  scripts/dev-smoke.ps1                   (PowerShell smoke test)
  docs/CHANGELOG.md                       (Changelog entry)
  docs/PR-fix-dedupe-init-electron-csp.md (This document)
```

## Commit History

```
1. fix(renderer): implement global initialization guard to prevent duplicates
2. fix(electron): remove unsafe-eval from CSP and harden security policy
3. fix(renderer): improve development logging with timestamps and debug level
4. test(dev): add smoke test scripts for Linux/Mac and Windows
5. docs: add CHANGELOG entry for dedupe init and CSP fixes
```

## Verification Commands

```bash
# Run all checks
npm run lint && npm run type-check && npm run test

# Run smoke test
bash scripts/dev-smoke.sh  # Linux/Mac
powershell scripts/dev-smoke.ps1  # Windows

# Manual verification
npm run dev
# Check console for:
# - Single "init:1" log
# - No CSP warnings
# - Clean, timestamped debug logs
```

## References

- [React StrictMode Documentation](https://react.dev/reference/react/StrictMode)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [MDN CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

