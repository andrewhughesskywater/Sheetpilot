# Timesheet Overlap Validation Feature

## Overview

Added validation to detect and prevent duplicate/overlapping time entries on the same date in the timesheet.

## Validation Rules

### What is Rejected

1. **Overlapping time ranges** on the same date
   - Example: Entry A `09:00-12:00` overlaps with Entry B `11:00-14:00` ❌

2. **Exact duplicate entries** on the same date  
   - Example: Two entries with `09:00-12:00` on `01/15/2024` ❌

### What is Allowed

1. **Adjacent time ranges** (no overlap at boundaries)
   - Example: Entry A `09:00-12:00` followed by Entry B `12:00-15:00` ✅

2. **Overlapping times on different dates**
   - Example: `09:00-12:00` on `01/15/2024` and `09:00-12:00` on `01/16/2024` ✅

### First-In Rule

When overlaps are detected:

- The **first entry** (earlier row) is always accepted
- The **second entry** (later row) is rejected with an error message
- Error message: "The time range you entered overlaps with a previous entry, please adjust your entry accordingly"

### Validation Timing

- Validates when the user **moves to another cell** (on blur)
- Does not validate while actively typing
- Checks both `timeIn` and `timeOut` field changes

## Implementation

### Files Modified

1. **`timesheet.schema.ts`** - Added overlap detection functions:
   - `timeRangesOverlap()` - Checks if two time ranges overlap
   - `hasTimeOverlapWithPreviousEntries()` - Checks current row against all previous rows

2. **`timesheet.validation.ts`** - Created/updated with overlap validation:
   - Updated `validateField()` for `timeIn` and `timeOut` cases
   - Returns error message when overlap detected

3. **`TimesheetGrid.tsx`** - Updated Handsontable validators:
   - Enhanced `timeInValidator` to check for overlaps
   - Enhanced `timeOutValidator` to check for overlaps
   - Validators mark cells as invalid in real-time

### Files Created

1. **`timesheet.validation.ts`** - Field validation logic
2. **`timesheet-overlap-validation.spec.ts`** - Comprehensive test suite (33 tests)

## Test Coverage

All 33 tests passing ✅

### Test Categories

- Basic overlap detection (9 tests)
- Previous entries overlap checking (12 tests)  
- Field validation integration (8 tests)
- Edge cases (4 tests)

### Key Test Cases

✅ Detects overlapping time ranges  
✅ Allows adjacent time ranges (12:00-15:00, 15:00-17:00)  
✅ Detects exact duplicates  
✅ Checks against all previous rows, not just immediate one  
✅ Skips validation for incomplete/invalid data  
✅ First entry is always valid, subsequent overlaps rejected  
✅ Overlaps on different dates are allowed

## Usage

No configuration needed. The validation automatically runs when users:

1. Enter or edit a `Start Time` field
2. Enter or edit an `End Time` field
3. Move to another cell (validation triggers on blur)

Invalid cells will be marked with red highlighting (Handsontable's `htInvalid` class).
