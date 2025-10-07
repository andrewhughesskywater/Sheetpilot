# Row Header Selection Fix

## Problem Statement
Users were unable to click on row headers to select and remove rows. They could only delete rows by right-clicking on cells, which is unintuitive.

## Root Cause
The Handsontable `contextMenu` property was set to `true` (boolean), which enables a basic context menu but doesn't provide the full row selection and deletion functionality from row headers.

## Solution
Changed the `contextMenu` property from a boolean to a configuration object that explicitly defines the context menu items, including row operations.

### Changes Made

#### Files Modified
1. `renderer/src/components/TimesheetGrid.tsx`
2. `renderer/components/TimesheetGrid.tsx`

#### Configuration Update
**Before:**
```tsx
contextMenu={true}
```

**After:**
```tsx
// Context menu with explicit items (array format for better compatibility)
contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo', '---------', 'copy', 'cut']}

// Enable row selection
selectionMode="multiple"
outsideClickDeselects={true}
```

## Configuration Properties Explained

### Context Menu Items

| Item | Description |
|------|-------------|
| `row_above` | Insert a new row above the current row |
| `row_below` | Insert a new row below the current row |
| `remove_row` | **Delete the selected row(s)** - This is the key fix |
| `---------` | Separator line for visual grouping |
| `undo` | Undo the last action |
| `redo` | Redo the last undone action |
| `copy` | Copy selected cells |
| `cut` | Cut selected cells |

### Selection Properties

| Property | Value | Description |
|----------|-------|-------------|
| `selectionMode` | `"multiple"` | Allows selection of multiple cells/rows |
| `outsideClickDeselects` | `true` | Clicking outside the table deselects current selection |

## How It Works Now

### User Experience
1. **Click on row header** - Selects the entire row (row header is now clickable)
2. **Right-click on row header** - Opens context menu with "Remove row" option
3. **Click "Remove row"** - Deletes the row and persists deletion to database

### Technical Flow
1. User clicks row header → Row is visually selected
2. User right-clicks row header → Context menu appears
3. User clicks "Remove row" → `afterRemoveRow` handler is triggered
4. Handler calls `window.timesheet.deleteDraft(row.id)` → Row is deleted from database
5. Row stays deleted even after application restart

## Benefits

### Improved UX
- ✅ Intuitive row selection via row headers
- ✅ Clear visual feedback when row is selected
- ✅ Standard context menu behavior users expect
- ✅ Multiple ways to delete rows (row header or cell context menu)

### Accessibility
- ✅ Follows standard spreadsheet UI patterns
- ✅ Consistent with Excel/Google Sheets behavior
- ✅ Visual selection indicators
- ✅ Keyboard-accessible context menu (right-click or context menu key)

### Functionality
- ✅ Row headers are now interactive
- ✅ Full context menu with row operations
- ✅ Integrated with existing deletion logic
- ✅ Persistent deletion to database

## Testing

### Manual Testing Steps
1. Open the application
2. Navigate to the timesheet grid
3. Click on any row header (number on the left)
4. Verify the entire row is highlighted
5. Right-click on the row header
6. Verify context menu appears with "Remove row" option
7. Click "Remove row"
8. Verify row is deleted from the grid
9. Close and reopen the application
10. Verify the row stays deleted

### Expected Behavior
- Row headers respond to clicks
- Entire row is selected when row header is clicked
- Context menu appears on right-click
- "Remove row" option is visible and functional
- Deletion persists across application restarts

## Related Features

This fix works in conjunction with:
- **Draft Deletion Handler** (`timesheet:deleteDraft` IPC channel)
- **Row Deletion Logic** (`handleAfterRemoveRow` callback)
- **Database Persistence** (DELETE SQL query with status IS NULL check)

## Documentation References

- [Handsontable Context Menu Documentation](https://handsontable.com/docs/javascript-data-grid/context-menu/)
- [Handsontable Row Headers Documentation](https://handsontable.com/docs/javascript-data-grid/row-header/)
- [Cell Interactivity Fix](./CELL_INTERACTIVITY_FIX_SUMMARY.md)
- [Draft Deletion Implementation](./DRAFT_DELETION_IMPLEMENTATION.md)

## Notes

- The context menu configuration is explicit to ensure all necessary options are available
- The `remove_row` option is the critical addition that enables row deletion from headers
- Separators (`sp1`, `sp2`) improve menu organization and visual clarity
- All existing functionality (undo, redo, copy, cut) is preserved

