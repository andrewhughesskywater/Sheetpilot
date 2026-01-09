# Quality Gates Documentation

This document describes all automated quality gates enforced in Sheetpilot. These gates constrain both AI coding agents and human developers to maintain high code quality, consistency, and architectural integrity.

**Philosophy:** All gates are objective, measurable, and automatically enforced. CI blocks merges on violation.

---

## Table of Contents

- [A. Formatting (Prettier)](#a-formatting-prettier)
- [B. Linting (ESLint)](#b-linting-eslint)
- [C. Type Safety (TypeScript)](#c-type-safety-typescript)
- [D. Test Coverage (Vitest)](#d-test-coverage-vitest)
- [E. Architecture (dependency-cruiser)](#e-architecture-dependency-cruiser)
- [F. Pre-commit Enforcement](#f-pre-commit-enforcement)
- [G. CI Pipeline](#g-ci-pipeline)
- [How to Fix Failures](#how-to-fix-failures)

---

## A. Formatting (Prettier)

**Purpose:** Single source of truth for code formatting. No debates, just consistency.

### Configuration

- File: `.prettierrc.json`
- Ignores: `.prettierignore`

### Rules

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 120,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Commands

```bash
npm run format        # Auto-fix formatting
npm run format:check  # Check only (CI)
```

### Integration

- ✅ Pre-commit hook (via lint-staged)
- ✅ CI gate (blocks merge)
- ✅ ESLint integration (eslint-config-prettier disables conflicting rules)

### How to Fix

```bash
npm run format
```

---

## B. Linting (ESLint)

**Purpose:** Enforce code quality, complexity limits, import organization, and prevent common bugs.

### Configuration

- File: `eslint.config.js` (flat config)
- Plugins: TypeScript, React, SonarJS, Import, Simple Import Sort, Unused Imports

### Hard Gates

#### Import Management

| Rule | Threshold | Description |
|------|-----------|-------------|
| `simple-import-sort/imports` | error | Enforce consistent import order |
| `simple-import-sort/exports` | error | Enforce consistent export order |
| `unused-imports/no-unused-imports` | error | Remove unused imports |
| `unused-imports/no-unused-vars` | error | Remove unused variables (except `_` prefix) |
| `import/no-duplicates` | error | Prevent duplicate imports |
| `import/no-cycle` | error | Prevent circular imports |
| `import/first` | error | Imports must come first |
| `import/newline-after-import` | error | Blank line after imports |

#### Type Safety

| Rule | Threshold | Description |
|------|-----------|-------------|
| `@typescript-eslint/no-explicit-any` | error | **NEVER** allow `any` type |
| `@typescript-eslint/consistent-type-imports` | error | Use `import type` for types |
| `@typescript-eslint/explicit-function-return-type` | error | Functions must declare return types |
| `@typescript-eslint/explicit-module-boundary-types` | error | Public APIs must have explicit types |
| `@typescript-eslint/await-thenable` | error | Only await promises |
| `@typescript-eslint/no-floating-promises` | error | Promises must be handled |
| `@typescript-eslint/no-misused-promises` | error | Promises used correctly |

#### Complexity Limits (by file type)

| Context | Cyclomatic | Max Function Lines | Max Statements | Cognitive |
|---------|------------|-------------------|----------------|-----------|
| **General** | 12 | 120 | 30 | 20 |
| **Business Logic** (services, repositories, shared) | 10 | 100 | 25 | 15 |
| **IPC Handlers** | 12 | 150 | 30 | 20 |
| **UI Components** | 20 | 250 | 40 | 25 |
| **React Hooks** | 18 | 150 | 35 | 20 |
| **Bootstrap/Config** | 15 | 150 | 35 | 20 |

#### Universal Limits

| Rule | Threshold |
|------|-----------|
| `max-depth` | 4 nested blocks |
| `max-params` | 4 parameters (5 for IPC handlers) |
| `max-nested-callbacks` | 3 levels |
| `max-lines` | 500 lines (400 for business logic) |

#### Code Quality

| Rule | Description |
|------|-------------|
| `no-console` | Error (only `console.warn` and `console.error` allowed) |
| `no-debugger` | Error |
| `no-var` | Error (use `const`/`let`) |
| `prefer-const` | Error |
| `prefer-template` | Error (use template literals) |
| `no-throw-literal` | Error (throw Error objects) |
| `sonarjs/no-identical-functions` | Error (DRY principle) |
| `sonarjs/no-duplicate-string` | Error (5+ occurrences) |

### Commands

```bash
npm run lint         # Auto-fix linting issues
npm run lint:fix     # Same as above
npm run lint:metrics # Check only (CI)
```

### How to Fix

#### Unused imports

```bash
npm run lint  # Auto-removes unused imports
```

#### Complexity violations

**Reduce cyclomatic complexity:**

1. Extract logic into smaller functions
2. Use early returns instead of nested if-else
3. Use lookup tables instead of long switch statements
4. Extract validation logic into separate validators

**Example refactor:**

```typescript
// ❌ Before (complexity: 15)
function processUser(user: User): Result {
  if (user.isActive) {
    if (user.age > 18) {
      if (user.hasPermission) {
        return { status: 'allowed' };
      } else {
        return { status: 'no-permission' };
      }
    } else {
      return { status: 'too-young' };
    }
  } else {
    return { status: 'inactive' };
  }
}

// ✅ After (complexity: 4)
function processUser(user: User): Result {
  if (!user.isActive) return { status: 'inactive' };
  if (user.age <= 18) return { status: 'too-young' };
  if (!user.hasPermission) return { status: 'no-permission' };
  return { status: 'allowed' };
}
```

#### Function too long

1. Extract logical sections into named helper functions
2. Move validation logic to separate validator
3. Extract data transformations into mappers

#### No explicit `any`

Use proper types or generics. If type is truly unknown, use:

```typescript
unknown  // Safer than any - requires type narrowing
Record<string, unknown>  // For objects
```

---

## C. Type Safety (TypeScript)

**Purpose:** Maximum type safety to catch bugs at compile time.

### Configuration

- File: `tsconfig.json`

### Strict Flags (All Enabled)

```jsonc
{
  "strict": true,                           // Enables all strict checks
  "noImplicitAny": true,                    // No implicit any types
  "noImplicitReturns": true,                // All code paths must return
  "noImplicitThis": true,                   // No implicit this
  "noUncheckedIndexedAccess": true,         // Index access returns T | undefined
  "exactOptionalPropertyTypes": true,       // Optional props can't be undefined explicitly
  "noImplicitOverride": true,               // Must use override keyword
  "noFallthroughCasesInSwitch": true,       // All switch cases must break/return
  "forceConsistentCasingInFileNames": true, // Case-sensitive imports
  "noPropertyAccessFromIndexSignature": true, // Use bracket notation for index signatures
  "allowUnusedLabels": false,               // No unused labels
  "allowUnreachableCode": false             // No unreachable code
}
```

### Commands

```bash
npm run typecheck        # Check all projects
npm run type-check       # Alias
npm run type-check:root  # Root only
```

### How to Fix

#### Index access types

```typescript
// ❌ Before
const value = obj[key];  // Type: string
value.toUpperCase();     // Runtime error if undefined

// ✅ After
const value = obj[key];  // Type: string | undefined
if (value !== undefined) {
  value.toUpperCase();
}
```

#### Switch fallthrough

```typescript
// ❌ Before
switch (status) {
  case 'active':
    doSomething();
  case 'pending':  // Error: fallthrough
    doOther();
}

// ✅ After
switch (status) {
  case 'active':
    doSomething();
    break;
  case 'pending':
    doOther();
    break;
}
```

---

## D. Test Coverage (Vitest)

**Purpose:** Ensure adequate test coverage with hard minimum thresholds.

### Thresholds by Test Suite

| Suite | Statements | Branches | Functions | Lines |
|-------|-----------|----------|-----------|-------|
| **Unit Tests** (backend) | 100% | 100% | 100% | 100% |
| **Integration Tests** | 60% | 60% | 60% | 60% |
| **E2E Tests** | 50% | 50% | 50% | 50% |
| **Frontend Tests** | 70% | 70% | 70% | 70% |

### Configuration Files

- `app/backend/tests/vitest.config.ts` (unit)
- `app/backend/tests/vitest.config.integration.ts`
- `app/backend/tests/vitest.config.e2e.ts`
- `app/frontend/tests/vitest.config.ts`

### Commands

```bash
# Run with coverage
npm run test:unit -- --coverage
npm run test:integration -- --coverage
npm run test:e2e -- --coverage
npm run test:renderer -- --coverage

# All tests
npm test
```

### Coverage Reports

- **Text:** Console output
- **HTML:** `coverage/index.html`
- **JSON:** `coverage/coverage-final.json`

### How to Fix

#### Increase coverage

1. Identify uncovered lines in HTML report
2. Add tests for missing branches
3. Test error paths and edge cases
4. Mock external dependencies

#### Exclude files from coverage

Edit vitest config `exclude` array:

```typescript
exclude: [
  'app/backend/src/**/*.spec.ts',
  'app/backend/src/main.ts',  // Entry points
  'app/backend/src/**/*.d.ts'  // Type definitions
]
```

---

## E. Architecture (dependency-cruiser)

**Purpose:** Enforce architectural boundaries and prevent coupling violations.

### Configuration

- File: `.dependency-cruiser.js`

### Hard Rules

#### 1. No Circular Dependencies

**Rule:** `no-circular`  
**Severity:** Error  
**Description:** Circular dependencies create tight coupling and maintenance nightmares.

```
❌ Bad: A → B → C → A
✅ Good: A → B → C
```

#### 2. Frontend/Backend Isolation

**Rules:** `no-frontend-to-backend`, `no-backend-to-frontend`  
**Severity:** Error  
**Description:** Frontend and backend communicate ONLY via IPC and shared contracts.

```
❌ Bad: frontend/Component.tsx imports backend/services/UserService.ts
✅ Good: frontend/Component.tsx uses window.user.getUser() IPC bridge
```

#### 3. No Deep Imports

**Rule:** `no-deep-imports-to-backend-modules`  
**Severity:** Error  
**Description:** Import from module barrels, not internal file paths.

```typescript
// ❌ Bad: Deep import
import { UserRepository } from '@/repositories/user/UserRepository';

// ✅ Good: Barrel import
import { UserRepository } from '@/repositories';
```

#### 4. Internal Folder Privacy

**Rule:** `no-external-to-internal`  
**Severity:** Error  
**Description:** Files in `internal/` folders are private to their owning module.

```
❌ Bad: app/backend/src/services/auth.ts imports app/backend/src/repositories/internal/helper.ts
✅ Good: Only files inside app/backend/src/repositories/ can import internal/
```

#### 5. Shared Layer Independence

**Rule:** `shared-no-app-imports`  
**Severity:** Error  
**Description:** Shared layer must not depend on backend or frontend.

```
❌ Bad: app/shared/utils.ts imports app/backend/services/logger.ts
✅ Good: app/shared/logger.ts is self-contained
```

#### 6. Dev Dependencies Isolation

**Rule:** `no-dev-deps-in-runtime`  
**Severity:** Error  
**Description:** Runtime code must not import devDependencies.

```typescript
// ❌ Bad (in production code)
import { describe } from 'vitest';

// ✅ Good (vitest only in test files)
```

#### 7. Bot Service Isolation

**Rule:** `no-backend-to-bot`  
**Severity:** Error  
**Description:** Bot service is a separate build; backend cannot import from it.

### Commands

```bash
npm run depcruise:check   # Validate rules (CI)
npm run depcruise:report  # Generate HTML visualization
```

### How to Fix

#### Circular dependencies

1. Identify cycle in error message
2. Move shared logic to a third module
3. Use dependency injection
4. Consider interface segregation

#### Deep imports

Update import to use barrel (`index.ts`):

```typescript
// 1. Ensure module has barrel export
// app/backend/src/repositories/index.ts
export { UserRepository } from './user/UserRepository';
export { TimesheetRepository } from './timesheet/TimesheetRepository';

// 2. Import from barrel
import { UserRepository } from '@/repositories';
```

#### Cross-layer violations

Refactor to use proper layer:

```typescript
// ❌ Frontend importing backend
import { submitTimesheet } from '../../backend/src/services/timesheet';

// ✅ Frontend using IPC bridge
const result = await window.timesheet.submit(data);
```

---

## F. Pre-commit Enforcement

**Purpose:** Catch issues before commit, not in CI.

### Configuration

- **Husky:** `.husky/pre-commit`
- **Lint-staged:** `package.json` → `lint-staged` section

### What Runs on Commit

```json
{
  "*.{ts,tsx}": [
    "eslint --fix --max-warnings 0",
    "prettier --write"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

**After lint-staged:**

- Full typecheck (`npm run typecheck`)

### Bypass (Not Recommended)

```bash
git commit --no-verify
```

---

## G. CI Pipeline

**Purpose:** Automated enforcement on every PR and push.

### Configuration

- File: `.github/workflows/quality.yml`

### Pipeline Steps (All Must Pass)

1. **Install dependencies** → `npm ci`
2. **Rebuild native modules** → `npm run rebuild`
3. **Format check** → `npm run format:check` ✅ **NEW**
4. **Type check** → `npm run type-check`
5. **Lint** → `npm run lint:metrics`
6. **Dependency graph** → `npm run depcruise:check`
7. **Unit tests + coverage** → `npm run test:unit -- --coverage` ✅ **NEW**
8. **Integration tests + coverage** → `npm run test:integration -- --coverage` ✅ **NEW**
9. **Frontend tests + coverage** → `npm run test:renderer -- --coverage` ✅ **NEW**

### Artifacts

- ESLint JSON report
- Dependency-cruiser HTML report
- Coverage reports

### Matrix

- Node.js 18, 20

**Result:** Merge blocked if any step fails.

---

## How to Fix Failures

### Quick Fixes

```bash
# Fix formatting
npm run format

# Fix auto-fixable linting
npm run lint

# View type errors
npm run typecheck

# Check coverage
npm run test:unit -- --coverage

# Check architecture
npm run depcruise:check
```

### Local Validation (Full CI Simulation)

```bash
# Run all gates locally
npm run format:check && \
npm run typecheck && \
npm run lint:metrics && \
npm run depcruise:check && \
npm run test:unit -- --coverage && \
npm run test:integration -- --coverage && \
npm run test:renderer -- --coverage
```

### When Adding New Files

1. **Ensure proper naming:**
   - kebab-case for utilities: `user-validator.ts`
   - PascalCase for components: `UserProfile.tsx`

2. **Add barrel exports:**

   ```typescript
   // app/backend/src/services/index.ts
   export { NewService } from './new/NewService';
   ```

3. **Add tests:**
   - Unit tests for logic
   - Coverage must meet thresholds

4. **Check imports:**

   ```bash
   npm run depcruise:check
   ```

### When Adding New Modules

1. Update dependency-cruiser if new boundaries needed
2. Add barrel `index.ts`
3. Update TSConfig paths if needed
4. Document in architecture docs

---

## Known Limitations

1. **Explicit return types:** May be verbose for simple functions; intentional trade-off for clarity.
2. **100% unit coverage:** Strict threshold; excludes entry points and preload scripts.
3. **Filename case enforcement:** Existing files grandfathered; new files must comply.
4. **Deep import detection:** Pattern-based; may not catch all edge cases.

---

## Threshold Rationale

| Gate | Threshold | Justification |
|------|-----------|---------------|
| Cyclomatic complexity | 10-12 (business), 20 (UI) | Industry standard; readable in single screen |
| Function length | 100-120 (business), 250 (UI) | Single responsibility; testable units |
| Max params | 4-5 | Prevents parameter object antipattern |
| Unit coverage | 100% | Critical business logic must be fully tested |
| Integration coverage | 60% | Integration points are key; lower threshold for setup code |
| Frontend coverage | 70% | UI logic coverage; excludes visual rendering |

---

## Questions?

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow.  
Report issues or suggest threshold changes via GitHub Issues.
