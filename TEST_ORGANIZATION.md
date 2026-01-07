# Test Organization

This document describes the organization and classification of tests in the Sheetpilot project.

## Test Categories

### Unit Tests (`app/backend/tests/unit/`)

Tests individual functions, modules, or classes in isolation with mocked dependencies.

**Characteristics:**

- Fast execution (< 5 seconds total)
- No external dependencies
- High test coverage focus
- Fully parallelized

**Structure:**

```
app/backend/tests/unit/
├── bootstrap/          # Bootstrap and initialization logic
├── ipc/                # IPC handler tests
├── logic/              # Business logic tests
├── middleware/         # Middleware tests
├── repositories/       # Database repository tests
├── services/           # Service layer tests
├── validation/         # Validation logic tests
├── auto-updater.spec.ts
├── database.spec.ts
├── deprecated-constants.spec.ts
├── import-policy.spec.ts
├── main-application-logic.spec.ts
├── preload.spec.ts
└── quarter-config.spec.ts
```

**Run:** `npm run test:unit`

### Integration Tests (`app/backend/tests/integration/`)

Tests multiple components working together, with real or partially mocked dependencies.

**Characteristics:**

- Medium execution time (< 2 minutes total)
- Tests component interactions
- Database integration
- Workflow validation

**Structure:**

```
app/backend/tests/integration/
├── database-migration-rollback.spec.ts
├── database-persistence-regression.spec.ts
├── full-workflow.spec.ts
├── ipc-handlers-comprehensive.spec.ts
├── ipc-main.spec.ts
├── ipc-workflow-integration.spec.ts
├── quarter-routing-integration.spec.ts
├── submission-database-integration.spec.ts
└── timesheet_submission_integration.spec.ts
```

**Run:** `npm run test:integration`

### System Tests (`app/tests/system/`)

Tests the entire system with real dependencies, focusing on critical paths and system-level concerns.

**Characteristics:**

- Longer execution time (< 30 seconds)
- Tests entire system
- Real dependencies where possible
- Critical path validation

**Structure:**

```
app/tests/system/
├── smoke/              # Critical path smoke tests
│   └── critical-paths.spec.ts
├── security/           # Security validation tests
│   ├── authentication.spec.ts
│   ├── data-protection.spec.ts
│   └── input-validation.spec.ts
├── performance/        # Performance tests
└── accessibility/      # Accessibility tests
```

**Run:**

- All: `npm run test:system`
- Smoke only: `npm run test:smoke`

### E2E Tests (`app/tests/e2e/`)

Tests complete user workflows from start to finish, simulating real user interactions.

**Characteristics:**

- Longest execution time (< 5 minutes)
- Full user workflows
- Browser automation
- Real-world scenarios

**Structure:**

```
app/tests/e2e/
├── error-recovery.spec.ts
└── user-journey-new-user.spec.ts
```

**Run:** `npm run test:e2e`

## Test Execution Order

When running the full test suite (`npm test`), tests execute in this order:

1. **Unit Tests** - Fast validation of individual components
2. **Integration Tests** - Component interaction validation
3. **System Tests** - System-level validation and critical paths
4. **E2E Tests** - Complete user workflow validation
5. **Renderer Tests** - Frontend component tests
6. **Blank Screen Prevention** - UI safety tests

## Quick Reference

| Command | Description | Timeout | Parallel |
|---------|-------------|---------|----------|
| `npm test` | Run all tests | varies | varies |
| `npm run test:unit` | Unit tests only | 5s | Yes (4 threads) |
| `npm run test:watch` | Unit tests in watch mode | 5s | Yes (4 threads) |
| `npm run test:integration` | Integration tests | 2m | Yes (4 threads) |
| `npm run test:system` | System tests | 30s | No (sequential) |
| `npm run test:smoke` | Smoke tests only | 10s | No (sequential) |
| `npm run test:e2e` | E2E tests | 5m | No (sequential) |
| `npm run test:renderer` | Frontend tests | varies | Yes |

## Configuration Files

- `vitest.config.ts` - Unit test configuration
- `vitest.config.integration.ts` - Integration test configuration
- `vitest.config.system.ts` - System test configuration
- `vitest.config.smoke.ts` - Smoke test configuration (subset of system)
- `vitest.config.e2e.ts` - E2E test configuration

## Best Practices

### Writing Unit Tests

- Mock all external dependencies
- Test one thing at a time
- Keep tests fast (< 100ms each)
- Aim for high coverage (100% target)

### Writing Integration Tests

- Test component boundaries
- Use real database with test isolation
- Validate data flows between layers
- Test error handling across components

### Writing System Tests

- Focus on critical user paths
- Test security boundaries
- Validate system-level constraints
- Keep under 30 seconds total

### Writing E2E Tests

- Test complete user workflows
- Use realistic data
- Test happy paths and error scenarios
- Keep test count minimal but comprehensive

## Migration Notes

Tests were reorganized from a flat structure to a hierarchical one:

- Old smoke tests → `app/tests/system/smoke/`
- Old security tests → `app/tests/system/security/`
- Old performance tests → `app/tests/system/performance/`
- Old accessibility tests → `app/tests/system/accessibility/`
- Backend unit tests consolidated → `app/backend/tests/unit/`
- Integration tests consolidated → `app/backend/tests/integration/`
- E2E tests remain in → `app/tests/e2e/`
