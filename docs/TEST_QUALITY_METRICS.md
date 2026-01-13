# Test Quality Metrics

## Overview

This document defines the quality metrics used to assess test quality across the SheetPilot codebase. These metrics help ensure tests are maintainable, reliable, and follow best practices.

## Metrics

### 1. Coverage Thresholds

**Purpose**: Ensure adequate test coverage of source code.

**Current Thresholds**:

- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

**Location**: Defined in all `vitest.config.*.ts` files

**Targets**:

- Critical paths: 90%+
- Business logic: 80%+
- Utilities: 70%+
- UI components: 60%+ (interaction tests prioritized over line coverage)

### 2. Test Execution Time

**Purpose**: Identify slow tests that impact developer productivity.

**Standards**:

- **Unit tests**: < 5 seconds per test
- **Integration tests**: < 30 seconds per test
- **E2E tests**: < 2 minutes per test
- **Smoke tests**: < 10 seconds total

**Tracking**:

- Per-test timeout configured in vitest configs
- Slow test detection via `test-performance.ts` utility
- CI/CD reports execution time trends

**Action Items**:

- Tests exceeding thresholds should be optimized or split
- Slow suites should be reviewed for unnecessary setup/teardown

### 3. Test Organization Compliance

**Purpose**: Ensure tests follow organizational guidelines for discoverability and maintainability.

**Checks**:

- All test files in correct directories
- Naming conventions (kebab-case, `.spec.ts`)
- No root-level test files (except in `app/tests/`)
- Proper directory structure matches guidelines

**Validation**: Run `scripts/validate-test-organization.ts`

**Compliance Score**: Percentage of files that pass all checks

**Target**: 100% compliance

### 4. Test Isolation

**Purpose**: Ensure tests are independent and don't affect each other.

**Checks**:

- Shared state detection between tests
- Cleanup verification (afterEach hooks)
- Database/file system isolation
- Mock state isolation

**Validation**: `app/backend/tests/helpers/test-isolation-checker.ts`

**Violation Types**:

- **Error**: Database/file system isolation issues
- **Warning**: Missing cleanup hooks, shared state patterns

**Target**: Zero errors, minimal warnings

### 5. Test Maintainability

**Purpose**: Assess how easy tests are to understand and modify.

**Metrics**:

- **Complexity**: Cyclomatic complexity of test code
- **Duplication**: Percentage of duplicate code
- **Documentation**: Presence of file/function documentation
- **Test-to-source ratio**: Number of tests per source file

**Analysis**: Run `scripts/analyze-test-quality.ts`

**Targets**:

- Average complexity: < 10
- Duplication score: < 30%
- Documentation coverage: > 80%
- Test-to-source ratio: > 1:1 for critical paths

## Quality Dashboard

The quality dashboard aggregates all metrics into a single report.

**Location**: `docs/TEST_QUALITY_REPORT.md` (generated)

**Sections**:

1. Coverage by category (unit, integration, e2e)
2. Execution time trends
3. Organization compliance score
4. Isolation violations
5. Maintainability scores

## Running Quality Checks

### Validate Test Organization

```bash
npx tsx scripts/validate-test-organization.ts
```

### Analyze Test Quality

```bash
npx tsx scripts/analyze-test-quality.ts
```

### Generate Full Quality Report

```bash
# Run all quality checks and generate report
npm run test:quality
```

## Interpreting Scores

### Coverage Scores

- **90%+**: Excellent - Critical paths well covered
- **70-89%**: Good - Adequate coverage
- **50-69%**: Fair - Some gaps in coverage
- **<50%**: Poor - Significant coverage gaps

### Execution Time

- **Fast (< 1s)**: Excellent - No impact on productivity
- **Moderate (1-5s)**: Good - Acceptable for unit tests
- **Slow (5-30s)**: Fair - Acceptable for integration tests
- **Very Slow (> 30s)**: Poor - Should be optimized

### Complexity

- **< 5**: Excellent - Easy to understand
- **5-10**: Good - Manageable complexity
- **10-15**: Fair - Consider refactoring
- **> 15**: Poor - High complexity, should be simplified

### Duplication

- **< 10%**: Excellent - Minimal duplication
- **10-30%**: Good - Acceptable level
- **30-50%**: Fair - Consider extracting common code
- **> 50%**: Poor - Significant duplication

## Improvement Guidelines

### When Coverage is Low

1. Identify uncovered code paths
2. Add tests for edge cases
3. Focus on critical business logic first
4. Use coverage reports to guide testing

### When Tests are Slow

1. Review test setup/teardown
2. Check for unnecessary database operations
3. Consider mocking external dependencies
4. Split large test suites
5. Use parallel execution where possible

### When Organization is Non-Compliant

1. Move files to correct directories
2. Fix naming conventions
3. Update import paths
4. Run validation script to verify

### When Isolation Issues are Found

1. Add proper cleanup hooks
2. Use isolated test data
3. Reset mocks between tests
4. Use unique identifiers for test resources

### When Maintainability is Low

1. Reduce complexity by splitting tests
2. Extract common test utilities
3. Add documentation to complex tests
4. Refactor duplicated test code

## CI/CD Integration

Quality checks are integrated into CI/CD pipeline:

1. **Organization Validation**: Runs on every commit
2. **Quality Analysis**: Runs on pull requests
3. **Full Report**: Generated on main branch

**Failure Conditions**:

- Organization compliance < 100%
- Isolation errors detected
- Coverage below thresholds

**Warnings**:

- Slow tests detected
- High complexity files
- Missing documentation

## Related Documentation

- [Test Organization Guidelines](./TEST_ORGANIZATION.md)
- [Vitest Setup Guide](./VITEST_SETUP.md)
- [Test Quality Report](./TEST_QUALITY_REPORT.md) (generated)
