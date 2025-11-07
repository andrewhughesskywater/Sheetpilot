# Test Results

Generated at: 2025-11-07T16:25:03.895Z

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 19 |
| Passed | 18 |
| Failed | 0 |
| Skipped | 1 |
| Duration | 0.20s |

**Pass Rate:** 94.74%

## Test Results by File

### C:/Users/andrew.hughes/Program Development/Sheetpilot/app/backend/tests/smoke/critical-paths.spec.ts

#### Critical Path Smoke Tests > Application Initialization

| Test | Status | Duration |
|------|--------|----------|
| should initialize without errors | ✅ passed | 0.16s |
| should register IPC handlers successfully | ⏭️ skipped | - |
| should initialize database schema correctly | ✅ passed | 0.00s |

#### Critical Path Smoke Tests > Core Validation Functions

| Test | Status | Duration |
|------|--------|----------|
| should validate dates correctly | ✅ passed | 0.01s |
| should validate times correctly | ✅ passed | 0.00s |
| should validate time relationships correctly | ✅ passed | 0.00s |

#### Critical Path Smoke Tests > Business Logic Functions

| Test | Status | Duration |
|------|--------|----------|
| should validate project-tool relationships | ✅ passed | 0.00s |
| should validate tool-chargeCode relationships | ✅ passed | 0.00s |
| should validate required fields | ✅ passed | 0.00s |

#### Critical Path Smoke Tests > IPC Communication

| Test | Status | Duration |
|------|--------|----------|
| should handle saveDraft IPC call | ✅ passed | 0.00s |
| should handle loadDraft IPC call | ✅ passed | 0.00s |

#### Critical Path Smoke Tests > Data Structures

| Test | Status | Duration |
|------|--------|----------|
| should have correct project lists | ✅ passed | 0.01s |
| should have correct charge code lists | ✅ passed | 0.00s |
| should have correct tool mappings | ✅ passed | 0.00s |

#### Critical Path Smoke Tests > Error Handling

| Test | Status | Duration |
|------|--------|----------|
| should handle invalid inputs gracefully | ✅ passed | 0.00s |
| should provide user-friendly error messages | ✅ passed | 0.00s |

#### Critical Path Smoke Tests > Performance

| Test | Status | Duration |
|------|--------|----------|
| should complete all smoke tests quickly | ✅ passed | 0.00s |

#### Critical Path Smoke Tests > Integration Points

| Test | Status | Duration |
|------|--------|----------|
| should have consistent data flow | ✅ passed | 0.00s |
| should maintain data integrity | ✅ passed | 0.00s |
