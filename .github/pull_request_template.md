## Description
<!-- Clear description of changes. Link the issue if applicable. -->

## Type
- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Documentation
- [ ] Performance improvement
- [ ] Test coverage

## Architecture & Boundaries
**Before merging, ensure:**
- ✅ Frontend code (`app/frontend/src/**`) does **not** import from backend (`app/backend/src/**`)
- ✅ Backend code does **not** import from frontend
- ✅ Both may import from shared (`app/shared/**`) for types & contracts only
- ✅ See [Architecture Hierarchy](../docs/app-architecture-hierarchical.xml) & [Data Flow](../docs/app-architecture-dataflow.xml)

## Code Quality Gates
**ESLint + SonarJS checks** (automated on CI):
- Cyclomatic complexity: ≤ 12 per function
- Cognitive complexity: ≤ 20 per function  
- Max nesting depth: ≤ 4
- Max params: ≤ 4
- Max lines per function: ≤ 120 (excl. comments/blanks)
- No duplicate code blocks (SonarJS)
- No nested switch statements

**Dependency Graph** (automated on CI):
- No circular dependencies
- No devDependencies in runtime code
- Frontend ↔ Backend isolation enforced

If a check fails, refactor to break complexity or dependencies **before** merging.

## Logging & Observability
- ✅ Use active voice: "Could not load X" not "X loading failed"
- ✅ Include context object: `logger.error('Message', { field: value })`
- ✅ **Never log** passwords, tokens, or PII (auto-redacted)
- ✅ Appropriate level: `error` (failures), `warn` (fallbacks), `info` (state), `verbose` (detail)
- See [Logging Rules](../.cursor/rules/logging.mdc)

## Checklist
- [ ] Tests added/updated
- [ ] Type safety verified (`npm run type-check`)
- [ ] Lint passes locally (`npm run lint`)
- [ ] Complexity & boundaries verified (`npm run validate:quality`)
- [ ] No console warnings or errors

## Copilot Review
This PR is reviewed by **GitHub Copilot** for:
- Alignment with [architecture boundaries](../docs/app-architecture-dataflow.xml)
- Complexity hotspots & refactoring suggestions
- Logging convention violations
- Test coverage gaps

Review comments appear below. Address them as you would human review feedback.
