# Vitest Setup - Industry Standards Guide

## Overview

This project uses **Vitest** as the unified test runner for all test suites across the monorepo. The VS Code Vitest Extension provides a native testing UI integrated into your IDE.

## Project Structure

```
Sheetpilot/
├── vitest.config.ts                    # Root workspace config
├── app/
│   ├── backend/
│   │   ├── vitest.config.unit.ts       # Unit tests (5s timeout)
│   │   ├── vitest.config.integration.ts # Integration tests (120s timeout)
│   │   ├── vitest.config.e2e.ts        # E2E tests (120s timeout)
│   │   ├── vitest.config.smoke.ts      # Smoke tests (60s timeout)
│   │   └── tests/
│   ├── frontend/
│   │   ├── vitest.config.ts            # Frontend React tests (10s timeout)
│   │   └── tests/
│   └── shared/
│       ├── vitest.config.ts            # Shared library tests (5s timeout)
│       └── tests/
└── .vscode/
    ├── settings.json                    # Vitest plugin settings
    ├── launch.json                      # Debug configurations
    └── extensions.json                  # Recommended extensions
```

## How to Use

### 1. Opening Tests in VS Code

- Open the **Testing** sidebar (left panel icon or `Ctrl+Shift+D`)
- All test projects will be auto-discovered:
  - `backend-unit`
  - `backend-integration`
  - `backend-e2e`
  - `backend-smoke`
  - `frontend`
  - `shared`

### 2. Running Tests

**From the Testing UI:**
- Click **▶** next to a project to run all tests
- Click **▶** next to a file to run tests in that file
- Click **▶** next to a test to run a single test
- Click **🔄** (refresh icon) to reload test discovery

**Keyboard Shortcuts:**
- `Ctrl+Shift+D` - Open Testing sidebar
- Double-click test to jump to source
- Right-click test for context menu (run, debug, reveal)

### 3. Watch Mode

The extension supports automatic re-run on save:

1. Right-click a project in the Testing sidebar
2. Select "Run in Watch Mode"
3. Tests will re-run whenever you save a file

### 4. Debugging Tests

**Debug a Single Test:**
1. Open the test file in the editor
2. Click the ▶ Debug icon next to the test name
3. Or use the Testing sidebar context menu → "Debug"

**Pre-configured Debug Targets (F5):**
- `Debug Vitest Tests` - Run all tests with debugger
- `Debug Vitest (Current File)` - Debug tests in current file
- `Debug Vitest (Watch Mode)` - Watch mode with debugger
- `Debug Backend Unit Tests` - Backend-specific debugging
- `Debug Frontend Tests` - Frontend-specific debugging
- `Debug Shared Tests` - Shared library debugging

### 5. Coverage

Generate coverage reports:

1. Right-click a project in Testing sidebar
2. Select "Show Coverage"
3. Or from command palette: `Vitest: Show Coverage`

Coverage outputs:
- `coverage/` folder with HTML report
- Open `coverage/index.html` in browser for visualization

## Configuration Details

### Timeouts

Each project has appropriate timeouts:

| Project | Timeout | Hook Timeout |
|---------|---------|--------------|
| Unit Tests | 5s | 10s |
| Integration | 120s | 30s |
| E2E | 120s | 30s |
| Smoke | 60s | 15s |
| Frontend | 10s | 10s |
| Shared | 5s | 10s |

### Thread Pooling

Tests run in parallel for better performance:

| Project | Max Threads | Min Threads |
|---------|-------------|------------|
| Unit/Smoke | 4 | 1 |
| Integration | 2 | 1 |
| E2E | 1 | 1 |
| Frontend | 4 | 1 |
| Shared | 4 | 1 |

E2E runs single-threaded to avoid race conditions.

### Coverage Thresholds

All projects enforce 70% coverage minimums:
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

Excluded from coverage:
- Test files (`*.spec.ts`, `*.test.ts`)
- `node_modules/`
- `dist/`, `build/`, `coverage/`

### Environment Detection

- **Development**: Verbose output, default reporter
- **CI** (GitHub Actions): Verbose reporter for logs

Set via environment variable:
```bash
CI=true npx vitest run
```

## Best Practices

### Writing Tests

1. **File Naming**: Use `.spec.ts` or `.test.ts` suffix
2. **Globals**: No need to import `describe`, `it`, `expect` (enabled globally)
3. **Async Tests**: Use `async`/`await` syntax
4. **Mocking**: Prefer `vi.mock()` over manual mocks

### Test Organization

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Behavior Category', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'value';
      
      // Act
      const result = someFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Performance Tips

1. **Use `describe.skip()` to temporarily disable test groups**
2. **Use `it.skip()` to skip individual tests**
3. **Use `it.only()` to run a single test during development**
4. **Keep unit tests under 5 seconds**
5. **Use test isolation - don't depend on test execution order**

### Common Patterns

**Mocking Modules:**
```typescript
vi.mock('@/services/api', () => ({
  fetchData: vi.fn(() => Promise.resolve([])),
}));
```

**Spying on Functions:**
```typescript
const spy = vi.spyOn(console, 'log');
expect(spy).toHaveBeenCalledWith('message');
spy.mockRestore();
```

**Testing Async Code:**
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## Troubleshooting

### Tests Not Discovered

1. Check file naming: Must end with `.spec.ts`, `.test.ts`, `.spec.tsx`, or `.test.tsx`
2. Verify file location in `include` patterns in vitest.config.ts
3. Refresh: Click the 🔄 icon in Testing sidebar
4. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"

### Import Path Issues

All projects use alias imports:
- `@/` points to `src/` or project root
- `@tests/` points to `tests/` (frontend only)

### Timeout Issues

- Increase timeout in vitest.config.ts `testTimeout`
- Check for unresolved promises or infinite loops
- Use `it.skip()` temporarily if blocking CI

### Memory Issues

- Reduce `maxThreads` in `poolOptions`
- Run projects individually instead of all at once
- Check for memory leaks in test setup/teardown

## CI/CD Integration

The setup is ready for GitHub Actions or similar CI systems:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npx vitest run
  env:
    CI: true
```

All tests will use verbose reporter and fail on coverage thresholds.

## IDE Integration

### VS Code Extensions Recommended

- **Vitest** (vitest.explorer) - Already installed
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **Playwright Test** (ms-playwright.playwright)
- **GitLens** (eamodio.gitlens)

Install via: Extensions sidebar or `Code → Preferences → Extensions`

### File Nesting

Test files are automatically nested under source files:
- `component.tsx` → shows `component.spec.tsx` indented below

Toggle: Click 📁 icon in Explorer or `explorer.fileNesting.enabled` setting

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest VS Code Extension](https://marketplace.visualstudio.com/items?itemName=vitest.explorer)
- [Testing Library Docs](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
