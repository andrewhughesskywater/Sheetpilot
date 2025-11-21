# Linting and Formatting

This project uses linting and formatting tools to maintain code quality and consistency.

## Tools Used

### Frontend (JavaScript/Svelte)
- **ESLint** - JavaScript/Svelte linting
- **Prettier** - Code formatting

### Backend (Rust)
- **Clippy** - Rust linting
- **rustfmt** - Rust code formatting

## Available Scripts

### Linting

Run all linters:
```bash
npm run lint
```

Lint JavaScript/Svelte only:
```bash
npm run lint:js
npm run lint:js:fix  # Auto-fix issues
```

Lint Rust only:
```bash
npm run lint:rust
npm run lint:rust:fix  # Auto-fix issues
```

### Formatting

Format all code:
```bash
npm run format
```

Format JavaScript/Svelte only:
```bash
npm run format:js
npm run format:js:check  # Check without modifying
```

Format Rust only:
```bash
npm run format:rust
npm run format:rust:check  # Check without modifying
```

## IDE Integration

### VS Code

The project includes `.vscode/settings.json` with:
- Auto-format on save
- ESLint auto-fix on save
- Clippy integration for Rust

**Recommended Extensions:**
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Svelte for VS Code (`svelte.svelte-vscode`)
- rust-analyzer (`rust-lang.rust-analyzer`)

### Other IDEs

Configure your IDE to:
1. Use ESLint for JavaScript/Svelte files
2. Use Prettier for formatting
3. Use Clippy and rustfmt for Rust files

## Configuration Files

- `eslint.config.js` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `.prettierignore` - Files to exclude from Prettier
- `backend/rustfmt.toml` - Rust formatting configuration
- `backend/.clippy.toml` - Clippy linting configuration

## Pre-commit Hooks

To ensure code quality before commits, consider setting up pre-commit hooks:

```bash
# Install husky (optional)
npm install --save-dev husky lint-staged
npx husky init
```

Then add to `package.json`:
```json
{
  "lint-staged": {
    "*.{js,svelte}": ["eslint --fix", "prettier --write"],
    "*.rs": ["cargo fmt --", "cargo clippy --fix --allow-dirty --allow-staged"]
  }
}
```

## CI/CD Integration

In your CI pipeline, run:

```bash
# Check linting
npm run lint

# Check formatting
npm run format:js:check
npm run format:rust:check
```

## Common Issues

### ESLint errors in config files

Config files are excluded from linting by default. If needed, add to `eslint.config.js` ignores.

### Clippy warnings treated as errors

By default, `npm run lint:rust` treats warnings as errors (`-D warnings`). To change this, modify the script in `package.json`.

### Formatting conflicts

If ESLint and Prettier conflict, Prettier takes precedence. The `eslint-config-prettier` package disables conflicting ESLint rules.

