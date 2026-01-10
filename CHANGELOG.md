# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0](https://github.com/andrewhughesskywater/Sheetpilot/compare/v1.5.0...v1.6.0) (2026-01-10)


### Features

* add dynamic theme management and browser automation support ([a5d4c4e](https://github.com/andrewhughesskywater/Sheetpilot/commit/a5d4c4e5b2ac6d1af0b1dcc1e5bd9e0b0848e0bc))
* Add Linux build targets and exclude shared tests ([482bf2c](https://github.com/andrewhughesskywater/Sheetpilot/commit/482bf2c8abd5282fdf0cab30d9ea25e23ac59655))
* **bot:** add dynamic form configuration and context-based login tracking ([cb15a1d](https://github.com/andrewhughesskywater/Sheetpilot/commit/cb15a1dce919175fed8a12f9ce10410eec35a9ed))
* integrate Electron browser automation and enhance bot services ([590931b](https://github.com/andrewhughesskywater/Sheetpilot/commit/590931b51b91b3e78703c8aabcbfda538b63d78b))
* **rules:** add Function Naming Conventions rule ([0c3f5a6](https://github.com/andrewhughesskywater/Sheetpilot/commit/0c3f5a606558ad0c500b590c1f90186ab8a5a93e))


### Bug Fixes

* **core:** update window boot, adjust CSP, and fix bot tests ([9068c6e](https://github.com/andrewhughesskywater/Sheetpilot/commit/9068c6e8da7555d562e732ee3e41236f507180f1))
* correct environment variable handling for Playwright browser path ([b24a797](https://github.com/andrewhughesskywater/Sheetpilot/commit/b24a79708024067851a8ffb011a7a848c9754293))
* update Chromium browser path and set environment variable for Playwright ([e327966](https://github.com/andrewhughesskywater/Sheetpilot/commit/e327966606364c06269eb602f41a03b8e28b7d01))

## [Unreleased]

### Added
- Content Security Policy (CSP) with violation reporting and rate limiting
- Database migration system v2 with automatic backups and rollback support
- Development tooling: Prettier, Husky, lint-staged, commitlint
- Automated CHANGELOG generation via release-please
- TypeScript path aliases for cleaner imports
- Pre-commit hooks for code quality (linting, formatting, type checking)
- Conventional commit enforcement

### Changed
- Replaced console.error with structured logger in fatal error handlers
- Migrated relative imports to path aliases for better maintainability

## [1.5.7] - 2026-01-06

### Added
- Initial stable release
- Timesheet management with bot automation
- Credential storage with encryption
- Admin and user authentication
- Material Design 3 UI
- Comprehensive test suite (smoke, unit, integration, e2e)
- Plugin system for extensibility
- Electron security hardening (contextIsolation, sandbox, etc.)
