# Technical Debt: Bot Service Naming Convention Migration

## Overview

The bot service (located in `app/backend/src/services/bot/`) uses legacy `snake_case` naming conventions for functions and variables, which violates the project's [Function Naming Conventions](.cursor/rules/Function_Naming_Conventions.md). This is inherited code that predates the current naming standards and requires refactoring to align with project conventions.

## Scope

This technical debt applies specifically to bot service modules and is documented for tracking and future prioritization. **This debt is deferred to the next major version refactoring** to avoid disrupting current submission workflow functionality.

## Files Affected

### Primary Bot Service Modules
- `app/backend/src/services/bot/src/config/automation_config.ts` — **10+ snake_case functions**
  - `dynamic_wait()`
  - `dynamic_wait_for_element()`
  - `dynamic_wait_for_page_load()`
  - `dynamic_wait_for_network_idle()`
  - `wait_for_dom_stability()`
  - `wait_for_dropdown_options()`
  - `wait_for_validation_stability()`
  - `wait_for_submission_network_idle()`
  - `smart_wait_or_proceed()`

- `app/backend/src/services/bot/src/utils/authentication_flow.ts` — Local variable in function scope
  - `current_url` (local variable, lower priority)

- `app/backend/src/services/bot/src/core/bot_orchestation.ts` — Local variables in function scopes
  - `total_rows`, `status_col`, `complete_val`, `success_count`, `failure_count` (local variables, lower priority)

### Constants (Correct Convention)
All constants in bot service already follow `UPPER_SNAKE_CASE` correctly:
- `QUARTER_DEFINITIONS`, `BASE_URL`, `BROWSER_HEADLESS`, `ELEMENT_WAIT_TIMEOUT`, etc.
- ✅ **No action needed** for constants

## Naming Convention Violations

| Pattern | Example | Should Be | Priority |
|---------|---------|-----------|----------|
| snake_case function | `dynamic_wait()` | `dynamicWait()` | High |
| snake_case function | `wait_for_dom_stability()` | `waitForDomStability()` | High |
| snake_case function | `smart_wait_or_proceed()` | `smartWaitOrProceed()` | High |
| snake_case variable | `current_url` | `currentUrl` | Low (local scope) |
| snake_case variable | `total_rows` | `totalRows` | Low (local scope) |

## Migration Plan

### Phase 1: Preparation (Before Next Major Version)
1. ✅ Document all affected identifiers (completed in this file)
2. Document usage patterns of bot service exports in submission workflow
3. Create migration checklist for engineering team

### Phase 2: Refactoring (Next Major Version Sprint)
1. Rename exported functions in `automation_config.ts`:
   - `dynamic_wait()` → `dynamicWait()`
   - `dynamic_wait_for_element()` → `dynamicWaitForElement()`
   - `dynamic_wait_for_page_load()` → `dynamicWaitForPageLoad()`
   - `dynamic_wait_for_network_idle()` → `dynamicWaitForNetworkIdle()`
   - `wait_for_dom_stability()` → `waitForDomStability()`
   - `wait_for_dropdown_options()` → `waitForDropdownOptions()`
   - `wait_for_validation_stability()` → `waitForValidationStability()`
   - `wait_for_submission_network_idle()` → `waitForSubmissionNetworkIdle()`
   - `smart_wait_or_proceed()` → `smartWaitOrProceed()`

2. Update all call sites in:
   - `app/backend/src/services/bot/src/core/bot_orchestation.ts`
   - `app/backend/src/services/bot/src/browser/`
   - `app/backend/src/services/bot/src/utils/`

3. Rename local variables (lower priority, can be deferred):
   - `current_url` → `currentUrl`
   - `total_rows` → `totalRows`
   - `status_col` → `statusCol`
   - `complete_val` → `completeVal`
   - `success_count` → `successCount`
   - `failure_count` → `failureCount`

### Phase 3: Validation
1. Run full test suite (`npm test`)
2. Run smoke tests in actual browser environment
3. Verify submission workflow functionality unchanged

## Risk Assessment

**Risk Level:** 🟡 **Medium**
- High number of functions affected (~10+ exported functions)
- Wide usage across bot service modules
- Potential for import/call-site misses during refactoring
- **Mitigation:** Use TypeScript's strict type checking and rename refactoring tools

**Testing Impact:** ✅ **Low**
- Bot service has existing integration and e2e test coverage
- Tests validate submission workflow end-to-end
- Automated testing reduces regression risk

## Rationale for Deferral

1. **Stability Priority** — Submission workflow is critical path; deferring preserves stability
2. **Scope Isolation** — Debt is contained to bot service; doesn't affect other modules
3. **No Functional Impact** — Renaming is purely stylistic; no behavioral changes
4. **Future Roadmap** — Bot service refactoring already planned for next major version

## Related Documentation

- [Function Naming Conventions](.cursor/rules/Function_Naming_Conventions.md) — Project naming standards
- [Contributing Guide](docs/CONTRIBUTING.md) — Code review standards
- [App Architecture](docs/app-architecture-hierarchical.xml) — Bot service module structure

## Tracking

- **Issue:** (Link to GitHub issue if created)
- **Milestone:** Next Major Version (v2.0+)
- **Estimated Effort:** 2-3 engineer-hours
- **Created:** January 9, 2026
