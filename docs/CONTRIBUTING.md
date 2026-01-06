# Contributing to Sheetpilot

Thank you for your interest in contributing to Sheetpilot! This guide will help you understand our development workflow and conventions.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/andrewhughesskywater/Sheetpilot.git
   cd Sheetpilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run rebuild  # Rebuild native modules
   npm run install:browsers  # Install Playwright browsers
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for automated changelog generation and semantic versioning. All commits must follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature (triggers MINOR version bump)
- **fix**: A bug fix (triggers PATCH version bump)
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without changing functionality
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system or dependency changes
- **ci**: CI/CD configuration changes
- **chore**: Other changes that don't modify src or test files
- **revert**: Revert a previous commit

### Breaking Changes

For breaking changes that require a MAJOR version bump, add `BREAKING CHANGE:` in the footer:

```
feat(api): change authentication flow

BREAKING CHANGE: JWT tokens now expire after 24 hours instead of 7 days.
This requires users to re-authenticate more frequently.
```

### Examples

**Feature addition:**
```
feat(timesheet): add bulk submission support

Allow users to submit multiple timesheet entries at once
with a single bot automation run.
```

**Bug fix:**
```
fix(credentials): prevent duplicate service entries

Enforce UNIQUE constraint at database level to prevent
multiple credentials for the same service.
```

**Documentation:**
```
docs(readme): update installation instructions

Add Windows-specific steps for native module compilation.
```

**Refactoring:**
```
refactor(ipc): extract CSP handlers into separate module

Move CSP violation reporting logic into dedicated handler
for better code organization.
```

## Pre-commit Checks

Our pre-commit hooks automatically run:

1. **ESLint** - Lints and auto-fixes code issues
2. **Prettier** - Formats code consistently
3. **TypeScript** - Type checks entire codebase

If any check fails, the commit will be blocked. Fix the issues and try again.

To manually run these checks:

```bash
npm run lint         # Run ESLint
npm run format       # Run Prettier
npm run type-check   # Run TypeScript compiler
```

## Testing

Run tests before submitting changes:

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e      # End-to-end tests
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes following our conventions
3. Ensure all tests pass: `npm test`
4. Commit using conventional commits
5. Push and create a pull request

## Code Style

- Use TypeScript strict mode (already enabled)
- Prefer functional components in React
- Use structured logging (never console.log in production code)
- Follow existing patterns for IPC handlers, repositories, and services
- Keep functions small and focused

## Questions?

If you have questions or need help, please open an issue on GitHub.

Thank you for contributing! 🚀
