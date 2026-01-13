# Automated Version Management Guide

## Current Setup

Your project currently uses:
- **Manual versioning** in `package.json` (currently `1.5.8`)
- **Custom `sync-version.js`** script to sync version across workspace packages
- **Manual `APP_VERSION`** constant in `app/shared/constants.ts`
- **No CHANGELOG** file (yet)

## What is Automated Version Management?

Automated version management tools analyze your git commit history and automatically:
1. **Bump version numbers** based on commit message conventions (Semantic Versioning)
2. **Generate CHANGELOG** files from commit messages
3. **Create git tags** for releases
4. **Update version in multiple files** (package.json, constants, etc.)

## Two Main Approaches

### 1. `standard-version` - Simple & Manual

**Best for:** Teams that want control over when releases happen

#### How It Works

1. You write commits following [Conventional Commits](https://www.conventionalcommits.org/) format:
   ```
   feat: add user authentication
   fix: resolve memory leak in data processing
   BREAKING CHANGE: refactor API endpoints
   ```

2. When ready to release, run:
   ```bash
   npm run release
   ```

3. It automatically:
   - Analyzes commits since last release
   - Determines version bump (patch/minor/major)
   - Updates `package.json` version
   - Generates/updates `CHANGELOG.md`
   - Creates git tag
   - Commits changes

#### Installation & Setup

```bash
npm install --save-dev standard-version
```

**Add to `package.json` scripts:**
```json
{
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:alpha": "standard-version --prerelease alpha",
    "release:beta": "standard-version --prerelease beta"
  }
}
```

#### Configuration (`.versionrc.json`)

```json
{
  "types": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "refactor", "section": "Code Refactoring" },
    { "type": "docs", "section": "Documentation", "hidden": false },
    { "type": "chore", "section": "Miscellaneous", "hidden": false }
  ],
  "scripts": {
    "postchangelog": "node scripts/sync-version.js && node scripts/update-constants.js"
  },
  "skip": {
    "tag": false
  },
  "packageFiles": [
    "package.json",
    "app/backend/package.json",
    "app/frontend/package.json",
    "app/shared/package.json"
  ]
}
```

#### Integration with Your Current Setup

You can integrate `standard-version` with your existing `sync-version.js`:

**Option A: Use postchangelog hook**
```json
{
  "scripts": {
    "postchangelog": "node scripts/sync-version.js && node scripts/update-constants.js"
  }
}
```

**Option B: Custom script wrapper**
Create `scripts/release.js`:
```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Run standard-version
execSync('standard-version', { stdio: 'inherit' });

// Read new version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
);

// Update constants.ts
const constantsPath = path.resolve(__dirname, '..', 'app', 'shared', 'constants.ts');
let constants = fs.readFileSync(constantsPath, 'utf-8');
constants = constants.replace(
  /export const APP_VERSION = "[\d.]+";/,
  `export const APP_VERSION = "${packageJson.version}";`
);
fs.writeFileSync(constantsPath, constants);

console.log(`✓ Updated APP_VERSION to ${packageJson.version}`);
```

#### Example Workflow

```bash
# 1. Make changes and commit with conventional format
git commit -m "feat: add dark mode support"
git commit -m "fix: resolve crash on empty timesheet"

# 2. When ready to release
npm run release

# 3. Review generated CHANGELOG.md and version bump
# 4. Push tags
git push --follow-tags
```

#### Pros
- ✅ Simple and predictable
- ✅ Full control over release timing
- ✅ Works offline
- ✅ Easy to customize
- ✅ Can review changes before pushing

#### Cons
- ❌ Requires manual release command
- ❌ Requires discipline to use conventional commits
- ❌ Doesn't integrate with CI/CD automatically

---

### 2. `semantic-release` - Fully Automated

**Best for:** Teams that want fully automated releases via CI/CD

#### How It Works

1. You write commits following Conventional Commits format
2. **On every push to main/master**, CI runs `semantic-release`
3. It automatically:
   - Analyzes commits
   - Determines if release is needed
   - Bumps version
   - Generates CHANGELOG
   - Creates git tag
   - Publishes to npm (if configured)
   - Creates GitHub release
   - Updates version in files

#### Installation & Setup

```bash
npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git
```

**Configuration (`.releaserc.json` or `release.config.js`):**

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        "pkgRoot": "."
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": [
          "CHANGELOG.md",
          "package.json",
          "app/backend/package.json",
          "app/frontend/package.json",
          "app/shared/package.json",
          "app/shared/constants.ts"
        ],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

**Custom plugin for constants.ts update:**

Create `release-plugins/update-constants.js`:
```javascript
const fs = require('fs');
const path = require('path');

module.exports = async (pluginConfig, context) => {
  const { nextRelease } = context;
  const constantsPath = path.resolve(__dirname, '..', 'app', 'shared', 'constants.ts');
  
  let constants = fs.readFileSync(constantsPath, 'utf-8');
  constants = constants.replace(
    /export const APP_VERSION = "[\d.]+";/,
    `export const APP_VERSION = "${nextRelease.version}";`
  );
  fs.readFileSync(constantsPath, constants);
  
  return {
    constants: constantsPath
  };
};
```

**Add to `package.json` scripts:**
```json
{
  "scripts": {
    "semantic-release": "semantic-release"
  }
}
```

**GitHub Actions workflow (`.github/workflows/release.yml`):**
```yaml
name: Release
on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### Example Workflow

```bash
# 1. Make changes and commit
git commit -m "feat: add export functionality"
git push origin main

# 2. CI automatically:
#    - Detects "feat:" = minor version bump
#    - Updates version to 1.6.0
#    - Generates CHANGELOG
#    - Creates git tag v1.6.0
#    - Creates GitHub release
#    - Updates all package.json files
#    - Updates constants.ts
```

#### Pros
- ✅ Fully automated
- ✅ No manual release step
- ✅ Integrates with CI/CD
- ✅ Creates GitHub releases automatically
- ✅ Prevents human error

#### Cons
- ❌ Requires CI/CD setup
- ❌ Less control over release timing
- ❌ More complex configuration
- ❌ Requires discipline with commit messages

---

## Comparison Table

| Feature | `standard-version` | `semantic-release` |
|---------|-------------------|-------------------|
| **Automation Level** | Manual trigger | Fully automated |
| **CI/CD Required** | No | Yes |
| **Setup Complexity** | Low | Medium |
| **Control** | High | Low |
| **GitHub Releases** | Manual | Automatic |
| **npm Publishing** | Manual | Automatic (optional) |
| **Learning Curve** | Low | Medium |
| **Best For** | Small teams, manual releases | CI/CD pipelines, frequent releases |

---

## Recommended Approach for Your Project

### Phase 1: Start with `standard-version`

Given your current setup, I recommend starting with `standard-version` because:

1. **You already have version sync logic** - easy to integrate
2. **Electron apps** benefit from controlled release timing
3. **No CI/CD dependency** - works immediately
4. **Easy to migrate** to `semantic-release` later if needed

### Implementation Steps

1. **Install standard-version:**
   ```bash
   npm install --save-dev standard-version
   ```

2. **Create `.versionrc.json`:**
   ```json
   {
     "scripts": {
       "postchangelog": "node scripts/sync-version.js && node scripts/update-constants.js"
     },
     "packageFiles": [
       "package.json",
       "app/backend/package.json",
       "app/frontend/package.json",
       "app/shared/package.json"
     ]
   }
   ```

3. **Create `scripts/update-constants.js`:**
   ```javascript
   #!/usr/bin/env node
   const fs = require('fs');
   const path = require('path');
   
   const packageJson = JSON.parse(
     fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
   );
   
   const constantsPath = path.resolve(__dirname, '..', 'app', 'shared', 'constants.ts');
   let constants = fs.readFileSync(constantsPath, 'utf-8');
   
   constants = constants.replace(
     /export const APP_VERSION = "[\d.]+";/,
     `export const APP_VERSION = "${packageJson.version}";`
   );
   
   fs.writeFileSync(constantsPath, constants);
   console.log(`✓ Updated APP_VERSION to ${packageJson.version}`);
   ```

4. **Add release scripts to `package.json`:**
   ```json
   {
     "scripts": {
       "release": "standard-version",
       "release:minor": "standard-version --release-as minor",
       "release:major": "standard-version --release-as major"
     }
   }
   ```

5. **Start using Conventional Commits:**
   ```
   feat: add new feature
   fix: fix bug
   docs: update documentation
   chore: maintenance tasks
   refactor: code refactoring
   perf: performance improvements
   BREAKING CHANGE: major change
   ```

### Phase 2: Consider `semantic-release` Later

If you:
- Set up CI/CD
- Want fully automated releases
- Release frequently
- Want automatic GitHub releases

Then migrate to `semantic-release`.

---

## Conventional Commits Format

Both tools use the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **`feat`**: New feature (minor version bump)
- **`fix`**: Bug fix (patch version bump)
- **`perf`**: Performance improvement (patch version bump)
- **`refactor`**: Code refactoring (no version bump by default)
- **`docs`**: Documentation changes (no version bump)
- **`style`**: Formatting changes (no version bump)
- **`test`**: Test changes (no version bump)
- **`chore`**: Maintenance tasks (no version bump)
- **`BREAKING CHANGE`**: Major version bump

### Examples

```bash
# Patch release (1.5.8 → 1.5.9)
git commit -m "fix: resolve memory leak in timesheet processing"

# Minor release (1.5.8 → 1.6.0)
git commit -m "feat: add dark mode support"

# Major release (1.5.8 → 2.0.0)
git commit -m "feat: redesign API

BREAKING CHANGE: API endpoints have changed from /v1 to /v2"
```

---

## Migration Path

### Current → standard-version

1. Install `standard-version`
2. Create `.versionrc.json` with postchangelog hook
3. Create `update-constants.js` script
4. Start using conventional commits
5. Run `npm run release` for next release

### standard-version → semantic-release

1. Set up CI/CD (GitHub Actions, etc.)
2. Install `semantic-release` and plugins
3. Create `.releaserc.json`
4. Add GitHub Actions workflow
5. Remove manual `release` script
6. Push to main triggers releases automatically

---

## Additional Tools

### Commit Message Enforcement

- **`commitlint`** - Lint commit messages
- **`husky`** + **`commitlint`** - Enforce format in git hooks

### Version Display

- **`pkg-up`** - Read version from package.json at runtime
- **`read-pkg-up`** - Similar functionality

### Release Notes

- **`release-notes-generator`** - Generate release notes from commits
- **`conventional-changelog`** - Generate changelogs

---

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version Documentation](https://github.com/conventional-changelog/standard-version)
- [semantic-release Documentation](https://semantic-release.gitbook.io/)
- [Semantic Versioning](https://semver.org/)
