# Test Organization Guidelines

## Overview

This document provides comprehensive guidelines for organizing and structuring tests in the SheetPilot codebase. These guidelines ensure consistency, maintainability, and discoverability of tests across all projects.

## Test Directory Structure

### Current Organization

```
app/
├── backend/
│   └── tests/
│       ├── unit/              # Unit tests (pure logic, no dependencies)
│       ├── integration/       # Integration tests (multiple components)
│       ├── ipc/               # IPC handler tests
│       ├── services/          # Service-specific tests
│       ├── repositories/      # Repository/database tests
│       ├── contracts/         # Contract/interface validation tests
│       ├── validation/        # Validation logic tests
│       ├── middleware/        # Middleware tests
│       ├── smoke/             # Smoke tests (quick validation)
│       ├── fixtures/          # Test data and mocks
│       ├── helpers/           # Test utilities and helpers
│       └── setup.ts           # Test setup/configuration
│
├── frontend/
│   └── tests/
│       ├── components/        # Component tests
│       ├── integration/       # Integration tests
│       ├── utils/             # Utility function tests
│       ├── hooks/             # Custom hook tests
│       └── setup.ts           # Test setup/configuration
│
├── shared/
│   └── tests/
│       ├── unit/              # Unit tests for shared modules
│       └── utils/             # Shared utility tests
│
└── tests/                     # Cross-cutting tests
    ├── accessibility/         # Accessibility tests
    ├── e2e/                   # End-to-end tests
    ├── integration/           # Cross-component integration
    ├── performance/           # Performance tests
    └── security/              # Security tests
```

## Test Categories

### Unit Tests

- **Location**: `tests/unit/`
- **Purpose**: Test individual functions/modules in isolation
- **Characteristics**:
  - Fast execution (< 5s per test)
  - No external dependencies (mocked)
  - Test pure logic and transformations
  - No database/network/file system access
- **Examples**: Validation functions, data transformations, calculations

### Integration Tests

- **Location**: `tests/integration/`
- **Purpose**: Test interactions between multiple components
- **Characteristics**:
  - May use real dependencies (database, file system)
  - Test workflows and data flow
  - Longer execution time acceptable (< 30s)
  - Test component integration, not individual units
- **Examples**: Database operations, IPC handlers, service workflows

### Contract Tests

- **Location**: `tests/contracts/`
- **Purpose**: Validate interface/contract compliance
- **Characteristics**:
  - Test that implementations satisfy interfaces
  - Prevent breaking changes to contracts
  - Validate plugin interfaces
- **Examples**: Plugin interface validation, IPC contract validation

### E2E Tests

- **Location**: `tests/e2e/` or `app/tests/e2e/`
- **Purpose**: Test complete user workflows
- **Characteristics**:
  - Test full application flows
  - May use real browser/database
  - Longer execution time acceptable
  - Test user journeys, not technical implementation
- **Examples**: User registration flow, timesheet submission flow

### Smoke Tests

- **Location**: `tests/smoke/`
- **Purpose**: Quick validation of critical paths
- **Characteristics**:
  - Very fast execution (< 10s total)
  - Test only critical functionality
  - Run in CI/CD pipelines
  - Catch major breakages quickly
- **Examples**: Critical path validation, basic functionality checks

## File Organization Rules

### 1. Test File Naming

**Format**: `<component-name>.spec.ts` or `<component-name>.test.ts`

**Rules**:

- Use `.spec.ts` for specification-style tests (preferred)
- Use `.test.ts` for test-style tests (acceptable)
- Match test file name to source file name when possible
- Use kebab-case for multi-word names
- Group related tests in single files when logical

**Examples**:

- `timesheet-validation.spec.ts` ✅
- `TimesheetValidation.spec.ts` ❌ (PascalCase)
- `timesheet_validation.spec.ts` ❌ (snake_case)
- `timesheet-validation.test.ts` ✅ (acceptable)

### 2. Directory Structure by Feature

**Rule**: Mirror source code structure when logical

**Examples**:

- `src/services/database.ts` → `tests/services/database.spec.ts`
- `src/components/TimesheetGrid.tsx` → `tests/components/TimesheetGrid.spec.tsx`
- `src/utils/validation.ts` → `tests/utils/validation.spec.ts`

**Exception**: Integration tests that span multiple features belong in `tests/integration/`

### 3. Test File Location Rules

**Rule**: Keep tests close to source when testing single component, use integration directory for multi-component tests

**Examples**:

- Single component test → `tests/components/LoginDialog.spec.tsx`
- Multi-component workflow → `tests/integration/auth-flow.spec.tsx`
- Cross-cutting concern → `app/tests/security/authentication.spec.ts`

## Test Structure and Organization

### Test Suite Organization

```typescript
describe('Component Name', () => {
  // Setup/teardown hooks
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Feature/Behavior Category', () => {
    it('should do something specific', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Naming Conventions

**Test Suite Names**:

- Use descriptive names: `describe('TimesheetGrid', () => {`
- Include component/feature name
- Use sentence case (capitalize first word only)

**Test Case Names**:

- Use "should" statements: `it('should validate date format', () => {`
- Be specific and descriptive
- Focus on behavior, not implementation
- Use sentence case

**Examples**:

```typescript
// ✅ Good
describe('TimesheetGrid', () => {
  describe('Validation', () => {
    it('should validate date format correctly', () => {});
    it('should reject invalid dates', () => {});
  });
});

// ❌ Bad
describe('TimesheetGrid Tests', () => {  // Redundant "Tests"
  describe('test validation', () => {     // Use "test" in name
    it('validates dates', () => {});      // Missing "should"
  });
});
```

## Test Utilities Organization

### Shared Test Utilities

**Location**: `tests/helpers/` or `tests/fixtures/`

**Structure**:

```
tests/
├── helpers/
│   ├── assertion-helpers.ts    # Custom assertions
│   ├── test-builders.ts         # Test data builders
│   └── markdown-reporter.ts     # Custom reporters
├── fixtures/
│   ├── timesheet-data.ts        # Test data
│   ├── mock-database.ts         # Mock implementations
│   └── in-memory-db-mock.ts     # Database mocks
└── test-utils.ts                # General test utilities
```

**Rules**:

- **Helpers**: Reusable test utilities (assertions, builders, utilities)
- **Fixtures**: Test data and mock implementations
- **test-utils.ts**: General utilities used across many tests
- Keep utilities focused and single-purpose
- Document utility functions

### Import Patterns

**Rule**: Use consistent import paths for test utilities

```typescript
// ✅ Good - Relative imports from test utilities
import { createTestDatabase } from '../test-utils';
import { validTimesheetEntries } from '../fixtures/timesheet-data';
import { assertValidTimesheetRow } from '../helpers/assertion-helpers';

// ❌ Bad - Absolute imports from tests (too fragile)
import { createTestDatabase } from '@/tests/test-utils';
```

## Issues and Improvements

### Current Issues

1. **Inconsistent Organization**
   - Some tests at root of `tests/` directory (e.g., `database.spec.ts`, `timesheet_submission_integration.spec.ts`)
   - Should be in appropriate subdirectories (`repositories/`, `integration/`)

2. **Mixed Patterns**
   - Some unit tests in `unit/` subdirectory, others at root
   - Integration tests scattered across multiple locations

3. **Test File Placement**
   - Large integration tests at root level instead of `integration/` directory
   - Should organize by test type, not convenience

4. **Duplicate Concepts**
   - Integration tests exist in both `app/backend/tests/integration/` and `app/tests/integration/`
   - Need clear distinction: backend integration vs. cross-cutting integration

### Recommended Improvements

#### 1. Consolidate Root-Level Test Files

**Action**: Move root-level test files to appropriate subdirectories

**Files to move**:

- `app/backend/tests/database.spec.ts` → `app/backend/tests/repositories/database.spec.ts`
- `app/backend/tests/timesheet_submission_integration.spec.ts` → `app/backend/tests/integration/timesheet-submission.spec.ts`
- `app/backend/tests/submission-database-integration.spec.ts` → `app/backend/tests/integration/submission-database.spec.ts`
- `app/backend/tests/database-persistence-regression.spec.ts` → `app/backend/tests/integration/database-persistence-regression.spec.ts`

#### 2. Standardize Directory Structure

**Action**: Establish consistent subdirectory structure for all test types

**Proposed Structure**:

```
tests/
├── unit/              # All unit tests
├── integration/       # All integration tests
├── ipc/               # IPC-specific tests
├── services/          # Service tests
├── repositories/      # Repository/database tests
├── contracts/         # Contract tests
├── validation/        # Validation tests
├── middleware/        # Middleware tests
├── smoke/             # Smoke tests
├── fixtures/          # Test data
├── helpers/           # Test utilities
└── setup.ts           # Setup file
```

#### 3. Clarify Integration Test Locations

**Action**: Define clear distinction between backend integration and cross-cutting integration

**Guidelines**:

- `app/backend/tests/integration/` → Backend-specific integration tests (database + services)
- `app/tests/integration/` → Cross-cutting integration tests (backend + frontend interactions)

#### 4. Add Test Organization Documentation

**Action**: Create this document and link from main documentation

**Location**: `docs/TEST_ORGANIZATION.md`

#### 5. Standardize Test File Names

**Action**: Ensure all test files follow naming convention

**Check**: All files use kebab-case: `timesheet-submission.spec.ts` not `timesheet_submission_integration.spec.ts`

## Best Practices

### 1. Test Isolation

- Each test should be independent
- No shared state between tests
- Use `beforeEach`/`afterEach` for setup/cleanup
- Use unique test data for each test

### 2. Test Data Management

- Use fixtures for reusable test data
- Use builders for complex test objects
- Keep test data minimal and focused
- Use descriptive names for test data

### 3. Mocking Strategy

- Mock external dependencies (database, network, file system)
- Use real implementations for integration tests
- Keep mocks simple and focused
- Document complex mocks

### 4. Test Coverage

- Aim for high coverage on critical paths
- Don't chase 100% coverage blindly
- Focus on edge cases and error paths
- Test user workflows, not implementation details

### 5. Test Documentation

- Use descriptive test names
- Add comments for complex test logic
- Document test purpose in file header
- Keep test documentation up-to-date

## Maintenance Guidelines

### When Adding New Tests

1. **Identify test type** (unit, integration, e2e, etc.)
2. **Choose appropriate directory** based on test type
3. **Follow naming conventions** (kebab-case, `.spec.ts`)
4. **Mirror source structure** when testing single component
5. **Use existing utilities** from `helpers/` and `fixtures/`
6. **Document complex tests** with comments

### When Refactoring Tests

1. **Maintain test structure** (describe blocks, test names)
2. **Update imports** if moving files
3. **Update test configs** if changing test locations
4. **Update documentation** if changing test organization
5. **Run all tests** after refactoring

## Quality Metrics

### Overview

Test quality is measured using objective metrics to ensure tests are maintainable, reliable, and follow best practices. See [TEST_QUALITY_METRICS.md](./TEST_QUALITY_METRICS.md) for detailed definitions.

### Metrics

1. **Coverage Thresholds**: Ensure adequate test coverage (70% baseline, 80-90% for critical paths)
2. **Test Execution Time**: Identify slow tests (< 5s unit, < 30s integration, < 2min e2e)
3. **Test Organization Compliance**: Validate file locations and naming conventions (100% target)
4. **Test Isolation**: Detect shared state and missing cleanup (zero errors target)
5. **Test Maintainability**: Assess complexity, duplication, and documentation (> 80% docs target)

### Running Quality Checks

**Validate Test Organization**:
```bash
npx tsx scripts/validate-test-organization.ts
```

**Analyze Test Quality**:
```bash
npx tsx scripts/analyze-test-quality.ts
```

### Quality Thresholds and Targets

- **Coverage**: 70% baseline, 80-90% for critical paths
- **Execution Time**: Unit < 5s, Integration < 30s, E2E < 2min
- **Organization Compliance**: 100%
- **Isolation Errors**: 0
- **Documentation Coverage**: > 80%
- **Complexity**: Average < 10
- **Duplication**: < 30%

### Examples

**Compliant Test**:
```typescript
/**
 * @fileoverview Timesheet validation tests
 */
describe('TimesheetValidation', () => {
  beforeEach(() => {
    // Setup isolated test data
  });

  afterEach(() => {
    // Cleanup
  });

  it('should validate date format correctly', () => {
    // Test implementation
  });
});
```

**Non-Compliant Test**:
```typescript
// Missing documentation
describe('test validation', () => {  // Wrong naming
  // Missing cleanup hooks
  const sharedState = {};  // Shared state

  it('validates dates', () => {  // Missing "should"
    // Test implementation
  });
});
```

## Related Documentation

- [Test Quality Metrics](./TEST_QUALITY_METRICS.md) - Quality metrics definitions and guidelines
- [Vitest Setup Guide](./VITEST_SETUP.md) - Test runner configuration
- [Testing Strategy](./DEVELOPER_WIKI.md#testing-strategy) - Overall testing approach
- [File Structure Guidelines](../.cursor/rules/filestructure.mdc) - Project structure

## Summary

Good test organization:

- ✅ Makes tests easy to find
- ✅ Makes tests easy to understand
- ✅ Makes tests easy to maintain
- ✅ Enforces consistency
- ✅ Supports team collaboration

Follow these guidelines to ensure tests remain maintainable as the codebase grows.
