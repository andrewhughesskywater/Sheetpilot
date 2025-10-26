# Blank Screen Prevention Tests

This directory contains comprehensive tests designed to prevent the blank white screen issue that occurred when running the application in development mode.

## Problem Solved

The original issue was caused by missing Electron APIs (`window.logger`, `window.timesheet`, `window.credentials`, etc.) when running the app in the browser development environment (Vite dev server). This caused JavaScript errors that prevented the React app from rendering, resulting in a blank white screen.

## Test Files

### 1. `blank-screen-prevention.spec.tsx`
- **Purpose**: Tests the main App component under various API availability scenarios
- **Coverage**: 
  - Development environment with/without APIs
  - Production environment with/without APIs
  - API error handling
  - Component loading and rendering
  - Error boundary behavior

### 2. `fallback-utilities.spec.tsx`
- **Purpose**: Tests the fallback utility functions themselves
- **Coverage**:
  - Logger fallback initialization and functionality
  - API fallback initialization and functionality
  - Integration between fallbacks
  - Environment-specific behavior (dev vs production)

### 3. `e2e-blank-screen-prevention.spec.tsx`
- **Purpose**: End-to-end tests that simulate the exact scenario that caused the blank screen
- **Coverage**:
  - Original blank screen scenario reproduction
  - Exact error sequence that caused the issue
  - Development vs production environment differences
  - API timeout and malformed response handling

## Running the Tests

### Run All Blank Screen Prevention Tests
```bash
npm run test:blank-screen
```

### Run Tests in Watch Mode
```bash
npm run test:blank-screen:watch
```

### Run Individual Test Files
```bash
# Run specific test file
cd src/renderer
npm test blank-screen-prevention.spec.tsx

# Run fallback utilities tests
npm test fallback-utilities.spec.tsx

# Run E2E tests
npm test e2e-blank-screen-prevention.spec.tsx
```

### Run with Coverage
```bash
cd src/renderer
npm test -- --coverage
```

## Test Configuration

The tests use a custom Vitest configuration (`__tests__/vitest.config.blank-screen-prevention.ts`) that:
- Sets up jsdom environment for React testing
- Includes proper setup files
- Configures coverage reporting
- Sets up path aliases

## CI/CD Integration

The tests are automatically run in GitHub Actions via `.github/workflows/blank-screen-prevention.yml`:
- Runs on every push and pull request
- Tests multiple Node.js versions (18.x, 20.x)
- Includes integration tests
- Runs the automated bot tests
- Uploads test results and screenshots

## What These Tests Prevent

1. **Blank White Screen**: Ensures the app renders correctly even when APIs are missing
2. **JavaScript Errors**: Validates that missing APIs don't cause runtime errors
3. **Development Environment Issues**: Tests both browser and Electron environments
4. **API Fallback Failures**: Ensures fallback systems work correctly
5. **Regression**: Prevents the original issue from happening again

## Test Scenarios Covered

### API Availability Scenarios
- ✅ All APIs available (normal Electron environment)
- ✅ No APIs available (browser dev environment)
- ✅ Partial APIs available (mixed environment)
- ✅ APIs return errors
- ✅ APIs timeout
- ✅ APIs return malformed data

### Environment Scenarios
- ✅ Development mode with fallbacks
- ✅ Production mode without fallbacks
- ✅ Mixed environments

### Error Scenarios
- ✅ JavaScript errors from missing APIs
- ✅ Network errors
- ✅ Component rendering errors
- ✅ Lazy loading errors

## Maintenance

These tests should be updated when:
1. New APIs are added to the window object
2. Fallback systems are modified
3. The main App component structure changes
4. New development environments are added

## Bot Tests

In addition to unit tests, automated bot tests are available:
- `test-app-bot.js`: Tests Vite dev server functionality
- `comprehensive-test-bot.js`: Tests both dev and production environments

Run bot tests:
```bash
node test-app-bot.js
node comprehensive-test-bot.js
```

## Success Criteria

The tests pass when:
1. App renders without blank screen in all scenarios
2. No JavaScript errors occur from missing APIs
3. Fallback systems initialize correctly
4. Both development and production environments work
5. All components load and render properly
6. Error boundaries catch and handle errors gracefully
