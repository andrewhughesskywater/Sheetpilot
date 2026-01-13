# Release Guide - Using standard-version

## Quick Start

### Making a Release

1. **Ensure all changes are committed:**
   ```bash
   git status
   ```

2. **Run the release command:**
   ```bash
   npm run release
   ```

3. **Review the changes:**
   - Check `CHANGELOG.md` for generated release notes
   - Verify version numbers in all `package.json` files
   - Verify `APP_VERSION` in `app/shared/constants.ts`

4. **Push the release:**
   ```bash
   git push --follow-tags
   ```

## Release Commands

| Command | Description | Example |
|---------|-------------|---------|
| `npm run release` | Automatic version bump based on commits | `1.5.8` → `1.5.9` (patch) or `1.6.0` (minor) |
| `npm run release:minor` | Force minor version bump | `1.5.8` → `1.6.0` |
| `npm run release:major` | Force major version bump | `1.5.8` → `2.0.0` |
| `npm run release:alpha` | Create alpha prerelease | `1.5.8` → `1.5.9-alpha.0` |
| `npm run release:beta` | Create beta prerelease | `1.5.8` → `1.5.9-beta.0` |

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Version Bump | Description |
|------|--------------|-------------|
| `feat:` | **Minor** (1.5.8 → 1.6.0) | New feature |
| `fix:` | **Patch** (1.5.8 → 1.5.9) | Bug fix |
| `perf:` | **Patch** | Performance improvement |
| `refactor:` | None | Code refactoring (no version bump) |
| `docs:` | None | Documentation changes |
| `chore:` | None | Maintenance tasks |
| `test:` | None | Test changes |
| `build:` | None | Build system changes |
| `ci:` | None | CI configuration changes |
| `BREAKING CHANGE:` | **Major** (1.5.8 → 2.0.0) | Breaking change (in footer) |

### Examples

```bash
# Patch release (1.5.8 → 1.5.9)
git commit -m "fix: resolve memory leak in timesheet processing"

# Minor release (1.5.8 → 1.6.0)
git commit -m "feat: add dark mode support"

# Major release (1.5.8 → 2.0.0)
git commit -m "feat: redesign API

BREAKING CHANGE: API endpoints have changed from /v1 to /v2"

# No version bump
git commit -m "docs: update README with setup instructions"
git commit -m "chore: update dependencies"
```

## What Happens During Release

When you run `npm run release`, `standard-version` automatically:

1. ✅ Analyzes all commits since last release
2. ✅ Determines version bump (patch/minor/major)
3. ✅ Updates version in:
   - `package.json` (root)
   - `app/backend/package.json`
   - `app/frontend/package.json`
   - `app/shared/package.json`
4. ✅ Generates/updates `CHANGELOG.md`
5. ✅ Creates git tag (e.g., `v1.5.9`)
6. ✅ Runs `sync-version.js` to ensure consistency
7. ✅ Updates `APP_VERSION` in `app/shared/constants.ts`
8. ✅ Commits all changes with message: `chore(release): 1.5.9`

## Workflow Example

```bash
# 1. Make changes and commit with conventional format
git add .
git commit -m "feat: add export to CSV functionality"
git commit -m "fix: resolve crash when timesheet is empty"

# 2. Run release (will bump to 1.6.0 because of "feat:" commit)
npm run release

# 3. Review generated CHANGELOG.md
cat CHANGELOG.md

# 4. Push changes and tags
git push --follow-tags
```

## Configuration

Configuration is in `.versionrc.json`. Key settings:

- **`types`**: Commit types and their sections in CHANGELOG
- **`packageFiles`**: Files to update version in
- **`bumpFiles`**: Files to bump version in
- **`scripts.postchangelog`**: Runs after CHANGELOG generation to sync versions

## Troubleshooting

### Release fails with "working directory must be clean"

**Solution:** Commit or stash all changes first
```bash
git add .
git commit -m "chore: prepare for release"
# or
git stash
```

### Wrong version bump detected

**Solution:** Use explicit version commands
```bash
npm run release:minor  # Force minor bump
npm run release:major # Force major bump
```

### CHANGELOG not updating correctly

**Solution:** Check commit message format. Must follow Conventional Commits.

### Version not syncing to constants.ts

**Solution:** Check that `scripts/update-constants.js` exists and is executable
```bash
node scripts/update-constants.js
```

## Integration with Build Process

The `build:main` script already runs `sync-version` before building:

```json
"build:main": "npm run sync-version && node scripts/build-backend-bundle.js"
```

This ensures version consistency even if you don't run a full release.

## Best Practices

1. ✅ **Always use conventional commits** - Makes versioning automatic
2. ✅ **Review CHANGELOG.md** before pushing release
3. ✅ **Push tags with `--follow-tags`** - Ensures tags are pushed to remote
4. ✅ **Release frequently** - Smaller releases are easier to manage
5. ✅ **Use prereleases** for testing: `npm run release:alpha` or `npm run release:beta`

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [standard-version Documentation](https://github.com/conventional-changelog/standard-version)
