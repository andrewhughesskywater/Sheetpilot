# Script Consolidation & Plugin Alternatives

## Summary

Consolidated scripts from **51** to **45** by:

- Removed duplicate `lint:fix` (identical to `lint`)
- Removed redundant `electron:compiled` (use `electron:dev` with rebuild if needed)
- Removed `dev:smoke` (just prints instructions, not useful as script)
- Consolidated validation scripts into `validate` and `validate:full`
- Consolidated test quality scripts into single `test:quality`
- Added convenience aliases `quality` and `deps` for common operations

## Alternative Plugins That Could Replace Scripts

### Task Orchestration & Parallel Execution

**Current:** Using `concurrently` for parallel script execution

**Alternatives:**

- **`npm-run-all`** (or `run-p`/`run-s`) - Simpler parallel/sequential execution
  - Replace: `concurrently` in `dev` and `dev:watch` scripts
  - Benefits: Lighter weight, better error handling, simpler syntax
  - Example: `run-p "vite" "build:main:dev"` instead of `concurrently`

- **`turbo`** - Monorepo build system with caching
  - Replace: Multiple build scripts, type-check scripts
  - Benefits: Intelligent caching, parallel execution, dependency graph
  - Example: `turbo run build type-check lint` runs all with caching

- **`nx`** - Enterprise monorepo tool
  - Replace: All build/type-check/lint orchestration
  - Benefits: Advanced caching, dependency graph, task scheduling
  - Overkill for current project size

### Type Checking

**Current:** Multiple `type-check:*` scripts chained with `&&`

**Alternatives:**

- **`turbo`** - Can run type-check across all workspaces in parallel
- **`tsc-files`** - Type-check specific files instead of projects
- **`tsc-multi`** - Run multiple TypeScript compilations in parallel
- **Keep current approach** - Simple and works well

### Linting

**Current:** Direct `eslint` call

**Alternatives:**

- **`lint-staged`** - Run linters on git staged files
  - Use with: `husky` for pre-commit hooks
  - Benefits: Faster feedback, only lint changed files

- **`eslint-config-prettier`** + **`prettier`** - Separate formatting from linting
  - Benefits: Better formatting control, faster formatting

### File Cleanup

**Current:** `rimraf` for cross-platform `rm -rf`

**Alternatives:**

- **`del-cli`** - Simpler cross-platform delete
- **Native Node.js `fs.rmSync`** (Node 14.14+) - No dependency needed
- **Keep `rimraf`** - Most reliable, widely used

### Environment Variables

**Current:** `cross-env` for cross-platform env vars

**Alternatives:**

- **`env-cmd`** - Load from `.env` files
  - Benefits: Centralized env config, supports multiple env files
- **`dotenv-cli`** - Simple `.env` file loader
- **Keep `cross-env`** - Simple and works for current use case

### Version Management

**Current:** Custom `sync-version.js` script

**Alternatives:**

- **`standard-version`** - Automated versioning and CHANGELOG
  - Benefits: Semantic versioning, auto CHANGELOG generation
- **`semantic-release`** - Fully automated version management
  - Benefits: CI/CD integration, automatic releases
- **`bump`** - Simple version bumping
- **Keep current** - Custom logic may be needed

### Build Tools

**Current:** Custom build scripts (`build-backend-bundle.js`, `build-dev.js`)

**Alternatives:**

- **`tsup`** - TypeScript bundler (faster than esbuild for TS)
  - Replace: Custom esbuild scripts
  - Benefits: Zero-config TypeScript, faster builds
- **`unbuild`** - Universal build tool
  - Replace: Custom build scripts
  - Benefits: Works with multiple bundlers, better DX
- **`vite`** (already using for frontend) - Could extend to backend
  - Benefits: Unified build system, faster HMR
- **Keep current** - Custom scripts provide needed control

### Dependency Management

**Current:** Custom `dependency-reporter.js` with multiple flags

**Alternatives:**

- **`npm-check-updates`** (already in deps) - Update package.json
- **`depcheck`** (already in deps) - Find unused dependencies
- **`npm-audit-resolver`** (already in deps) - Resolve audit issues
- **`license-checker`** (already in deps) - Check licenses
- **`snyk`** - Security scanning
- **`dependabot`** / **`renovate`** - Automated dependency updates
- **Keep current** - Custom reporter provides unified interface

### Code Quality Metrics

**Current:** Custom quality metric scripts

**Alternatives:**

- **`sonarjs`** - SonarQube rules for ESLint
- **`eslint-plugin-sonarjs`** - SonarJS rules
- **`codeclimate`** - Automated code review
- **`codacy`** - Code quality analysis
- **Keep current** - Custom metrics may be project-specific

### Testing

**Current:** Using `vitest` (already good choice)

**Alternatives:**

- **`jest`** - More mature, larger ecosystem
- **`mocha`** + **`chai`** - Flexible, modular
- **Keep `vitest`** - Fast, Vite-native, good TypeScript support

### Git Hooks

**Current:** No git hooks configured

**Recommended Addition:**

- **`husky`** - Git hooks made easy
  - Use with: `lint-staged` for pre-commit linting
  - Benefits: Enforce code quality before commits
  - Example: Pre-commit hook runs `lint` and `type-check`

### Watch Mode

**Current:** `nodemon` for backend, Vite for frontend

**Alternatives:**

- **`nodemon`** (current) - Good for Node.js
- **`chokidar-cli`** - More flexible file watching
- **`watchman`** - Facebook's file watching service
- **Keep current** - Works well for current setup

### Wait/Health Checks

**Current:** `wait-on` for waiting on ports/files

**Alternatives:**

- **`start-server-and-test`** - Start server, wait, run tests
  - Benefits: Combines wait + test execution
- **`http-server`** + custom script
- **Keep `wait-on`** - Simple and reliable

## Recommended Immediate Changes

### High Priority

1. **Add `husky` + `lint-staged`** for pre-commit hooks

   ```bash
   npm install --save-dev husky lint-staged
   ```

   - Automatically lint/type-check before commits
   - Prevents bad code from entering repo

2. **Consider `npm-run-all`** instead of `concurrently`

   ```bash
   npm install --save-dev npm-run-all
   ```

   - Simpler syntax: `run-p "vite" "build:main:dev"`
   - Better error messages

### Medium Priority

3. **Consider `tsup`** for backend builds
   - Faster TypeScript builds
   - Less custom build script maintenance

2. **Add `standard-version`** for version management
   - Automated CHANGELOG generation
   - Semantic versioning support

### Low Priority

5. **Consider `turbo`** if monorepo grows
   - Only if project scales significantly
   - Adds complexity but provides caching benefits

## Scripts That Should Stay Custom

- **`sync-version.js`** - May have project-specific logic
- **`generate-icon.js`** - Likely project-specific
- **`reset-dev-database.js`** - Project-specific database logic
- **Quality metric scripts** - Custom metrics for project needs
- **Validation scripts** - Project-specific validation logic

## Summary of Consolidations Made

| Before | After | Reason |
|--------|-------|--------|
| `lint` + `lint:fix` | `lint` | Identical commands |
| `electron:compiled` | Removed | Redundant with `electron:dev` |
| `dev:smoke` | Removed | Just prints instructions |
| `validate:compile` + `validate:bundle` + `validate:deps` + `validate:packaged-deps` | `validate` + `validate:full` | Consolidated into two clear commands |
| `test:quality:organization` + `test:quality:analyze` | `test:quality` | Combined into single command |
| N/A | `quality` + `deps` | Added convenience aliases |

**Result:** 51 scripts → 45 scripts (12% reduction)
