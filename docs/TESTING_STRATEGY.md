# Comprehensive AI-Resistant Testing Strategy

## Overview

This document outlines the comprehensive testing strategy implemented to prevent code regression from AI agents editing the codebase. The strategy uses a multi-layered approach with contract validation, comprehensive unit tests, integration tests, and E2E tests organized in tiers for both speed and comprehensive coverage.

## Architecture

### Test Organization

```
__tests__/
├── contracts/          # Contract validation tests
├── unit/              # Fast unit tests for business logic
├── integration/       # Integration tests with mocked externals
├── e2e/               # End-to-end workflow tests
├── smoke/             # Quick smoke tests for CI/CD
├── fixtures/          # Reusable test data
└── helpers/           # Test utilities and builders
```

### Test Tiers

1. **Smoke Tests** (~10s): Critical path validation
2. **Unit Tests** (~30s): Business logic, validation, utilities
3. **Integration Tests** (~2min): IPC handlers, database operations, plugin system
4. **E2E Tests** (~5min): Full workflows with mocked external services

## Implementation Details

### 1. Contract Testing Layer

**Purpose**: Prevent AI from breaking data contracts between layers

**Files**:
- `__tests__/contracts/ipc-contracts.spec.ts` - Validate IPC payload schemas
- `__tests__/contracts/database-schema.spec.ts` - Validate database schema integrity
- `__tests__/contracts/plugin-contracts.spec.ts` - Validate plugin interface implementations
- `__tests__/contracts/renderer-main-contracts.spec.ts` - Validate renderer-main communication

**Key Validations**:
- IPC handler signatures match renderer expectations
- Database schema matches `DbTimesheetEntry` interface
- Plugin implementations satisfy `IDataService`, `ISubmissionService`, `ICredentialService`
- Time conversion consistency (HH:MM ↔ minutes since midnight)
- Date format consistency (mm/dd/yyyy ↔ yyyy-mm-dd)

### 2. Business Logic Unit Tests

**Purpose**: Protect critical business rules from modification

**Files**:
- `__tests__/unit/validation-rules.spec.ts` - All validation logic
- `__tests__/unit/dropdown-cascading.spec.ts` - Dropdown dependency rules
- `__tests__/unit/quarter-validation.spec.ts` - Quarter availability logic
- `__tests__/unit/time-normalization.spec.ts` - Time format conversions
- `__tests__/unit/date-normalization.spec.ts` - Date format conversions

**Critical Rules Tested**:
- Date validation (mm/dd/yyyy format, valid dates, quarter availability)
- Time validation (HH:MM or numeric format, 15-minute increments)
- Time out > time in validation
- Project → Tool cascading (projects without tools clear tool/chargeCode)
- Tool → ChargeCode cascading (tools without charges clear chargeCode)
- Required field validation (date, timeIn, timeOut, project, taskDescription)
- Database constraints (time_in/time_out range, 15-min increments, uniqueness)

### 3. Smoke Tests

**Purpose**: Fast validation for CI/CD pipeline

**File**: `__tests__/smoke/critical-paths.spec.ts`

**Critical Paths** (must complete in <10s):
- Application launches without errors
- Database schema initializes correctly
- IPC handlers register successfully
- TimesheetGrid renders with blank row
- Basic validation rules work (date, time, required fields)
- Save draft IPC call succeeds
- Load draft IPC call succeeds

### 4. Test Infrastructure

**Files**:
- `__tests__/fixtures/timesheet-data.ts` - Reusable test data
- `__tests__/fixtures/mock-database.ts` - In-memory database for tests
- `__tests__/helpers/test-builders.ts` - Builder pattern for test data
- `__tests__/helpers/assertion-helpers.ts` - Custom assertions
- `__tests__/vitest.config.smoke.ts` - Smoke test configuration
- `__tests__/vitest.config.integration.ts` - Integration test configuration
- `__tests__/vitest.config.e2e.ts` - E2E test configuration

## AI Regression Protection Strategy

### Contract Guards

- **Schema validation**: TypeScript interfaces match database schema
- **IPC payload validation**: Zod schemas for all IPC messages
- **Plugin interface validation**: Runtime checks for required methods

### Business Rule Guards

- **Validation matrix**: Test all combinations of project/tool/chargeCode
- **Boundary testing**: Min/max values, edge cases, invalid inputs
- **Cascading rule verification**: Changes propagate correctly through dependencies

### Data Integrity Guards

- **Round-trip testing**: Data survives serialization/deserialization
- **Format consistency**: Time/date conversions are reversible
- **Constraint enforcement**: Database constraints prevent invalid data

### UI Behavior Guards

- **Event handler verification**: Clicks, edits, navigation work correctly
- **State management validation**: Context updates propagate to components
- **IPC communication**: Renderer-main calls succeed with correct payloads

## Test Scripts

```json
{
  "test:smoke": "vitest run --config __tests__/vitest.config.smoke.ts",
  "test:unit": "vitest run --config __tests__/vitest.config.ts",
  "test:integration": "vitest run --config __tests__/vitest.config.integration.ts",
  "test:e2e": "vitest run --config __tests__/vitest.config.e2e.ts",
  "test:contracts": "vitest run __tests__/contracts",
  "test:all": "npm run test:smoke && npm run test:unit && npm run test:integration && npm run test:e2e",
  "test:watch": "vitest --config __tests__/vitest.config.ts"
}
```

## CI/CD Integration

### GitHub Actions Workflows

1. **Smoke Tests** (`.github/workflows/test-smoke.yml`)
   - Runs on every commit and PR
   - Completes in <5 minutes
   - Validates critical paths

2. **Full Test Suite** (`.github/workflows/test-full.yml`)
   - Runs on main branch pushes and PRs
   - Parallel execution of all test types
   - Comprehensive coverage validation

## Success Metrics

- **Contract Tests**: 100% coverage of all interfaces and schemas
- **Business Logic**: 100% coverage of validation and cascading rules
- **Component Tests**: 90%+ coverage of UI components
- **Integration Tests**: All critical workflows covered
- **E2E Tests**: All user journeys covered
- **Smoke Tests**: Complete in <10 seconds
- **Full Suite**: Complete in <8 minutes

## Maintenance Strategy

1. **Contract tests fail first**: If AI breaks a contract, tests fail immediately
2. **Business rule tests**: Validate logic hasn't changed unexpectedly
3. **Integration tests**: Catch layer interaction issues
4. **E2E tests**: Verify complete workflows still function
5. **Test data versioning**: Update fixtures when business rules change legitimately

## Running Tests

### Development
```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:smoke
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:contracts

# Watch mode for development
npm run test:watch
```

### CI/CD
- Smoke tests run automatically on every commit
- Full test suite runs on PRs and main branch pushes
- Test results are uploaded as artifacts
- Coverage reports are generated and stored

## Best Practices

1. **Always run smoke tests before committing**
2. **Update test data when business rules change**
3. **Add new tests for any new business logic**
4. **Keep test execution times within limits**
5. **Use descriptive test names and assertions**
6. **Mock external dependencies appropriately**
7. **Validate both success and failure scenarios**

## Troubleshooting

### Common Issues

1. **Test timeouts**: Increase timeout values in vitest config
2. **Mock failures**: Ensure all external dependencies are mocked
3. **Data inconsistencies**: Update test fixtures to match current schema
4. **Performance issues**: Optimize test data and reduce test scope

### Debug Mode

```bash
# Run tests with verbose output
npm run test:unit -- --reporter=verbose

# Run specific test file
npm run test:unit -- validation-rules.spec.ts

# Run tests with debugging
npm run test:unit -- --inspect-brk
```

This comprehensive testing strategy ensures that AI agents cannot introduce regressions without being caught by the test suite, providing confidence in code changes and maintaining system reliability.
