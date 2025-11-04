# Test Results

Generated at: 2025-11-04T02:09:15.845Z

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 29 |
| Passed | 0 |
| Failed | 29 |
| Skipped | 0 |
| Duration | 0.11s |

**Pass Rate:** 0.00%

## Test Results by File

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts

#### Database Module > Database Path Management

| Test | Status | Duration |
|------|--------|----------|
| should set and get database path correctly | ❌ failed | 0.02s |
| should resolve relative paths to absolute paths | ❌ failed | 0.00s |
| should create database directory if it does not exist | ❌ failed | 0.00s |

#### Database Module > Database Connection

| Test | Status | Duration |
|------|--------|----------|
| should open database connection successfully | ❌ failed | 0.00s |
| should create database file if it does not exist | ❌ failed | 0.00s |

#### Database Module > Schema Management

| Test | Status | Duration |
|------|--------|----------|
| should create timesheet table with correct schema | ❌ failed | 0.00s |
| should create required indexes | ❌ failed | 0.00s |
| should create unique constraint for deduplication | ❌ failed | 0.00s |

#### Database Module > Timesheet Entry Insertion

| Test | Status | Duration |
|------|--------|----------|
| should insert a new timesheet entry successfully | ❌ failed | 0.00s |
| should calculate hours automatically | ❌ failed | 0.00s |
| should handle optional fields correctly | ❌ failed | 0.00s |
| should validate time constraints | ❌ failed | 0.00s |

#### Database Module > Deduplication Functionality

| Test | Status | Duration |
|------|--------|----------|
| should prevent duplicate entries based on unique constraint | ❌ failed | 0.00s |
| should allow entries with different time_in | ❌ failed | 0.00s |
| should allow entries with different project | ❌ failed | 0.00s |
| should allow entries with different task description | ❌ failed | 0.00s |
| should allow entries with different date | ❌ failed | 0.00s |
| should allow entries with different optional fields | ❌ failed | 0.00s |

#### Database Module > Duplicate Checking Utilities

| Test | Status | Duration |
|------|--------|----------|
| should correctly identify non-duplicate entries | ❌ failed | 0.00s |
| should correctly identify duplicate entries | ❌ failed | 0.00s |
| should find duplicate entries in database | ❌ failed | 0.00s |
| should filter duplicates by date range | ❌ failed | 0.00s |

#### Database Module > Batch Insertion

| Test | Status | Duration |
|------|--------|----------|
| should insert multiple entries successfully | ❌ failed | 0.00s |
| should handle mixed duplicates in batch insertion | ❌ failed | 0.00s |
| should handle empty batch | ❌ failed | 0.00s |
| should use transaction for atomicity | ❌ failed | 0.00s |

#### Database Module > Edge Cases and Error Handling

| Test | Status | Duration |
|------|--------|----------|
| should handle database connection errors gracefully | ❌ failed | 0.00s |
| should handle malformed entry data | ❌ failed | 0.00s |
| should handle null and undefined values in optional fields | ❌ failed | 0.00s |

## Failed Tests Details

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Path Management > should set and get database path correctly

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Path Management > should resolve relative paths to absolute paths

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Path Management > should create database directory if it does not exist

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Connection > should open database connection successfully

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Database Connection > should create database file if it does not exist

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Schema Management > should create timesheet table with correct schema

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Schema Management > should create required indexes

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Schema Management > should create unique constraint for deduplication

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should insert a new timesheet entry successfully

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should calculate hours automatically

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should handle optional fields correctly

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Timesheet Entry Insertion > should validate time constraints

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should prevent duplicate entries based on unique constraint

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different time_in

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different project

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different task description

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different date

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Deduplication Functionality > should allow entries with different optional fields

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should correctly identify non-duplicate entries

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should correctly identify duplicate entries

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should find duplicate entries in database

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Duplicate Checking Utilities > should filter duplicates by date range

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should insert multiple entries successfully

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should handle mixed duplicates in batch insertion

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should handle empty batch

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Batch Insertion > should use transaction for atomicity

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Edge Cases and Error Handling > should handle database connection errors gracefully

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Edge Cases and Error Handling > should handle malformed entry data

```
Could not connect to database
```

### C:/Users/ACHug/Program Development/Sheetpilot/app/backend/tests/database.spec.ts - Database Module > Edge Cases and Error Handling > should handle null and undefined values in optional fields

```
Could not connect to database
```
