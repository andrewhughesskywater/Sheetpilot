# Test Results

Generated at: 2025-11-05T21:08:07.064Z

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 43 |
| Passed | 41 |
| Failed | 2 |
| Skipped | 0 |
| Duration | 0.06s |

**Pass Rate:** 95.35%

## Test Results by File

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-handlers-comprehensive.spec.ts

#### IPC Handlers Comprehensive Tests > ping handler

| Test | Status | Duration |
|------|--------|----------|
| should return pong with message | ✅ passed | 0.00s |
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
| should handle deletion failure | ✅ passed | 0.00s |
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

#### IPC Handlers Comprehensive Tests > database:getAllArchiveData handler (batched)

| Test | Status | Duration |
|------|--------|----------|
| should retrieve both timesheet and credentials in a single call | ✅ passed | 0.00s |
| should require valid session token | ✅ passed | 0.00s |
| should validate session token | ✅ passed | 0.00s |
| should handle database errors gracefully | ✅ passed | 0.00s |

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
| should delete valid draft entry | ✅ passed | 0.00s |
| should validate ID parameter | ✅ passed | 0.00s |
| should handle non-existent entry | ✅ passed | 0.00s |
| should handle database errors | ✅ passed | 0.00s |
| should only delete draft entries (status IS NULL) | ✅ passed | 0.00s |

#### IPC Handlers Comprehensive Tests > timesheet:submit handler

| Test | Status | Duration |
|------|--------|----------|
| should submit timesheets with valid credentials | ❌ failed | 0.02s |
| should handle missing credentials | ✅ passed | 0.00s |
| should handle submission failures | ❌ failed | 0.00s |

## Failed Tests Details

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-handlers-comprehensive.spec.ts - IPC Handlers Comprehensive Tests > timesheet:submit handler > should submit timesheets with valid credentials

```
Cannot read properties of undefined (reading 'ok')
```

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/ipc-handlers-comprehensive.spec.ts - IPC Handlers Comprehensive Tests > timesheet:submit handler > should handle submission failures

```
Cannot read properties of undefined (reading 'ok')
```
