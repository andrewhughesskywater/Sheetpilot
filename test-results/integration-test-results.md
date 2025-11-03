# Test Results

Generated at: 2025-11-03T20:24:06.875Z

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 211 |
| Passed | 158 |
| Failed | 52 |
| Skipped | 1 |
| Duration | 1.90s |

**Pass Rate:** 74.88%

## Test Results by File

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/auto-updater.spec.ts

#### Auto-Updater Module

| Test | Status | Duration |
|------|--------|----------|
| should have required methods for update management | ✅ passed | 0.00s |

#### Auto-Updater Configuration (Integration)

| Test | Status | Duration |
|------|--------|----------|
| configures manual download with UI control | ✅ passed | 0.00s |
| should only check for updates in production mode | ✅ passed | 0.00s |

#### Update Event Flow

| Test | Status | Duration |
|------|--------|----------|
| should send IPC event and download update when available | ✅ passed | 0.00s |
| should handle null update info gracefully | ✅ passed | 0.00s |
| should send IPC event and log download progress | ✅ passed | 0.00s |
| should send IPC event when update is downloaded and wait before installing | ✅ passed | 0.00s |

#### Error Handling

| Test | Status | Duration |
|------|--------|----------|
| should handle update check errors gracefully | ✅ passed | 0.00s |
| should handle errors with missing stack trace | ✅ passed | 0.00s |

#### Update Strategy

| Test | Status | Duration |
|------|--------|----------|
| uses manual download trigger for better control | ✅ passed | 0.00s |
| sends IPC events for UI interaction | ✅ passed | 0.00s |
| should check version before downloading | ✅ passed | 0.00s |

#### Network Drive Configuration

| Test | Status | Duration |
|------|--------|----------|
| should support file:// protocol for network paths | ✅ passed | 0.00s |
| should use generic provider for network drive | ✅ passed | 0.00s |

#### Update File Structure

| Test | Status | Duration |
|------|--------|----------|
| should expect latest.yml for version metadata | ✅ passed | 0.00s |
| should parse version from update info | ✅ passed | 0.00s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts

#### Database Module > Database Path Management

| Test | Status | Duration |
|------|--------|----------|
| should set and get database path correctly | ❌ failed | 0.23s |
| should resolve relative paths to absolute paths | ❌ failed | 0.02s |
| should create database directory if it does not exist | ❌ failed | 0.03s |

#### Database Module > Database Connection

| Test | Status | Duration |
|------|--------|----------|
| should open database connection successfully | ❌ failed | 0.02s |
| should create database file if it does not exist | ❌ failed | 0.02s |

#### Database Module > Schema Management

| Test | Status | Duration |
|------|--------|----------|
| should create timesheet table with correct schema | ❌ failed | 0.02s |
| should create required indexes | ❌ failed | 0.03s |
| should create unique constraint for deduplication | ❌ failed | 0.02s |

#### Database Module > Timesheet Entry Insertion

| Test | Status | Duration |
|------|--------|----------|
| should insert a new timesheet entry successfully | ❌ failed | 0.02s |
| should calculate hours automatically | ❌ failed | 0.02s |
| should handle optional fields correctly | ❌ failed | 0.02s |
| should validate time constraints | ❌ failed | 0.02s |

#### Database Module > Deduplication Functionality

| Test | Status | Duration |
|------|--------|----------|
| should prevent duplicate entries based on unique constraint | ❌ failed | 0.02s |
| should allow entries with different time_in | ❌ failed | 0.03s |
| should allow entries with different project | ❌ failed | 0.02s |
| should allow entries with different task description | ❌ failed | 0.03s |
| should allow entries with different date | ❌ failed | 0.02s |
| should allow entries with different optional fields | ❌ failed | 0.04s |

#### Database Module > Duplicate Checking Utilities

| Test | Status | Duration |
|------|--------|----------|
| should correctly identify non-duplicate entries | ❌ failed | 0.02s |
| should correctly identify duplicate entries | ❌ failed | 0.02s |
| should find duplicate entries in database | ❌ failed | 0.02s |
| should filter duplicates by date range | ❌ failed | 0.02s |

#### Database Module > Batch Insertion

| Test | Status | Duration |
|------|--------|----------|
| should insert multiple entries successfully | ❌ failed | 0.02s |
| should handle mixed duplicates in batch insertion | ❌ failed | 0.02s |
| should handle empty batch | ❌ failed | 0.02s |
| should use transaction for atomicity | ❌ failed | 0.02s |

#### Database Module > Edge Cases and Error Handling

| Test | Status | Duration |
|------|--------|----------|
| should handle database connection errors gracefully | ❌ failed | 0.02s |
| should handle malformed entry data | ❌ failed | 0.02s |
| should handle null and undefined values in optional fields | ❌ failed | 0.02s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/deprecated-constants.spec.ts

#### Deprecated Constants > Deprecated constant values

| Test | Status | Duration |
|------|--------|----------|
| should have BASE_URL set to deprecated placeholder | ✅ passed | 0.00s |
| should have FORM_ID set to deprecated placeholder | ✅ passed | 0.00s |
| should have SUBMISSION_ENDPOINT include deprecated placeholder | ✅ passed | 0.00s |
| should have SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS include deprecated placeholder | ✅ passed | 0.00s |

#### Deprecated Constants > createFormConfig function

| Test | Status | Duration |
|------|--------|----------|
| should create valid config with custom URL and ID | ✅ passed | 0.00s |
| should generate correct SUBMISSION_ENDPOINT | ✅ passed | 0.00s |
| should generate correct URL patterns | ✅ passed | 0.00s |
| should create unique configs for different form IDs | ✅ passed | 0.00s |
| should work with Q3 quarter definition | ✅ passed | 0.00s |
| should work with Q4 quarter definition | ✅ passed | 0.00s |
| should generate correct patterns for Q3 form | ✅ passed | 0.00s |
| should generate correct patterns for Q4 form | ✅ passed | 0.00s |

#### Deprecated Constants > Deprecation warnings in code comments

| Test | Status | Duration |
|------|--------|----------|
| should indicate that deprecated constants should not be used | ✅ passed | 0.00s |
| should provide createFormConfig as replacement | ✅ passed | 0.00s |
| should use createFormConfig to create valid configurations | ✅ passed | 0.00s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-handlers-comprehensive.spec.ts

#### IPC Handlers Comprehensive Tests > ping handler

| Test | Status | Duration |
|------|--------|----------|
| should return pong with message | ✅ passed | 0.01s |
| should handle empty message | ✅ passed | 0.00s |
| should handle undefined message | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > credentials:store handler

| Test | Status | Duration |
|------|--------|----------|
| should store credentials successfully | ✅ passed | 0.00s |
| should handle storage failure | ✅ passed | 0.00s |
| should handle invalid parameters | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > credentials:get handler

| Test | Status | Duration |
|------|--------|----------|
| should retrieve credentials successfully | ✅ passed | 0.00s |
| should handle missing credentials | ✅ passed | 0.00s |
| should handle invalid service parameter | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > credentials:list handler

| Test | Status | Duration |
|------|--------|----------|
| should list all credentials | ✅ passed | 0.00s |
| should handle empty credentials list | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > credentials:delete handler

| Test | Status | Duration |
|------|--------|----------|
| should delete credentials successfully | ✅ passed | 0.00s |
| should handle deletion failure | ✅ passed | 0.01s |
| should handle invalid service parameter | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > database:getAllTimesheetEntries handler

| Test | Status | Duration |
|------|--------|----------|
| should retrieve all timesheet entries | ✅ passed | 0.00s |
| should handle empty entries list | ✅ passed | 0.00s |
| should handle database errors | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > database:getAllCredentials handler

| Test | Status | Duration |
|------|--------|----------|
| should retrieve all credentials | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > timesheet:exportToCSV handler

| Test | Status | Duration |
|------|--------|----------|
| should export timesheet data to CSV | ✅ passed | 0.00s |
| should handle empty data export | ✅ passed | 0.00s |
| should handle export errors | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > database:clearDatabase handler

| Test | Status | Duration |
|------|--------|----------|
| should clear all database tables | ✅ passed | 0.00s |
| should handle clear database errors | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > timesheet:saveDraft handler

| Test | Status | Duration |
|------|--------|----------|
| should save valid draft data | ✅ passed | 0.00s |
| should validate required fields | ✅ passed | 0.00s |
| should validate time format | ✅ passed | 0.00s |
| should allow dates from any quarter (validation happens at submission) | ✅ passed | 0.00s |
| should handle duplicate entries | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > timesheet:loadDraft handler

| Test | Status | Duration |
|------|--------|----------|
| should load pending timesheet entries | ✅ passed | 0.00s |
| should handle empty draft data | ✅ passed | 0.00s |
| should handle load errors | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > timesheet:deleteDraft handler

| Test | Status | Duration |
|------|--------|----------|
| should delete valid draft entry | ✅ passed | 0.01s |
| should validate ID parameter | ✅ passed | 0.00s |
| should handle non-existent entry | ✅ passed | 0.00s |
| should handle database errors | ✅ passed | 0.00s |
| should only delete draft entries (status IS NULL) | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > timesheet:submit handler

| Test | Status | Duration |
|------|--------|----------|
| should submit timesheets with valid credentials | ✅ passed | 0.01s |
| should handle missing credentials | ✅ passed | 0.00s |
| should handle submission failures | ✅ passed | 0.00s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-main.spec.ts

#### Electron IPC Handlers (main.ts)

| Test | Status | Duration |
|------|--------|----------|
| timesheet:submit returns error if credentials missing | ✅ passed | 0.00s |
| timesheet:submit submits with stored credentials | ✅ passed | 0.00s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-workflow-integration.spec.ts

#### IPC Workflow Integration

| Test | Status | Duration |
|------|--------|----------|
| should handle workflow when database has pending entries | ❌ failed | 0.14s |
| should handle workflow when database is empty | ❌ failed | 0.02s |
| should not mutate database entries during failed submission | ❌ failed | 0.02s |
| should handle multiple pending entries with different projects | ❌ failed | 0.02s |
| should maintain data integrity across automation attempts | ❌ failed | 0.02s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/main-application-logic.spec.ts

#### Main Application Logic Tests > Time Parsing Utilities > parseTimeToMinutes

| Test | Status | Duration |
|------|--------|----------|
| should parse valid time strings correctly | ✅ passed | 0.00s |
| should handle single digit hours and minutes | ✅ passed | 0.00s |
| should throw error for invalid format | ✅ passed | 0.00s |
| should throw error for non-numeric values | ✅ passed | 0.00s |
| should handle out-of-range values | ✅ passed | 0.00s |

#### Main Application Logic Tests > Time Parsing Utilities > formatMinutesToTime

| Test | Status | Duration |
|------|--------|----------|
| should format minutes to time strings correctly | ✅ passed | 0.00s |
| should handle edge cases | ✅ passed | 0.00s |
| should handle large minute values | ✅ passed | 0.00s |

#### Main Application Logic Tests > Time Parsing Utilities > Time parsing round-trip conversion

| Test | Status | Duration |
|------|--------|----------|
| should maintain consistency in round-trip conversion | ✅ passed | 0.00s |

#### Main Application Logic Tests > Quarter Validation

| Test | Status | Duration |
|------|--------|----------|
| should validate dates in current quarter | ✅ passed | 0.00s |
| should reject dates in different quarters | ✅ passed | 0.00s |
| should reject dates in different years | ✅ passed | 0.00s |
| should handle edge cases for quarter boundaries | ✅ passed | 0.00s |
| should handle invalid date strings | ✅ passed | 0.00s |

#### Main Application Logic Tests > Window State Management

| Test | Status | Duration |
|------|--------|----------|
| should return default window state when no saved state exists | ✅ passed | 0.00s |
| should load valid saved window state | ✅ passed | 0.00s |
| should constrain window size to screen bounds | ✅ passed | 0.00s |
| should constrain window position to screen bounds | ✅ passed | 0.00s |
| should handle corrupted saved state gracefully | ✅ passed | 0.01s |
| should save window state successfully | ✅ passed | 0.00s |
| should handle save errors gracefully | ✅ passed | 0.01s |

#### Main Application Logic Tests > Auto-Updater Configuration

| Test | Status | Duration |
|------|--------|----------|
| should configure auto-updater correctly | ✅ passed | 0.00s |
| should only check for updates in production mode | ✅ passed | 0.00s |

#### Main Application Logic Tests > Error Handling and Edge Cases

| Test | Status | Duration |
|------|--------|----------|
| should handle invalid time parsing gracefully | ✅ passed | 0.00s |
| should handle invalid date parsing gracefully | ✅ passed | 0.00s |

#### Main Application Logic Tests > Draft Deletion Logic

| Test | Status | Duration |
|------|--------|----------|
| should validate ID parameter for draft deletion | ✅ passed | 0.00s |
| should construct correct SQL for draft deletion | ✅ passed | 0.00s |
| should handle deletion result validation | ✅ passed | 0.00s |
| should format deletion error messages correctly | ✅ passed | 0.00s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/quarter-config.spec.ts

#### Quarter Configuration > Quarter Definitions

| Test | Status | Duration |
|------|--------|----------|
| should have Q1, Q2, Q3 and Q4 2025 defined | ✅ passed | 0.00s |
| should have correct date ranges | ✅ passed | 0.00s |
| should have different form URLs and IDs | ✅ passed | 0.00s |

#### Quarter Configuration > getQuarterForDate

| Test | Status | Duration |
|------|--------|----------|
| should return Q3 for July dates | ✅ passed | 0.00s |
| should return Q3 for August dates | ✅ passed | 0.00s |
| should return Q3 for September dates | ✅ passed | 0.00s |
| should return Q4 for October dates | ✅ passed | 0.00s |
| should return Q4 for November dates | ✅ passed | 0.00s |
| should return Q4 for December dates | ✅ passed | 0.00s |
| should return null for dates outside quarters | ✅ passed | 0.00s |
| should handle edge dates correctly | ✅ passed | 0.00s |
| should return null for invalid dates | ✅ passed | 0.00s |

#### Quarter Configuration > validateQuarterAvailability

| Test | Status | Duration |
|------|--------|----------|
| should return null for valid Q3 dates | ✅ passed | 0.00s |
| should return null for valid Q4 dates | ✅ passed | 0.00s |
| should return error message for invalid dates | ✅ passed | 0.00s |
| should return error for empty date | ✅ passed | 0.00s |

#### Quarter Configuration > groupEntriesByQuarter

| Test | Status | Duration |
|------|--------|----------|
| should group entries by quarter correctly | ✅ passed | 0.00s |
| should handle empty entries array | ✅ passed | 0.00s |
| should skip entries with invalid dates | ✅ passed | 0.00s |

#### Quarter Configuration > Utility Functions

| Test | Status | Duration |
|------|--------|----------|
| should return available quarter IDs | ✅ passed | 0.00s |
| should get quarter by ID | ✅ passed | 0.00s |
| should get current quarter based on today | ✅ passed | 0.00s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/quarter-routing-integration.spec.ts

#### Quarter Routing Integration > BotOrchestrator with formConfig

| Test | Status | Duration |
|------|--------|----------|
| should require formConfig parameter (no longer optional) | ✅ passed | 0.00s |
| should throw error if formConfig is missing | ✅ passed | 0.00s |
| should accept valid formConfig for Q3 | ✅ passed | 0.00s |
| should accept valid formConfig for Q4 | ✅ passed | 0.00s |
| should pass formConfig to WebformFiller | ✅ passed | 0.00s |

#### Quarter Routing Integration > LoginManager uses dynamic formConfig

| Test | Status | Duration |
|------|--------|----------|
| should create LoginManager with formConfig from WebformFiller | ✅ passed | 0.00s |
| should navigate to correct Q3 form URL | ✅ passed | 0.00s |
| should navigate to correct Q4 form URL | ✅ passed | 0.00s |

#### Quarter Routing Integration > createFormConfig function

| Test | Status | Duration |
|------|--------|----------|
| should create valid config with custom URL and ID | ✅ passed | 0.00s |
| should generate correct SUBMISSION_ENDPOINT | ✅ passed | 0.00s |
| should generate correct URL patterns | ✅ passed | 0.00s |

#### Quarter Routing Integration > Quarter validation in BotOrchestrator

| Test | Status | Duration |
|------|--------|----------|
| should validate that Q3 dates use Q3 form config | ✅ passed | 0.00s |
| should validate that Q4 dates use Q4 form config | ✅ passed | 0.00s |
| should detect mismatch between Q3 date and Q4 form config | ✅ passed | 0.00s |
| should detect mismatch between Q4 date and Q3 form config | ✅ passed | 0.00s |

#### Quarter Routing Integration > Deprecated constants validation

| Test | Status | Duration |
|------|--------|----------|
| should have BASE_URL set to deprecated placeholder | ✅ passed | 0.00s |
| should have FORM_ID set to deprecated placeholder | ✅ passed | 0.00s |
| should have SUBMISSION_ENDPOINT include deprecated placeholder | ✅ passed | 0.00s |
| should have SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS include deprecated placeholder | ✅ passed | 0.00s |

#### Quarter Routing Integration > Date format handling

| Test | Status | Duration |
|------|--------|----------|
| should support date format conversion from mm/dd/yyyy to yyyy-mm-dd | ✅ passed | 0.00s |
| should pad single-digit months and days | ✅ passed | 0.00s |

#### Quarter Routing Integration > Quarter routing in timesheet submission

| Test | Status | Duration |
|------|--------|----------|
| should create separate form configs for Q3 and Q4 | ✅ passed | 0.00s |
| should use correct form URL for Q3 entries | ✅ passed | 0.00s |
| should use correct form URL for Q4 entries | ✅ passed | 0.00s |
| should generate correct submission endpoints for each quarter | ✅ passed | 0.00s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts

#### Timesheet Submission Integration

| Test | Status | Duration |
|------|--------|----------|
| should fetch pending entries correctly | ❌ failed | 0.09s |
| should mark entries as submitted correctly | ❌ failed | 0.02s |
| should remove failed entries correctly | ❌ failed | 0.01s |
| should handle empty pending entries gracefully | ❌ failed | 0.02s |
| should convert database rows to bot format correctly | ❌ failed | 0.02s |
| should initialize and cleanup browser when submitting timesheets | ❌ failed | 0.03s |
| should properly handle browser lifecycle across multiple submission attempts | ❌ failed | 0.01s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/authentication_flow.spec.ts

#### LoginManager.validate_login_state

| Test | Status | Duration |
|------|--------|----------|
| returns true when current URL includes any success pattern | ✅ passed | 0.01s |
| returns true (default) even if patterns not matched (back-compat) | ✅ passed | 0.01s |
| returns false when require_page throws | ✅ passed | 0.01s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/bot_orchestation.spec.ts

#### BotOrchestrator small logic

| Test | Status | Duration |
|------|--------|----------|
| validate required fields logic | ✅ passed | 0.00s |
| project-specific tool locator resolution | ✅ passed | 0.00s |
| should return error when run_automation is called without start() | ✅ passed | 0.02s |
| should work when start() is called before run_automation() | ❌ failed | 0.02s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts

#### Browser Lifecycle Management

| Test | Status | Duration |
|------|--------|----------|
| should allow start() to be called multiple times safely | ❌ failed | 0.05s |
| should allow close() to be called multiple times safely | ❌ failed | 0.02s |
| should handle close() when start() was never called | ✅ passed | 0.01s |
| should prevent operations after close() | ❌ failed | 0.01s |
| should properly cleanup resources on automation error | ❌ failed | 0.02s |
| should handle concurrent automation attempts gracefully | ❌ failed | 0.02s |
| should initialize chromium browser correctly | ❌ failed | 0.02s |
| should handle headless mode configuration correctly | ❌ failed | 0.01s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/orchestrator_submit_retry.spec.ts

#### BotOrchestrator submit retry behavior (one retry only)

| Test | Status | Duration |
|------|--------|----------|
| succeeds when first submit fails and second succeeds (one retry) | ✅ passed | 0.08s |
| fails when both first and retry submissions fail | ✅ passed | 0.11s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/runTimesheet_wrapper.spec.ts

#### runTimesheet wrapper function

| Test | Status | Duration |
|------|--------|----------|
| should handle empty rows array gracefully | ✅ passed | 0.01s |
| should return proper error structure when authentication fails | ❌ failed | 0.03s |
| should handle invalid credentials gracefully | ❌ failed | 0.01s |
| should process multiple rows and report individual failures | ❌ failed | 0.01s |

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/webform_flow.spec.ts

#### WebformFiller against mock form

| Test | Status | Duration |
|------|--------|----------|
| fills required fields and submits successfully | ⏭️ skipped | - |

## Failed Tests Details

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Path Management > should set and get database path correctly

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Path Management > should resolve relative paths to absolute paths

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Path Management > should create database directory if it does not exist

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Connection > should open database connection successfully

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Connection > should create database file if it does not exist

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Schema Management > should create timesheet table with correct schema

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Schema Management > should create required indexes

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Schema Management > should create unique constraint for deduplication

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should insert a new timesheet entry successfully

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should calculate hours automatically

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should handle optional fields correctly

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should validate time constraints

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should prevent duplicate entries based on unique constraint

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different time_in

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different project

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different task description

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different date

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different optional fields

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should correctly identify non-duplicate entries

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should correctly identify duplicate entries

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should find duplicate entries in database

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should filter duplicates by date range

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should insert multiple entries successfully

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should handle mixed duplicates in batch insertion

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should handle empty batch

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should use transaction for atomicity

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Edge Cases and Error Handling > should handle database connection errors gracefully

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Edge Cases and Error Handling > should handle malformed entry data

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Edge Cases and Error Handling > should handle null and undefined values in optional fields

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-workflow-integration.spec.ts - IPC Workflow Integration > should handle workflow when database has pending entries

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-workflow-integration.spec.ts - IPC Workflow Integration > should handle workflow when database is empty

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-workflow-integration.spec.ts - IPC Workflow Integration > should not mutate database entries during failed submission

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-workflow-integration.spec.ts - IPC Workflow Integration > should handle multiple pending entries with different projects

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-workflow-integration.spec.ts - IPC Workflow Integration > should maintain data integrity across automation attempts

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts - Timesheet Submission Integration > should fetch pending entries correctly

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts - Timesheet Submission Integration > should mark entries as submitted correctly

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts - Timesheet Submission Integration > should remove failed entries correctly

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts - Timesheet Submission Integration > should handle empty pending entries gracefully

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts - Timesheet Submission Integration > should convert database rows to bot format correctly

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts - Timesheet Submission Integration > should initialize and cleanup browser when submitting timesheets

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/timesheet_submission_integration.spec.ts - Timesheet Submission Integration > should properly handle browser lifecycle across multiple submission attempts

```
Could not connect to database
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/bot_orchestation.spec.ts - BotOrchestrator small logic > should work when start() is called before run_automation()

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts - Browser Lifecycle Management > should allow start() to be called multiple times safely

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts - Browser Lifecycle Management > should allow close() to be called multiple times safely

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts - Browser Lifecycle Management > should prevent operations after close()

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts - Browser Lifecycle Management > should properly cleanup resources on automation error

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts - Browser Lifecycle Management > should handle concurrent automation attempts gracefully

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts - Browser Lifecycle Management > should initialize chromium browser correctly

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/browser_lifecycle.spec.ts - Browser Lifecycle Management > should handle headless mode configuration correctly

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/runTimesheet_wrapper.spec.ts - runTimesheet wrapper function > should return proper error structure when authentication fails

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/runTimesheet_wrapper.spec.ts - runTimesheet wrapper function > should handle invalid credentials gracefully

```
this.context.addInitScript is not a function
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/services/bot/runTimesheet_wrapper.spec.ts - runTimesheet wrapper function > should process multiple rows and report individual failures

```
this.context.addInitScript is not a function
```
