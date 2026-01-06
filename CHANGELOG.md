# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
