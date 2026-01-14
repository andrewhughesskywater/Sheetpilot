# SheetPilot Documentation

**Last Updated**: November 12, 2025
**Version**: 1.6.0

## Table of Contents

1. [Introduction](#introduction)
2. [Module System (ESM)](#module-system-esm)
3. [User Guide](#user-guide)
   - [Getting Started](#getting-started)
   - [Main Features](#main-features)
   - [Timesheet Tab](#timesheet-tab)
   - [Archive Tab](#archive-tab)
   - [Settings Tab](#settings-tab)
   - [Workflows & Best Practices](#workflows--best-practices)
   - [Keyboard Shortcuts](#keyboard-shortcuts)
   - [Troubleshooting](#troubleshooting)
   - [Security & Privacy](#security--privacy)
4. [Developer Documentation](#developer-documentation)
   - [Testing](#testing)
     - [Test Organization](#test-organization)
     - [Test Quality Metrics](#test-quality-metrics)
     - [Vitest Setup](#vitest-setup)
   - [Release Management](#release-management)
     - [Release Guide](#release-guide)
     - [Automated Version Management](#automated-version-management)
   - [Security Architecture](#security-architecture)
   - [Script Consolidation](#script-consolidation)
   - [Architecture Diagrams](#architecture-diagrams)
5. [Architecture References](#architecture-references)

---

## Introduction

SheetPilot is a comprehensive desktop application designed to streamline timesheet management and automate submission to SmartSheet. Built with Electron, SheetPilot provides a modern, efficient interface for tracking time entries with features like smart data entry, validation, and secure credential storage.

### What SheetPilot Does

- **Track Time:** Enter and manage daily time entries in an intuitive spreadsheet interface
- **Validate Data:** Real-time validation ensures accurate data before submission
- **Automate Submission:** Automatically submit timesheet entries to SmartSheet
- **Store Securely:** Encrypted local storage for credentials and timesheet data
- **Archive History:** View all previously submitted timesheet entries

---

## Module System (ESM)

This project uses **ESM (ECMAScript Modules) exclusively**. All code must use ESM syntax:

- Use `import` statements instead of `require()`
- Use `export` statements instead of `module.exports`
- All JavaScript/TypeScript files use ESM module syntax
- The project is configured with `"type": "module"` in `package.json`

**Examples:**

✅ **Correct (ESM):**

```typescript
import { readFileSync } from 'fs';
import path from 'path';

export function myFunction() {
  // ...
}
```

❌ **Incorrect (CommonJS):**

```javascript
const fs = require('fs');
const path = require('path');

module.exports = function myFunction() {
  // ...
};
```

---

## User Guide

### Getting Started

#### First-Time Setup

1. **Launch SheetPilot**
   - Open the application from your desktop or start menu
   - Wait for the application to check for updates

2. **Log In**
   - The login dialog will appear automatically
   - Admin users must set the `SHEETPILOT_ADMIN_PASSWORD` environment variable
   - Regular users will create their own credentials

3. **Start Using SheetPilot**
   - Navigate to the **Timesheet** tab
   - Begin entering your time entries

### Main Features

#### Core Capabilities

##### 1. Secure Credential Storage

- SmartSheet credentials are encrypted using a machine-specific master key
- All credential data is stored locally on your device
- No credentials are transmitted to external servers (except during SmartSheet authentication)
- Update credentials anytime from the Settings tab

##### 2. Timesheet Management

- Spreadsheet-style grid interface powered by Handsontable
- Real-time data validation with visual feedback
- Smart date suggestions based on weekday patterns
- Spell-checking for task descriptions
- Macro support for frequently-used entries
- Auto-save to local SQLite database
- Keyboard shortcuts for efficient data entry

##### 3. SmartSheet Integration

- One-click submission to SmartSheet
- Automatic validation before submission
- Progress tracking during submission
- Detailed error reporting
- Prevents duplicate submissions
- Headless or visible browser mode

##### 4. Submission Archive

- View all previously submitted timesheet entries
- Search and filter archived data
- Export capabilities (future enhancement)
- Submission timestamp tracking

##### 5. Performance Optimized

- Fast startup time
- Responsive UI with non-blocking operations
- Efficient batch database operations
- Minimal memory footprint

##### 6. Local Data Storage

- SQLite database for all timesheet data
- Local backup in localStorage
- No cloud dependencies
- Full offline access to data

##### 7. Automatic Updates

- Built-in auto-update system
- Download progress indication
- Seamless installation process
- Update notifications

### Timesheet Tab

The Timesheet tab is where you enter, edit, and submit your time entries.

#### Grid Interface

The timesheet uses a spreadsheet-style grid with the following columns:

| Column | Description | Format | Required |
|--------|-------------|--------|----------|
| **Date** | Work date | MM/DD/YYYY | Yes |
| **Time In** | Start time | HH:MM (24-hour) | Yes |
| **Time Out** | End time | HH:MM (24-hour) | Yes |
| **Hours** | Duration (auto-calculated) | Decimal | Yes |
| **Project** | Project code | Dropdown | Yes |
| **Tool** | Tool name (project-specific) | Dropdown | Conditional |
| **Detail Charge Code** | Charge code (tool-specific) | Dropdown | Conditional |
| **Task Description** | Description of work | Text | Yes |

#### Entering Data

##### Manual Entry

1. Click on a cell to select it
2. Type your data
3. Press **Enter** or **Tab** to move to the next cell
4. Data is automatically saved to the local database

##### Using Macros

1. Press **Ctrl+Shift+M** to open the Macro Manager
2. Create macros for frequently-used entries
3. Apply macros to quickly populate rows
4. Macros can include all fields except the date

##### Smart Date Suggestions

- SheetPilot detects weekday patterns in your entries
- When adding new rows, it suggests the next logical work date
- Automatically skips weekends if you consistently work weekdays
- Visible as placeholder text in empty date cells

##### Time Input

- Enter times in 24-hour format (e.g., 08:00, 17:30)
- SheetPilot automatically formats and validates time entries
- Hours are calculated automatically based on Time In and Time Out
- Red highlighting indicates invalid time entries

##### Project Selection

- Click the dropdown arrow or type to filter projects
- Some projects require tool selection
- Tool options change based on the selected project
- Charge codes appear based on the selected tool

#### Data Validation

SheetPilot validates your data in real-time:

##### Visual Feedback

- **Red highlight:** Invalid or missing data
- **Normal appearance:** Valid data
- **Validation errors:** Displayed at the bottom of the grid

##### Validation Rules

- **Date:** Must be a valid date in MM/DD/YYYY format
- **Time In/Out:** Must be valid times; Time Out must be after Time In
- **Hours:** Must be positive and match Time In/Out difference
- **Project:** Must be a valid project from the dropdown
- **Tool:** Required for certain projects
- **Charge Code:** Required for certain tools
- **Task Description:** Cannot be empty
- **Overlap:** Prevents time entries that overlap with existing entries

#### Submitting Your Timesheet

1. **Review Your Entries**
   - Ensure all rows have valid data (no red highlights)
   - Check that hours total correctly
   - Verify project codes and descriptions are accurate

2. **Click Submit Timesheet**
   - Located at the bottom of the Timesheet tab
   - Button changes color based on validation status:
     - **Green (Ready):** All entries valid, ready to submit
     - **Yellow (Warning):** Some entries may have issues
     - **Gray (Neutral):** No entries or processing

3. **Monitor Progress**
   - A progress bar appears showing submission status
   - Individual entry results are logged
   - Errors are displayed if any entries fail

4. **Verify Submission**
   - Navigate to the **Archive** tab
   - Confirm your entries appear with submission timestamps
   - Check SmartSheet directly if needed

#### Spell-Checking

- Task descriptions have built-in spell-checking
- Misspelled words are underlined in red
- Right-click misspelled words for suggestions (browser-dependent)
- Helps maintain professional, accurate descriptions

### Archive Tab

The Archive tab displays all timesheet entries that have been submitted to SmartSheet.

#### Features

##### View Submitted Entries

- Displays all historical timesheet entries
- Shows submission timestamps
- Read-only grid interface
- Same columns as the Timesheet tab

##### Search and Filter

- Scroll through historical data
- Sort by clicking column headers
- Find specific entries quickly

##### Export (Future Enhancement)

- CSV export functionality planned
- Will allow external analysis
- Backup capabilities

#### Understanding the Archive

- **Automatic Updates:** Archive refreshes when you navigate to the tab
- **Submission Status:** Only successfully submitted entries appear
- **No Editing:** Archive entries cannot be modified (edit in SmartSheet if needed)
- **Local Storage:** All archive data is stored in your local SQLite database

### Settings Tab

The Settings tab provides access to application configuration, credential management, and support tools.

#### Available Options

##### 1. Export Logs

- Downloads application logs for troubleshooting
- Includes error messages and diagnostic information
- Exports the latest log file as a text file
- Useful when requesting technical support

##### 2. Update Credentials

- Add or update your SmartSheet credentials
- Email field auto-completes @skywatertechnology.com domain
- Password is encrypted before storage
- Updates take effect immediately
- Required if you change your SmartSheet password

##### 3. User Guide

- Opens the in-application user manual
- Comprehensive documentation of all features
- Includes troubleshooting tips
- Searchable by section

##### 4. Application Settings

###### Browser Settings

- **Headless Mode:** Run browser automation without visible windows
  - **Enabled (default):** Browser runs in the background during submission
  - **Disabled:** Browser window is visible during submission (useful for troubleshooting)
  - Changes take effect on next timesheet submission

##### 5. About SheetPilot

- Displays application version
- Shows creator information
- Provides application description

##### 6. Logout

- Logs out of the current session
- Returns to the login screen
- Does not delete stored credentials or data

##### 7. Admin Tools (Admin Users Only)

⚠️ **Warning:** Admin users cannot submit timesheet entries to SmartSheet

Available admin operations:

###### Clear All Credentials

- Permanently deletes all stored credentials
- Users must re-enter credentials to submit timesheets
- Cannot be undone
- Use when troubleshooting credential issues

###### Rebuild Database

- **DESTRUCTIVE OPERATION**
- Permanently deletes ALL timesheet entries and credentials
- Resets database to a clean state
- Cannot be undone
- Use only for critical database corruption issues
- Create backups before using this feature

### Workflows & Best Practices

#### Daily Workflow

##### Morning Routine

1. Open SheetPilot
2. Navigate to the Timesheet tab
3. Review any existing entries from previous days
4. Prepare to log time as you work

##### Throughout the Day

1. Log time entries as you complete tasks
2. Use descriptive task descriptions
3. Ensure accurate project codes
4. Verify time durations

##### End of Day

1. Review all entries for accuracy
2. Fix any validation errors (red highlights)
3. SheetPilot auto-saves your work
4. Close the application when finished

#### Weekly Submission Process

##### Recommended Schedule

- Submit timesheets weekly (typically Friday afternoon or Monday morning)
- Check with your supervisor for specific submission deadlines
- Review the entire week before submitting

##### Submission Steps

1. **Review All Entries**
   - Open the Timesheet tab
   - Scroll through the week's entries
   - Verify all dates, times, projects, and descriptions
   - Check that hours total correctly (typically 40 hours/week)

2. **Fix Validation Errors**
   - Look for red highlights indicating errors
   - Review validation error messages at the bottom
   - Correct any missing or invalid data

3. **Submit**
   - Click the "Submit Timesheet" button
   - Wait for the progress bar to complete
   - Review any error messages if entries fail

4. **Verify**
   - Navigate to the Archive tab
   - Confirm all entries appear with timestamps
   - Optionally check SmartSheet directly

#### Best Practices

##### Data Entry Tips

- ✅ Log time entries daily to avoid forgetting tasks
- ✅ Use clear, descriptive task descriptions
- ✅ Be specific with project codes
- ✅ Round times to appropriate increments
- ✅ Double-check dates and times before submitting

##### Organization

- ✅ Create macros for repetitive entries
- ✅ Organize your timesheet chronologically
- ✅ Review and correct entries before end of day
- ✅ Keep project codes consistent

##### Security

- ✅ Update credentials immediately if your password changes
- ✅ Log out when leaving your computer unattended
- ✅ Keep your operating system and security software updated
- ✅ Never share your SmartSheet credentials

##### Problem Resolution

- ✅ Enable visible browser mode if submissions fail
- ✅ Export logs when reporting issues
- ✅ Check validation errors before submitting
- ✅ Verify internet connectivity for submissions

### Keyboard Shortcuts

SheetPilot includes numerous keyboard shortcuts for efficient data entry.

#### General Navigation

| Shortcut | Action |
|----------|--------|
| **Tab** | Move to next cell (right) |
| **Shift+Tab** | Move to previous cell (left) |
| **Enter** | Move to next row (down) |
| **Shift+Enter** | Move to previous row (up) |
| **Arrow Keys** | Navigate between cells |
| **Home** | Jump to first cell in row |
| **End** | Jump to last cell in row |
| **Page Up** | Scroll up one page |
| **Page Down** | Scroll down one page |

#### Editing

| Shortcut | Action |
|----------|--------|
| **F2** | Enter edit mode on selected cell |
| **Delete** | Clear selected cell(s) |
| **Backspace** | Clear cell and enter edit mode |
| **Escape** | Cancel editing |
| **Ctrl+C** | Copy selected cell(s) |
| **Ctrl+V** | Paste into selected cell(s) |
| **Ctrl+X** | Cut selected cell(s) |
| **Ctrl+Z** | Undo last change |
| **Ctrl+Y** | Redo last undone change |

#### Selection

| Shortcut | Action |
|----------|--------|
| **Ctrl+A** | Select all cells |
| **Shift+Arrow Keys** | Extend selection |
| **Ctrl+Space** | Select entire column |
| **Shift+Space** | Select entire row |

#### Data Entry Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+M** | Open Macro Manager |
| **Alt+Down** | Open dropdown (Project, Tool, Charge Code) |

#### Application

| Shortcut | Action |
|----------|--------|
| **Ctrl+S** | Manual save (auto-save is enabled) |
| **Ctrl+R** | Refresh current tab |
| **Ctrl+Q** | Quit application |

### Troubleshooting

#### Authentication Issues

##### Invalid Credentials Error

**Symptoms:**

- Cannot log in
- Submission fails with authentication error
- "Invalid credentials" message

**Solutions:**

1. Verify your SmartSheet email and password are correct
2. Navigate to Settings → Update Credentials
3. Re-enter your email and password
4. Ensure your SmartSheet account is active
5. Contact IT if password reset is needed

##### Connection Timeout

**Symptoms:**

- Submission hangs or times out
- Cannot connect to SmartSheet
- Network-related error messages

**Solutions:**

1. Check your internet connection
2. Verify SmartSheet website is accessible in a browser
3. Check for firewall or antivirus blocking
4. Wait a few minutes and try again
5. Contact IT if issue persists

#### Submission Issues

##### Some Entries Failed to Submit

**Symptoms:**

- Progress bar shows partial success
- Error messages in submission log
- Not all entries appear in Archive

**Solutions:**

1. Check validation errors at bottom of Timesheet tab
2. Common causes:
   - Missing required fields (project, description)
   - Invalid time format
   - Time overlap with existing entries
   - Date out of acceptable range
3. Fix highlighted errors (red cells)
4. Click Submit again (only failed entries will resubmit)

##### No Entries to Submit

**Symptoms:**

- Submit button is disabled or shows "No entries"
- Nothing happens when clicking Submit

**Solutions:**

1. Ensure you have timesheet entries in the Timesheet tab
2. Check that entries have not already been submitted
3. Verify entries have valid data (no red highlights)
4. Refresh the Timesheet tab (Ctrl+R)

##### Browser Automation Fails

**Symptoms:**

- Browser opens but doesn't navigate
- Submission fails during browser automation
- Timeout during form filling

**Solutions:**

1. Navigate to Settings → Application Settings
2. Disable Headless Mode to see what the browser is doing
3. Check for SmartSheet website changes
4. Ensure SmartSheet is accessible
5. Export logs and contact support if issue persists

#### Application Issues

##### Application Won't Start

**Symptoms:**

- Application doesn't launch
- Crash on startup
- Blank/white screen

**Solutions:**

1. Restart your computer
2. Check Task Manager for hung SheetPilot processes
3. End any hung processes
4. Try launching again
5. Reinstall SheetPilot if issue persists
6. Contact IT for assistance

##### Data Not Loading

**Symptoms:**

- Empty grid on Timesheet tab
- Archive tab shows no data
- "Error loading data" message

**Solutions:**

1. Check database file integrity
2. Navigate to Settings → Export Logs to check for errors
3. Refresh the tab (Ctrl+R)
4. Restart SheetPilot
5. If admin: consider Rebuild Database (DESTRUCTIVE)

##### Performance Issues

**Symptoms:**

- Slow response times
- Lag when typing
- Application freezes

**Solutions:**

1. Close other applications to free memory
2. Restart SheetPilot
3. Restart your computer
4. Check for excessive log files
5. Contact IT if issue persists

#### Validation Errors

##### Red Highlighted Cells

**Symptoms:**

- Cells appear with red background
- Validation error messages at bottom

**Solutions:**

1. Read the validation error message
2. Common validation errors:
   - **Invalid date:** Use MM/DD/YYYY format
   - **Invalid time:** Use HH:MM 24-hour format (e.g., 17:30, not 5:30 PM)
   - **Time Out before Time In:** Ensure end time is after start time
   - **Missing project:** Select a project from dropdown
   - **Missing tool:** Some projects require tool selection
   - **Missing charge code:** Some tools require charge code
   - **Empty description:** Add a task description
   - **Time overlap:** Entry overlaps with another entry
3. Correct the highlighted cell
4. Validation updates in real-time

### Security & Privacy

SheetPilot is designed with security and privacy as core priorities.

#### Data Security Measures

##### Local Data Storage

- **All timesheet data and credentials are stored locally on your device**
- Uses SQLite database for reliable, fast storage
- No data transmitted to external servers (except SmartSheet during submission)
- Data remains on your machine even when offline
- Full control over your data

##### Encrypted Credentials

- SmartSheet credentials are encrypted before storage
- Encryption uses AES-256 with machine-specific master key
- Master key derived from system identifiers
- Password never stored in plain text
- Decryption only possible on your machine

##### Secure Communication

- All communication with SmartSheet uses HTTPS encryption
- Credentials only transmitted during authentication
- No man-in-the-middle vulnerability
- Secure TLS protocol for all network requests

##### No Data Collection

- SheetPilot does not collect usage analytics
- No telemetry or tracking
- No personal information transmitted to external services
- Logs are stored locally only
- Your privacy is protected

#### Privacy Best Practices

##### Credential Management

- ✅ Update credentials immediately if your SmartSheet password changes
- ✅ Never share your SmartSheet credentials with others
- ✅ Use a strong, unique password for SmartSheet
- ✅ Change credentials periodically as per company policy

##### Device Security

- ✅ Ensure your device is secured with a strong password
- ✅ Enable screen lock when away from device
- ✅ Keep antivirus and security software up to date
- ✅ Lock computer when leaving desk

##### Data Management

- ✅ Consider regular backups of timesheet data
- ✅ Export logs only when needed for troubleshooting
- ✅ Be cautious when using SheetPilot on shared computers
- ✅ Log out when using SheetPilot on public/shared devices

##### Application Updates

- ✅ Allow SheetPilot to install updates automatically
- ✅ Updates include security patches
- ✅ Review update notifications
- ✅ Restart application after updates

#### Security Warnings

##### ⚠️ Important Security Notes

###### Credentials

- Never share your SmartSheet credentials with others
- Never write passwords on paper or store unencrypted
- Use company-approved password management if available

###### Keep Your Device Secure

- Keep operating system and security software updated
- Enable automatic security updates
- Use company-provided antivirus software

###### Public Computers

- Avoid using SheetPilot on public or shared computers
- If necessary, log out and close application when finished
- Do not save credentials on shared machines

###### Suspicious Activity

- Report any suspicious behavior immediately
- Contact IT if credentials may have been compromised
- Change SmartSheet password if security is suspected

#### Compliance

SheetPilot complies with organizational security requirements:

- Local-only data storage
- Encrypted credential storage
- Secure communication protocols
- No external data transmission (except SmartSheet)
- Regular security updates

For specific security questions or concerns, contact your IT security team.

---

## Developer Documentation

### Testing

#### Test Organization

##### Overview

This section provides comprehensive guidelines for organizing and structuring tests in the SheetPilot codebase. These guidelines ensure consistency, maintainability, and discoverability of tests across all projects.

##### Test Directory Structure

**Current Organization:**

```
app/
├── backend/
│   └── tests/
│       ├── unit/              # Unit tests (pure logic, no dependencies)
│       ├── integration/       # Integration tests (multiple components)
│       ├── ipc/               # IPC handler tests
│       ├── services/          # Service-specific tests
│       ├── repositories/      # Repository/database tests
│       ├── contracts/         # Contract/interface validation tests
│       ├── validation/        # Validation logic tests
│       ├── middleware/        # Middleware tests
│       ├── smoke/             # Smoke tests (quick validation)
│       ├── fixtures/          # Test data and mocks
│       ├── helpers/           # Test utilities and helpers
│       └── setup.ts           # Test setup/configuration
│
├── frontend/
│   └── tests/
│       ├── components/        # Component tests
│       ├── integration/       # Integration tests
│       ├── utils/             # Utility function tests
│       ├── hooks/             # Custom hook tests
│       └── setup.ts           # Test setup/configuration
│
├── shared/
│   └── tests/
│       ├── unit/              # Unit tests for shared modules
│       └── utils/             # Shared utility tests
│
└── tests/                     # Cross-cutting tests
    ├── accessibility/         # Accessibility tests
    ├── e2e/                   # End-to-end tests
    ├── integration/           # Cross-component integration
    ├── performance/           # Performance tests
    └── security/              # Security tests
```

##### Test Categories

**Unit Tests**

- **Location**: `tests/unit/`
- **Purpose**: Test individual functions/modules in isolation
- **Characteristics**:
  - Fast execution (< 5s per test)
  - No external dependencies (mocked)
  - Test pure logic and transformations
  - No database/network/file system access
- **Examples**: Validation functions, data transformations, calculations

**Integration Tests**

- **Location**: `tests/integration/`
- **Purpose**: Test interactions between multiple components
- **Characteristics**:
  - May use real dependencies (database, file system)
  - Test workflows and data flow
  - Longer execution time acceptable (< 30s)
  - Test component integration, not individual units
- **Examples**: Database operations, IPC handlers, service workflows

**Contract Tests**

- **Location**: `tests/contracts/`
- **Purpose**: Validate interface/contract compliance
- **Characteristics**:
  - Test that implementations satisfy interfaces
  - Prevent breaking changes to contracts
  - Validate plugin interfaces
- **Examples**: Plugin interface validation, IPC contract validation

**E2E Tests**

- **Location**: `tests/e2e/` or `app/tests/e2e/`
- **Purpose**: Test complete user workflows
- **Characteristics**:
  - Test full application flows
  - May use real browser/database
  - Longer execution time acceptable
  - Test user journeys, not technical implementation
- **Examples**: User registration flow, timesheet submission flow

**Smoke Tests**

- **Location**: `tests/smoke/`
- **Purpose**: Quick validation of critical paths
- **Characteristics**:
  - Very fast execution (< 10s total)
  - Test only critical functionality
  - Run in CI/CD pipelines
  - Catch major breakages quickly
- **Examples**: Critical path validation, basic functionality checks

##### File Organization Rules

**1. Test File Naming**

**Format**: `<component-name>.spec.ts` or `<component-name>.test.ts`

**Rules**:

- Use `.spec.ts` for specification-style tests (preferred)
- Use `.test.ts` for test-style tests (acceptable)
- Match test file name to source file name when possible
- Use kebab-case for multi-word names
- Group related tests in single files when logical

**Examples**:

- `timesheet-validation.spec.ts` ✅
- `TimesheetValidation.spec.ts` ❌ (PascalCase)
- `timesheet_validation.spec.ts` ❌ (snake_case)
- `timesheet-validation.test.ts` ✅ (acceptable)

**2. Directory Structure by Feature**

**Rule**: Mirror source code structure when logical

**Examples**:

- `src/services/database.ts` → `tests/services/database.spec.ts`
- `src/components/TimesheetGrid.tsx` → `tests/components/TimesheetGrid.spec.tsx`
- `src/utils/validation.ts` → `tests/utils/validation.spec.ts`

**Exception**: Integration tests that span multiple features belong in `tests/integration/`

**3. Test File Location Rules**

**Rule**: Keep tests close to source when testing single component, use integration directory for multi-component tests

**Examples**:

- Single component test → `tests/components/LoginDialog.spec.tsx`
- Multi-component workflow → `tests/integration/auth-flow.spec.tsx`
- Cross-cutting concern → `app/tests/security/authentication.spec.ts`

##### Test Structure and Organization

**Test Suite Organization:**

```typescript
describe('Component Name', () => {
  // Setup/teardown hooks
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Feature/Behavior Category', () => {
    it('should do something specific', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

**Naming Conventions:**

- **Test Suite Names**: Use descriptive names, include component/feature name, use sentence case
- **Test Case Names**: Use "should" statements, be specific and descriptive, focus on behavior, use sentence case

**Examples:**

```typescript
// ✅ Good
describe('TimesheetGrid', () => {
  describe('Validation', () => {
    it('should validate date format correctly', () => {});
    it('should reject invalid dates', () => {});
  });
});

// ❌ Bad
describe('TimesheetGrid Tests', () => {  // Redundant "Tests"
  describe('test validation', () => {     // Use "test" in name
    it('validates dates', () => {});      // Missing "should"
  });
});
```

##### Test Utilities Organization

**Shared Test Utilities**

**Location**: `tests/helpers/` or `tests/fixtures/`

**Structure**:

```
tests/
├── helpers/
│   ├── assertion-helpers.ts    # Custom assertions
│   ├── test-builders.ts         # Test data builders
│   └── markdown-reporter.ts     # Custom reporters
├── fixtures/
│   ├── timesheet-data.ts        # Test data
│   ├── mock-database.ts         # Mock implementations
│   └── in-memory-db-mock.ts     # Database mocks
└── test-utils.ts                # General test utilities
```

**Rules**:

- **Helpers**: Reusable test utilities (assertions, builders, utilities)
- **Fixtures**: Test data and mock implementations
- **test-utils.ts**: General utilities used across many tests
- Keep utilities focused and single-purpose
- Document utility functions

**Import Patterns:**

```typescript
// ✅ Good - Relative imports from test utilities
import { createTestDatabase } from '../test-utils';
import { validTimesheetEntries } from '../fixtures/timesheet-data';
import { assertValidTimesheetRow } from '../helpers/assertion-helpers';

// ❌ Bad - Absolute imports from tests (too fragile)
import { createTestDatabase } from '@/tests/test-utils';
```

##### Best Practices

1. **Test Isolation**: Each test should be independent, no shared state between tests, use `beforeEach`/`afterEach` for setup/cleanup, use unique test data for each test

2. **Test Data Management**: Use fixtures for reusable test data, use builders for complex test objects, keep test data minimal and focused, use descriptive names for test data

3. **Mocking Strategy**: Mock external dependencies (database, network, file system), use real implementations for integration tests, keep mocks simple and focused, document complex mocks

4. **Test Coverage**: Aim for high coverage on critical paths, don't chase 100% coverage blindly, focus on edge cases and error paths, test user workflows, not implementation details

5. **Test Documentation**: Use descriptive test names, add comments for complex test logic, document test purpose in file header, keep test documentation up-to-date

#### Test Quality Metrics

##### Overview

This section defines the quality metrics used to assess test quality across the SheetPilot codebase. These metrics help ensure tests are maintainable, reliable, and follow best practices.

##### Metrics

**1. Coverage Thresholds**

**Purpose**: Ensure adequate test coverage of source code.

**Current Thresholds**:

- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

**Location**: Defined in all `vitest.config.*.ts` files

**Targets**:

- Critical paths: 90%+
- Business logic: 80%+
- Utilities: 70%+
- UI components: 60%+ (interaction tests prioritized over line coverage)

**2. Test Execution Time**

**Purpose**: Identify slow tests that impact developer productivity.

**Standards**:

- **Unit tests**: < 5 seconds per test
- **Integration tests**: < 30 seconds per test
- **E2E tests**: < 2 minutes per test
- **Smoke tests**: < 10 seconds total

**Tracking**:

- Per-test timeout configured in vitest configs
- Slow test detection via `test-performance.ts` utility
- CI/CD reports execution time trends

**Action Items**:

- Tests exceeding thresholds should be optimized or split
- Slow suites should be reviewed for unnecessary setup/teardown

**3. Test Organization Compliance**

**Purpose**: Ensure tests follow organizational guidelines for discoverability and maintainability.

**Checks**:

- All test files in correct directories
- Naming conventions (kebab-case, `.spec.ts`)
- No root-level test files (except in `app/tests/`)
- Proper directory structure matches guidelines

**Validation**: Run `scripts/validate-test-organization.ts`

**Compliance Score**: Percentage of files that pass all checks

**Target**: 100% compliance

**4. Test Isolation**

**Purpose**: Ensure tests are independent and don't affect each other.

**Checks**:

- Shared state detection between tests
- Cleanup verification (afterEach hooks)
- Database/file system isolation
- Mock state isolation

**Validation**: `app/backend/tests/helpers/test-isolation-checker.ts`

**Violation Types**:

- **Error**: Database/file system isolation issues
- **Warning**: Missing cleanup hooks, shared state patterns

**Target**: Zero errors, minimal warnings

**5. Test Maintainability**

**Purpose**: Assess how easy tests are to understand and modify.

**Metrics**:

- **Complexity**: Cyclomatic complexity of test code
- **Duplication**: Percentage of duplicate code
- **Documentation**: Presence of file/function documentation
- **Test-to-source ratio**: Number of tests per source file

**Analysis**: Run `scripts/analyze-test-quality.ts`

**Targets**:

- Average complexity: < 10
- Duplication score: < 30%
- Documentation coverage: > 80%
- Test-to-source ratio: > 1:1 for critical paths

##### Running Quality Checks

**Validate Test Organization:**

```bash
npx tsx scripts/validate-test-organization.ts
```

**Analyze Test Quality:**

```bash
npx tsx scripts/analyze-test-quality.ts
```

**Generate Full Quality Report:**

```bash
# Run all quality checks and generate report
npm run test:quality
```

##### Quality Thresholds and Targets

- **Coverage**: 70% baseline, 80-90% for critical paths
- **Execution Time**: Unit < 5s, Integration < 30s, E2E < 2min
- **Organization Compliance**: 100%
- **Isolation Errors**: 0
- **Documentation Coverage**: > 80%
- **Complexity**: Average < 10
- **Duplication**: < 30%

#### Vitest Setup

##### Overview

This project uses **Vitest** as the unified test runner for all test suites across the monorepo. The VS Code Vitest Extension provides a native testing UI integrated into your IDE.

##### Project Structure

```
Sheetpilot/
├── vitest.config.ts                    # Root workspace config
├── app/
│   ├── backend/
│   │   ├── vitest.config.unit.ts       # Unit tests (5s timeout)
│   │   ├── vitest.config.integration.ts # Integration tests (120s timeout)
│   │   ├── vitest.config.e2e.ts        # E2E tests (120s timeout)
│   │   ├── vitest.config.smoke.ts      # Smoke tests (60s timeout)
│   │   └── tests/
│   ├── frontend/
│   │   ├── vitest.config.ts            # Frontend React tests (10s timeout)
│   │   └── tests/
│   └── shared/
│       ├── vitest.config.ts            # Shared library tests (5s timeout)
│       └── tests/
└── .vscode/
    ├── settings.json                    # Vitest plugin settings
    ├── launch.json                      # Debug configurations
    └── extensions.json                  # Recommended extensions
```

##### How to Use

**1. Opening Tests in VS Code**

- Open the **Testing** sidebar (left panel icon or `Ctrl+Shift+D`)
- All test projects will be auto-discovered:
  - `backend-unit`
  - `backend-integration`
  - `backend-e2e`
  - `backend-smoke`
  - `frontend`
  - `shared`

**2. Running Tests**

**From the Testing UI:**

- Click **▶** next to a project to run all tests
- Click **▶** next to a file to run tests in that file
- Click **▶** next to a test to run a single test
- Click **🔄** (refresh icon) to reload test discovery

**Keyboard Shortcuts:**

- `Ctrl+Shift+D` - Open Testing sidebar
- Double-click test to jump to source
- Right-click test for context menu (run, debug, reveal)

**3. Watch Mode**

The extension supports automatic re-run on save:

1. Right-click a project in the Testing sidebar
2. Select "Run in Watch Mode"
3. Tests will re-run whenever you save a file

**4. Debugging Tests**

**Debug a Single Test:**

1. Open the test file in the editor
2. Click the ▶ Debug icon next to the test name
3. Or use the Testing sidebar context menu → "Debug"

**Pre-configured Debug Targets (F5):**

- `Debug Vitest Tests` - Run all tests with debugger
- `Debug Vitest (Current File)` - Debug tests in current file
- `Debug Vitest (Watch Mode)` - Watch mode with debugger
- `Debug Backend Unit Tests` - Backend-specific debugging
- `Debug Frontend Tests` - Frontend-specific debugging
- `Debug Shared Tests` - Shared library debugging

**5. Coverage**

Generate coverage reports:

1. Right-click a project in Testing sidebar
2. Select "Show Coverage"
3. Or from command palette: `Vitest: Show Coverage`

Coverage outputs:

- `coverage/` folder with HTML report
- Open `coverage/index.html` in browser for visualization

##### Configuration Details

**Timeouts**

Each project has appropriate timeouts:

| Project | Timeout | Hook Timeout |
|---------|---------|--------------|
| Unit Tests | 5s | 10s |
| Integration | 120s | 30s |
| E2E | 120s | 30s |
| Smoke | 60s | 15s |
| Frontend | 10s | 10s |
| Shared | 5s | 10s |

**Thread Pooling**

Tests run in parallel for better performance:

| Project | Max Threads | Min Threads |
|---------|-------------|------------|
| Unit/Smoke | 4 | 1 |
| Integration | 2 | 1 |
| E2E | 1 | 1 |
| Frontend | 4 | 1 |
| Shared | 4 | 1 |

E2E runs single-threaded to avoid race conditions.

**Coverage Thresholds**

All projects enforce 70% coverage minimums:

- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

Excluded from coverage:

- Test files (`*.spec.ts`, `*.test.ts`)
- `node_modules/`
- `dist/`, `build/`, `coverage/`

**Environment Detection**

- **Development**: Verbose output, default reporter
- **CI** (GitHub Actions): Verbose reporter for logs

Set via environment variable:

```bash
CI=true npx vitest run
```

##### Best Practices

**Writing Tests**

1. **File Naming**: Use `.spec.ts` or `.test.ts` suffix
2. **Globals**: No need to import `describe`, `it`, `expect` (enabled globally)
3. **Async Tests**: Use `async`/`await` syntax
4. **Mocking**: Prefer `vi.mock()` over manual mocks

**Test Organization:**

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Behavior Category', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'value';
      
      // Act
      const result = someFunction(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

**Performance Tips**

1. Use `describe.skip()` to temporarily disable test groups
2. Use `it.skip()` to skip individual tests
3. Use `it.only()` to run a single test during development
4. Keep unit tests under 5 seconds
5. Use test isolation - don't depend on test execution order

**Common Patterns**

**Mocking Modules:**

```typescript
vi.mock('@/services/api', () => ({
  fetchData: vi.fn(() => Promise.resolve([])),
}));
```

**Spying on Functions:**

```typescript
const spy = vi.spyOn(console, 'log');
expect(spy).toHaveBeenCalledWith('message');
spy.mockRestore();
```

**Testing Async Code:**

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

##### Troubleshooting

**Tests Not Discovered**

1. Check file naming: Must end with `.spec.ts`, `.test.ts`, `.spec.tsx`, or `.test.tsx`
2. Verify file location in `include` patterns in vitest.config.ts
3. Refresh: Click the 🔄 icon in Testing sidebar
4. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"

**Import Path Issues**

All projects use alias imports:

- `@/` points to `src/` or project root
- `@tests/` points to `tests/` (frontend only)

**Timeout Issues**

- Increase timeout in vitest.config.ts `testTimeout`
- Check for unresolved promises or infinite loops
- Use `it.skip()` temporarily if blocking CI

**Memory Issues**

- Reduce `maxThreads` in `poolOptions`
- Run projects individually instead of all at once
- Check for memory leaks in test setup/teardown

### Release Management

#### Release Guide

##### Quick Start

**Making a Release**

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

##### Release Commands

| Command | Description | Example |
|---------|-------------|---------|
| `npm run release` | Automatic version bump based on commits | `1.5.8` → `1.5.9` (patch) or `1.6.0` (minor) |
| `npm run release:minor` | Force minor version bump | `1.5.8` → `1.6.0` |
| `npm run release:major` | Force major version bump | `1.5.8` → `2.0.0` |
| `npm run release:alpha` | Create alpha prerelease | `1.5.8` → `1.5.9-alpha.0` |
| `npm run release:beta` | Create beta prerelease | `1.5.8` → `1.5.9-beta.0` |

##### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Commit Types**

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

**Examples:**

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

##### What Happens During Release

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

##### Workflow Example

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

##### Configuration

Configuration is in `.versionrc.json`. Key settings:

- **`types`**: Commit types and their sections in CHANGELOG
- **`packageFiles`**: Files to update version in
- **`bumpFiles`**: Files to bump version in
- **`scripts.postchangelog`**: Runs after CHANGELOG generation to sync versions

##### Troubleshooting

**Release fails with "working directory must be clean"**

**Solution:** Commit or stash all changes first

```bash
git add .
git commit -m "chore: prepare for release"
# or
git stash
```

**Wrong version bump detected**

**Solution:** Use explicit version commands

```bash
npm run release:minor  # Force minor bump
npm run release:major # Force major bump
```

**CHANGELOG not updating correctly**

**Solution:** Check commit message format. Must follow Conventional Commits.

**Version not syncing to constants.ts**

**Solution:** Check that `scripts/update-constants.js` exists and is executable

```bash
node scripts/update-constants.js
```

##### Integration with Build Process

The `build:main` script already runs `sync-version` before building:

```json
"build:main": "npm run sync-version && node scripts/build-backend-bundle.js"
```

This ensures version consistency even if you don't run a full release.

##### Best Practices

1. ✅ **Always use conventional commits** - Makes versioning automatic
2. ✅ **Review CHANGELOG.md** before pushing release
3. ✅ **Push tags with `--follow-tags`** - Ensures tags are pushed to remote
4. ✅ **Release frequently** - Smaller releases are easier to manage
5. ✅ **Use prereleases** for testing: `npm run release:alpha` or `npm run release:beta`

#### Automated Version Management

##### Current Setup

Your project currently uses:

- **Manual versioning** in `package.json` (currently `1.6.0`)
- **Custom `sync-version.js`** script to sync version across workspace packages
- **Manual `APP_VERSION`** constant in `app/shared/constants.ts`
- **CHANGELOG** file (generated by standard-version)

##### What is Automated Version Management?

Automated version management tools analyze your git commit history and automatically:

1. **Bump version numbers** based on commit message conventions (Semantic Versioning)
2. **Generate CHANGELOG** files from commit messages
3. **Create git tags** for releases
4. **Update version in multiple files** (package.json, constants, etc.)

##### Two Main Approaches

**1. `standard-version` - Simple & Manual**

**Best for:** Teams that want control over when releases happen

**How It Works:**

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

**Installation & Setup:**

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

**Configuration (`.versionrc.json`):**

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

**Integration with Your Current Setup:**

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
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run standard-version
execSync('standard-version', { stdio: 'inherit' });

// Read new version from package.json
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8')
);

// Update constants.ts
const constantsPath = resolve(__dirname, '..', 'app', 'shared', 'constants.ts');
let constants = readFileSync(constantsPath, 'utf-8');
constants = constants.replace(
  /export const APP_VERSION = "[\d.]+";/,
  `export const APP_VERSION = "${packageJson.version}";`
);
writeFileSync(constantsPath, constants);

console.log(`✓ Updated APP_VERSION to ${packageJson.version}`);
```

**Example Workflow:**

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

**Pros:**

- ✅ Simple and predictable
- ✅ Full control over release timing
- ✅ Works offline
- ✅ Easy to customize
- ✅ Can review changes before pushing

**Cons:**

- ❌ Requires manual release command
- ❌ Requires discipline to use conventional commits
- ❌ Doesn't integrate with CI/CD automatically

**2. `semantic-release` - Fully Automated**

**Best for:** Teams that want fully automated releases via CI/CD

**How It Works:**

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

**Installation & Setup:**

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
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async (pluginConfig, context) => {
  const { nextRelease } = context;
  const constantsPath = resolve(__dirname, '..', 'app', 'shared', 'constants.ts');
  
  let constants = readFileSync(constantsPath, 'utf-8');
  constants = constants.replace(
    /export const APP_VERSION = "[\d.]+";/,
    `export const APP_VERSION = "${nextRelease.version}";`
  );
  writeFileSync(constantsPath, constants);
  
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

**Example Workflow:**

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

**Pros:**

- ✅ Fully automated
- ✅ No manual release step
- ✅ Integrates with CI/CD
- ✅ Creates GitHub releases automatically
- ✅ Prevents human error

**Cons:**

- ❌ Requires CI/CD setup
- ❌ Less control over release timing
- ❌ More complex configuration
- ❌ Requires discipline with commit messages

##### Comparison Table

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

##### Recommended Approach for Your Project

**Phase 1: Start with `standard-version`**

Given your current setup, I recommend starting with `standard-version` because:

1. **You already have version sync logic** - easy to integrate
2. **Electron apps** benefit from controlled release timing
3. **No CI/CD dependency** - works immediately
4. **Easy to migrate** to `semantic-release` later if needed

**Implementation Steps:**

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
   import { readFileSync, writeFileSync } from 'fs';
   import { resolve, dirname } from 'path';
   import { fileURLToPath } from 'url';
   
   const __dirname = dirname(fileURLToPath(import.meta.url));
   
   const packageJson = JSON.parse(
     readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8')
   );
   
   const constantsPath = resolve(__dirname, '..', 'app', 'shared', 'constants.ts');
   let constants = readFileSync(constantsPath, 'utf-8');
   
   constants = constants.replace(
     /export const APP_VERSION = "[\d.]+";/,
     `export const APP_VERSION = "${packageJson.version}";`
   );
   
   writeFileSync(constantsPath, constants);
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

**Phase 2: Consider `semantic-release` Later**

If you:

- Set up CI/CD
- Want fully automated releases
- Release frequently
- Want automatic GitHub releases

Then migrate to `semantic-release`.

##### Conventional Commits Format

Both tools use the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**

- **`feat`**: New feature (minor version bump)
- **`fix`**: Bug fix (patch version bump)
- **`perf`**: Performance improvement (patch version bump)
- **`refactor`**: Code refactoring (no version bump by default)
- **`docs`**: Documentation changes (no version bump)
- **`style`**: Formatting changes (no version bump)
- **`test`**: Test changes (no version bump)
- **`chore`**: Maintenance tasks (no version bump)
- **`BREAKING CHANGE`**: Major version bump

**Examples:**

```bash
# Patch release (1.5.8 → 1.5.9)
git commit -m "fix: resolve memory leak in timesheet processing"

# Minor release (1.5.8 → 1.6.0)
git commit -m "feat: add dark mode support"

# Major release (1.5.8 → 2.0.0)
git commit -m "feat: redesign API

BREAKING CHANGE: API endpoints have changed from /v1 to /v2"
```

##### Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [standard-version Documentation](https://github.com/conventional-changelog/standard-version)
- [semantic-release Documentation](https://semantic-release.gitbook.io/)
- [Semantic Versioning](https://semver.org/)

### Security Architecture

#### Security Model

This section describes the security architecture and decisions for Sheetpilot.

##### Security Architecture

**Renderer Process Security**

Sheetpilot follows Electron security best practices:

- **Context Isolation**: Enabled - isolates renderer JavaScript from Node.js APIs
- **Node Integration**: Disabled - prevents direct access to Node.js from renderer
- **Sandbox**: Enabled - provides additional isolation for the renderer process
- **Web Security**: Enabled - enforces same-origin policy and other web security features

**Custom Protocol Handler**

Sheetpilot uses a custom protocol handler (`sheetpilot://`) instead of the `file://` protocol. This allows:

1. **Sandbox Compatibility**: The sandbox can remain enabled while loading local files
2. **Path Validation**: All file paths are validated and sanitized to prevent directory traversal attacks
3. **Controlled Access**: Only files within the application's resource directory can be accessed

The protocol handler is registered before the app is ready and validates all paths to ensure they are within the allowed application directory.

**Content Security Policy (CSP)**

The application uses Content Security Policy to prevent XSS attacks:

- **Production**: Strict CSP with custom protocol support
- **Development**: More permissive CSP to allow Vite HMR (Hot Module Replacement)

**Note**: The current CSP includes `'unsafe-inline'` for scripts and styles. This is a known limitation and should be addressed in future versions using nonces or hashes.

**IPC Communication**

All communication between the renderer and main process uses Electron's IPC (Inter-Process Communication) with:

- **Context Bridge**: Secure API exposure via `contextBridge.exposeInMainWorld()`
- **Input Validation**: All IPC handlers validate and sanitize inputs
- **Error Handling**: Comprehensive error handling prevents information leakage

##### Code Signing

**Windows**

Windows builds support code signing to prevent "Unknown Publisher" warnings. To enable:

1. Obtain a code signing certificate (.p12 or .pfx file)
2. Set environment variables:
   - `CSC_LINK`: Path to certificate file
   - `CSC_KEY_PASSWORD`: Certificate password
3. Build will automatically sign the executable

If certificates are not available, the build will continue without signing.

**macOS**

macOS builds support notarization for distribution outside the App Store. To enable:

1. Set environment variables:
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_ID_PASSWORD`: App-specific password
   - `APPLE_TEAM_ID`: Your Apple Developer Team ID
2. Build will automatically notarize the application

If credentials are not available, the build will continue without notarization.

##### Dependencies

**Large Dependencies**

**Playwright**: Playwright and Chromium (~200MB+) are bundled for browser automation functionality. This is intentional and required for the timesheet submission bot feature.

**Native Modules**

**better-sqlite3**: Native SQLite bindings are rebuilt for Electron using `@electron/rebuild` to ensure compatibility with Electron's Node.js version.

##### Security Considerations

**Known Limitations**

1. **CSP unsafe-inline**: The current CSP allows inline scripts and styles. This should be replaced with nonces or hashes in a future version.

2. **Development Mode**: Development mode uses more permissive security settings to enable hot reloading. Never use development builds in production.

**Best Practices**

1. **Keep Dependencies Updated**: Regularly update Electron and all dependencies to receive security patches
2. **Validate All Inputs**: All user inputs and IPC messages are validated
3. **Principle of Least Privilege**: The application only requests necessary permissions
4. **Secure Storage**: Credentials are encrypted before storage
5. **Error Handling**: Errors are logged but sensitive information is not exposed to users

##### Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not open a public issue
2. Contact the maintainer directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

##### References

- [Electron Security Guidelines](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Electron Security](https://owasp.org/www-community/vulnerabilities/Electron_Security)

### Script Consolidation

#### Summary

Consolidated scripts from **51** to **45** by:

- Removed duplicate `lint:fix` (identical to `lint`)
- Removed redundant `electron:compiled` (use `electron:dev` with rebuild if needed)
- Removed `dev:smoke` (just prints instructions, not useful as script)
- Consolidated validation scripts into `validate` and `validate:full`
- Consolidated test quality scripts into single `test:quality`
- Added convenience aliases `quality` and `deps` for common operations

#### Alternative Plugins That Could Replace Scripts

**Task Orchestration & Parallel Execution**

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

**Type Checking**

**Current:** Multiple `type-check:*` scripts chained with `&&`

**Alternatives:**

- **`turbo`** - Can run type-check across all workspaces in parallel
- **`tsc-files`** - Type-check specific files instead of projects
- **`tsc-multi`** - Run multiple TypeScript compilations in parallel
- **Keep current approach** - Simple and works well

**Linting**

**Current:** Direct `eslint` call

**Alternatives:**

- **`lint-staged`** - Run linters on git staged files
  - Use with: `husky` for pre-commit hooks
  - Benefits: Faster feedback, only lint changed files

- **`eslint-config-prettier`** + **`prettier`** - Separate formatting from linting
  - Benefits: Better formatting control, faster formatting

**File Cleanup**

**Current:** `rimraf` for cross-platform `rm -rf`

**Alternatives:**

- **`del-cli`** - Simpler cross-platform delete
- **Native Node.js `fs.rmSync`** (Node 14.14+) - No dependency needed
- **Keep `rimraf`** - Most reliable, widely used

**Environment Variables**

**Current:** `cross-env` for cross-platform env vars

**Alternatives:**

- **`env-cmd`** - Load from `.env` files
  - Benefits: Centralized env config, supports multiple env files
- **`dotenv-cli`** - Simple `.env` file loader
- **Keep `cross-env`** - Simple and works for current use case

**Version Management**

**Current:** Custom `sync-version.js` script

**Alternatives:**

- **`standard-version`** - Automated versioning and CHANGELOG
  - Benefits: Semantic versioning, auto CHANGELOG generation
- **`semantic-release`** - Fully automated version management
  - Benefits: CI/CD integration, automatic releases
- **`bump`** - Simple version bumping
- **Keep current** - Custom logic may be needed

**Build Tools**

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

**Dependency Management**

**Current:** Custom `dependency-reporter.js` with multiple flags

**Alternatives:**

- **`npm-check-updates`** (already in deps) - Update package.json
- **`depcheck`** (already in deps) - Find unused dependencies
- **`npm-audit-resolver`** (already in deps) - Resolve audit issues
- **`license-checker`** (already in deps) - Check licenses
- **`snyk`** - Security scanning
- **`dependabot`** / **`renovate`** - Automated dependency updates
- **Keep current** - Custom reporter provides unified interface

**Code Quality Metrics**

**Current:** Custom quality metric scripts

**Alternatives:**

- **`sonarjs`** - SonarQube rules for ESLint
- **`eslint-plugin-sonarjs`** - SonarJS rules
- **`codeclimate`** - Automated code review
- **`codacy`** - Code quality analysis
- **Keep current** - Custom metrics may be project-specific

**Testing**

**Current:** Using `vitest` (already good choice)

**Alternatives:**

- **`jest`** - More mature, larger ecosystem
- **`mocha`** + **`chai`** - Flexible, modular
- **Keep `vitest`** - Fast, Vite-native, good TypeScript support

**Git Hooks**

**Current:** No git hooks configured

**Recommended Addition:**

- **`husky`** - Git hooks made easy
  - Use with: `lint-staged` for pre-commit linting
  - Benefits: Enforce code quality before commits
  - Example: Pre-commit hook runs `lint` and `type-check`

**Watch Mode**

**Current:** `nodemon` for backend, Vite for frontend

**Alternatives:**

- **`nodemon`** (current) - Good for Node.js
- **`chokidar-cli`** - More flexible file watching
- **`watchman`** - Facebook's file watching service
- **Keep current** - Works well for current setup

**Wait/Health Checks**

**Current:** `wait-on` for waiting on ports/files

**Alternatives:**

- **`start-server-and-test`** - Start server, wait, run tests
  - Benefits: Combines wait + test execution
- **`http-server`** + custom script
- **Keep `wait-on`** - Simple and reliable

#### Recommended Immediate Changes

**High Priority**

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

**Medium Priority**

3. **Consider `tsup`** for backend builds
   - Faster TypeScript builds
   - Less custom build script maintenance

4. **Add `standard-version`** for version management
   - Automated CHANGELOG generation
   - Semantic versioning support

**Low Priority**

5. **Consider `turbo`** if monorepo grows
   - Only if project scales significantly
   - Adds complexity but provides caching benefits

#### Scripts That Should Stay Custom

- **`sync-version.js`** - May have project-specific logic
- **`generate-icon.js`** - Likely project-specific
- **`reset-dev-database.js`** - Project-specific database logic
- **Quality metric scripts** - Custom metrics for project needs
- **Validation scripts** - Project-specific validation logic

#### Summary of Consolidations Made

| Before | After | Reason |
|--------|-------|--------|
| `lint` + `lint:fix` | `lint` | Identical commands |
| `electron:compiled` | Removed | Redundant with `electron:dev` |
| `dev:smoke` | Removed | Just prints instructions |
| `validate:compile` + `validate:bundle` + `validate:deps` + `validate:packaged-deps` | `validate` + `validate:full` | Consolidated into two clear commands |
| `test:quality:organization` + `test:quality:analyze` | `test:quality` | Combined into single command |
| N/A | `quality` + `deps` | Added convenience aliases |

**Result:** 51 scripts → 45 scripts (12% reduction)

### Architecture Diagrams

This section contains Mermaid diagrams describing the SheetPilot architecture. For detailed architecture documentation, see the XML files:

- [app-architecture-dataflow.xml](./app-architecture-dataflow.xml)
- [app-architecture-hierarchical.xml](./app-architecture-hierarchical.xml)

#### Complete System Architecture

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[React Frontend<br/>Vite + TypeScript]
        UI --> Components[Components<br/>- TimesheetGrid<br/>- DatabaseViewer<br/>- Settings<br/>- AdminPanel]
        UI --> Hooks[Custom Hooks<br/>- useTimesheet<br/>- useAuth<br/>- useSettings]
        UI --> Context[React Contexts<br/>- AuthContext<br/>- SettingsContext]
    end

    subgraph "Electron Main Process"
        Main[main.ts<br/>Application Entry Point]
        Main --> Bootstrap[Bootstrap Layer]
        Bootstrap --> EnvFlags[Environment Flags]
        Bootstrap --> Logging[Logging System]
        Bootstrap --> Database[Database Bootstrap]
        Bootstrap --> IPCSetup[IPC Setup]
        Bootstrap --> WindowMgmt[Window Management]
        
        Main --> IPCHandlers[IPC Handler Registry]
        IPCHandlers --> AuthIPC[Auth Handlers<br/>- Login<br/>- Session<br/>- Logout]
        IPCHandlers --> TimesheetIPC[Timesheet Handlers<br/>- Submit<br/>- Draft<br/>- Export<br/>- Reset]
        IPCHandlers --> CredsIPC[Credentials Handlers<br/>- Store<br/>- Get<br/>- Delete]
        IPCHandlers --> AdminIPC[Admin Handlers<br/>- Clear Data<br/>- Rebuild DB]
        IPCHandlers --> DatabaseIPC[Database Viewer<br/>Handlers]
        IPCHandlers --> LogsIPC[Logs Handlers]
        IPCHandlers --> SettingsIPC[Settings Handlers]
        IPCHandlers --> LoggerIPC[Logger Bridge<br/>Renderer → Main]
    end

    subgraph "Plugin Architecture"
        PluginRegistry[Plugin Registry]
        PluginRegistry --> DataPlugin[IDataService<br/>SQLite Implementation]
        PluginRegistry --> CredPlugin[ICredentialService<br/>SQLite Implementation]
        PluginRegistry --> SubmitPlugin[ISubmissionService<br/>Playwright/Electron Bot]
        
        DataPlugin --> DataOps[Data Operations<br/>- Insert<br/>- Query<br/>- Update<br/>- Delete]
        CredPlugin --> CredOps[Credential Ops<br/>- Encrypt<br/>- Decrypt<br/>- Store<br/>- Retrieve]
        SubmitPlugin --> BotOps[Submission Ops<br/>- Validate<br/>- Submit<br/>- Progress]
    end

    subgraph "Data Layer - SQLite Database"
        DB[(SQLite Database<br/>sheetpilot.sqlite)]
        
        DB --> TimesheetTable[Timesheet Table<br/>- id, date, time_in/out<br/>- project, tool<br/>- task_description<br/>- status, submitted_at]
        
        DB --> CredentialsTable[Credentials Table<br/>- service<br/>- email<br/>- encrypted_password<br/>- created_at]
        
        DB --> SessionsTable[Sessions Table<br/>- session_token<br/>- email, is_admin<br/>- expires_at]
        
        DB --> SchemaInfo[Schema Info<br/>- version<br/>- updated_at<br/>Singleton Pattern]
    end

    subgraph "Repository Layer"
        Repos[Repository Manager]
        Repos --> ConnMgr[Connection Manager<br/>- Singleton Pattern<br/>- WAL Mode<br/>- Health Checks]
        Repos --> TimesheetRepo[Timesheet Repository<br/>- CRUD Operations<br/>- Duplicate Check<br/>- Status Management]
        Repos --> CredsRepo[Credentials Repository<br/>- Encryption/Decryption<br/>- Master Key Management]
        Repos --> SessionRepo[Session Repository<br/>- Create/Validate<br/>- Expiration Management]
        Repos --> Migrations[Migration System<br/>- Version Tracking<br/>- Auto-Backup<br/>- Schema Evolution]
    end

    subgraph "Automation Layer - Bot System"
        BotOrch[BotOrchestrator<br/>Main Workflow Controller]
        
        BotOrch --> BrowserLauncher[BrowserLauncher<br/>Playwright/Electron<br/>Browser Management]
        
        BotOrch --> SessionMgr[WebformSessionManager<br/>- Context Management<br/>- Page Management<br/>- Navigation]
        
        BotOrch --> FormInteract[FormInteractor<br/>- Field Detection<br/>- Dropdown Handling<br/>- Smart Typing]
        
        BotOrch --> LoginMgr[LoginManager<br/>- Authentication Flow<br/>- Login Steps<br/>- Session Setup]
        
        BotOrch --> SubmitMonitor[SubmissionMonitor<br/>- Form Submission<br/>- Success Detection<br/>- Error Handling]
        
        BotOrch --> QuarterConfig[Quarter Configuration<br/>- Date-to-Form Mapping<br/>- Multi-Quarter Support]
    end

    subgraph "Business Logic Layer"
        Logic[Business Logic Services]
        
        Logic --> SubmitWorkflow[Submission Workflow<br/>- Entry Validation<br/>- Quarter Processing<br/>- Progress Tracking<br/>- Status Updates]
        
        Logic --> ValidationSvc[Validation Service<br/>- Input Schemas (Zod)<br/>- IPC Validation<br/>- Business Rules]
        
        Logic --> ImporterSvc[Timesheet Importer<br/>- Data Transformation<br/>- Bot Orchestration<br/>- Result Processing]
    end

    subgraph "Shared Layer"
        Shared[Shared Module]
        Shared --> Contracts[Contracts/Interfaces<br/>- IDataService<br/>- ICredentialService<br/>- ISubmissionService<br/>- IPlugin]
        Shared --> Constants[Constants<br/>- App Version<br/>- Settings<br/>- Business Config]
        Shared --> Utils[Utilities<br/>- Format Conversions<br/>- Date Utils<br/>- Time Utils]
        Shared --> Errors[Error Hierarchy<br/>- AppError Base<br/>- Category-based<br/>- User-friendly Messages]
        Shared --> Logger[Logger System<br/>- App Logger<br/>- Bot Logger<br/>- DB Logger<br/>- IPC Logger]
    end

    subgraph "External Systems"
        Smartsheet[Smartsheet Web Forms<br/>Multiple Quarters]
        AutoUpdater[Auto-Update System<br/>GitHub Releases]
        FileSystem[File System<br/>- Logs<br/>- Database<br/>- Cache]
    end

    %% Main flow connections
    UI -.IPC.-> IPCHandlers
    IPCHandlers --> PluginRegistry
    IPCHandlers --> Logic
    IPCHandlers --> Repos
    
    Logic --> PluginRegistry
    Logic --> Repos
    
    PluginRegistry --> Repos
    Repos --> DB
    
    BotOrch --> Smartsheet
    SubmitPlugin --> BotOrch
    ImporterSvc --> SubmitPlugin
    
    Main --> AutoUpdater
    Logging --> FileSystem
    DB -.Stored on.-> FileSystem
    
    %% Shared dependencies
    UI --> Shared
    Main --> Shared
    Logic --> Shared
    Repos --> Shared
    BotOrch --> Shared
    PluginRegistry --> Shared
```

#### Key Technologies & Patterns

**Frontend Stack:**

- React 18 - UI framework
- TypeScript - Type safety
- Vite - Build tool & dev server
- Material-UI (M3) - Component library
- Handsontable - Spreadsheet grid
- React Context - State management

**Backend Stack:**

- Electron - Desktop framework
- Node.js - Runtime
- TypeScript - Type safety
- Better-SQLite3 - Database
- Playwright - Browser automation
- IPC - Inter-process communication

**Architecture Patterns:**

1. **Plugin Architecture** - Extensible services
2. **Repository Pattern** - Data access abstraction
3. **Singleton Pattern** - Database connection
4. **Observer Pattern** - IPC event system
5. **Factory Pattern** - Plugin instantiation
6. **Facade Pattern** - Simplified APIs
7. **Strategy Pattern** - Multiple submission methods

**Security Features:**

- Encryption at rest - Credentials encrypted
- Session management - Token-based auth
- Input validation - Zod schemas
- Trusted sender checks - IPC security
- Master key - Machine-specific or env-based
- No plaintext passwords - Always encrypted

**Performance Optimizations:**

- WAL mode - Concurrent DB access
- Connection pooling - Single connection
- Lazy loading - On-demand modules
- Debounced saves - Reduced DB writes
- Progress streaming - Real-time updates
- Background processing - Non-blocking operations

---

## Architecture References

For detailed architecture documentation, see the XML files:

- **[app-architecture-dataflow.xml](./app-architecture-dataflow.xml)** - Data flow architecture diagrams
- **[app-architecture-hierarchical.xml](./app-architecture-hierarchical.xml)** - Hierarchical architecture diagrams

---

**Maintained by**: Development Team  
**Last Updated**: November 12, 2025  
**Version**: 1.6.0
