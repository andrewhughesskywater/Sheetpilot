# Handsontable Requirements for Timesheet Component

## Overview

This document defines the functional and technical requirements for the Handsontable implementation in the Sheetpilot Timesheet component.

## Functional Requirements

### 1. Data Structure

- **Row Data**: Each row represents a timesheet entry with the following fields:
  - `date`: Date of work (MM/DD/YYYY format)
  - `timeIn`: Start time (0000-2400 format)
  - `timeOut`: End time (0000-2400 format)
  - `project`: Project selection (dropdown)
  - `tool`: Tool selection (dropdown, cascading from project)
  - `chargeCode`: Charge code selection (dropdown, cascading from tool)
  - `taskDescription`: Free text description

### 2. Column Configuration

#### Date Column (Column 0)

- **Type**: Date picker
- **Format**: MM/DD/YYYY
- **Placeholder**: "MM/DD/YYYY"
- **Validation**: Required, valid date format and in the current quarter of the current year
- **Alignment**: Center

#### Time Columns (Columns 1-2)

- **Type**: Text input
- **Format**: 0000 to 2400 (24-hour format)
- **Placeholders**: "0000 to 2400"
- **Validation**: Required, valid time format
- **Alignment**: Center

#### Project Column (Column 3)

- **Type**: Dropdown
- **Source**: Dynamic project list
- **Behavior**: Always enabled
- **Placeholder**: "Pick a project"
- **Validation**: Required, must be from valid project list
- **Alignment**: Left

#### Tool Column (Column 4)

- **Type**: Dropdown
- **Source**: Dynamic tool list based on selected project
- **Behavior**: Cascading dropdown
  - Enabled when project requires tools
  - Disabled (shows "N/A") when project doesn't require tools
- **Placeholder**: "Pick a tool" or "N/A"
- **Validation**: Required when enabled, must be from valid tool list
- **Alignment**: Left

#### Charge Code Column (Column 5)

- **Type**: Dropdown
- **Source**: Dynamic charge code list based on selected tool
- **Behavior**: Cascading dropdown
  - Enabled when tool requires charge codes
  - Disabled (shows "N/A") when tool doesn't require charge codes
- **Placeholder**: "Pick a charge code" or "N/A"
- **Validation**: Required when enabled, must be from valid charge code list
- **Alignment**: Left

#### Task Description Column (Column 6)

- **Type**: Text input
- **Behavior**: Free text entry
- **Placeholder**: Empty
- **Validation**: Optional
- **Alignment**: Left

### 3. Dropdown Behavior Requirements

#### Positioning

- **Direction**: Always render below the cell
- **Width**: Match the cell width exactly
- **Z-index**: High enough to appear above all other elements
- **Overflow**: Must not be clipped by container boundaries
- **Scrollbar**: Vertical only, no horizontal scrollbar

#### Cascading Logic

1. **Project Selection**:
   - Triggers tool dropdown update
   - Clears tool and charge code selections
   - Updates tool dropdown source based on project

2. **Tool Selection**:
   - Triggers charge code dropdown update
   - Clears charge code selection
   - Updates charge code dropdown source based on tool

3. **Charge Code Selection**:
   - No cascading effect
   - Final selection in the chain

#### Visual States

- **Enabled**: Normal appearance, clickable
- **Disabled**: Dimmed appearance, shows "N/A", not clickable
- **Loading**: Show loading state during data updates
- **Error**: Show error state for invalid selections

### 4. User Interaction Requirements

#### Cell Selection

- **Visual Feedback**: Green border around selected cell
- **Logging**: Log all cell selections for debugging
- **State Management**: Track current selection

#### Data Entry

- **Auto-save**: Save changes automatically after user input
- **Validation**: Real-time validation with error messages
- **Backup**: Local backup of unsaved changes
- **Undo/Redo**: Support for undo/redo operations

#### Row Management

- **Add Row**: Add new empty row at bottom
- **Remove Row**: Remove selected row with confirmation
- **Row Height**: Adjustable row height
- **Row Sorting**: Sort by any column

#### Column Management

- **Column Width**: Adjustable column width
- **Column Sorting**: Sort by any column
- **Column Resizing**: Drag to resize columns
- **State Persistence**: Remember column widths and sorting

### 5. Data Validation Requirements

#### Field Validation

- **Date**: Must be valid date, not in future
- **Time**: Must be valid 24-hour format, timeOut > timeIn
- **Project**: Must be from valid project list
- **Tool**: Must be from valid tool list for selected project
- **Charge Code**: Must be from valid charge code list for selected tool

#### Row Validation

- **Complete Row**: All required fields must be filled
- **Time Logic**: End time must be after start time
- **Cascading Logic**: Tool must be valid for project, charge code must be valid for tool

#### Error Handling

- **Visual Indicators**: Red border for invalid cells
- **Error Messages**: Clear error messages for validation failures
- **Prevention**: Prevent submission of invalid data

## Technical Requirements

### 1. Performance Requirements

- **Rendering**: Smooth rendering with 100+ rows
- **Memory**: Efficient memory usage for large datasets
- **Responsiveness**: UI remains responsive during data operations
- **Load Time**: Fast initial load and data refresh

### 2. Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Electron**: Full compatibility with Electron environment
- **Responsive**: Works on different screen sizes

### 3. Accessibility Requirements

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Compatible with screen readers
- **ARIA Labels**: Proper ARIA labels for all interactive elements
- **Focus Management**: Clear focus indicators

### 4. Integration Requirements

#### IPC Communication

- **Data Loading**: Load timesheet data from main process
- **Data Saving**: Save timesheet data to main process
- **Logging**: Send all user actions to main process for logging
- **Error Handling**: Proper error handling and reporting

#### State Management

- **Local State**: Manage local state for UI interactions
- **Persistent State**: Remember user preferences (column widths, sorting)
- **Data Synchronization**: Keep local and remote data in sync

#### Logging Requirements

- **User Actions**: Log all user interactions
- **Data Changes**: Log all data modifications
- **Errors**: Log all errors and validation failures
- **Performance**: Log performance metrics
- **Debug Information**: Detailed debug information for troubleshooting

### 5. Configuration Requirements

#### Dropdown Configuration

```typescript
{
  type: 'dropdown',
  source: string[],
  strict: true,
  allowInvalid: false,
  placeholder: string,
  className: 'htCenter',
  trimDropdown: false,
  visibleRows: 10,
  dropdownWidth: 'auto',
  dropdownDirection: 'down',
  dropdownPosition: 'below'
}
```

#### CSS Requirements

- **Overflow**: All containers must have `overflow: visible`
- **Z-index**: Dropdowns must have high z-index (9999+)
- **Positioning**: Force dropdowns to render below cells
- **Width**: Match cell width exactly
- **Scrollbars**: Vertical only, no horizontal scrollbars

#### Event Handling

- **afterChange**: Handle data changes
- **afterSelectionEnd**: Handle cell selection
- **afterDropdownMenuShow**: Handle dropdown positioning
- **beforeValidate**: Handle validation
- **afterValidate**: Handle validation results

## Non-Functional Requirements

### 1. Reliability

- **Error Recovery**: Graceful handling of errors
- **Data Integrity**: Prevent data corruption
- **Backup**: Automatic backup of user data

### 2. Usability

- **Intuitive**: Easy to use for non-technical users
- **Consistent**: Consistent behavior across all interactions
- **Responsive**: Quick response to user actions
- **Clear Feedback**: Clear visual feedback for all actions

### 3. Maintainability

- **Code Quality**: Clean, well-documented code
- **Modularity**: Modular design for easy maintenance
- **Testing**: Comprehensive test coverage
- **Documentation**: Clear documentation for all components

### 4. Security

- **Data Validation**: Validate all user input
- **XSS Prevention**: Prevent cross-site scripting attacks
- **Data Sanitization**: Sanitize all data before processing

## Success Criteria

### 1. Functional Success

- ✅ All dropdowns render below cells consistently
- ✅ Cascading dropdowns work correctly
- ✅ Data validation prevents invalid submissions
- ✅ User interactions are logged properly
- ✅ All features work as specified

### 2. Technical Success

- ✅ No horizontal scrollbars on dropdowns
- ✅ Dropdowns are not clipped by container boundaries
- ✅ Performance is acceptable with large datasets
- ✅ All browser compatibility requirements met
- ✅ Accessibility requirements met

### 3. User Experience Success

- ✅ Intuitive and easy to use
- ✅ Clear visual feedback for all actions
- ✅ Responsive and fast
- ✅ Error messages are helpful and clear
- ✅ Consistent behavior across all interactions

## Implementation Notes

### Current Issues

1. **Dropdown Positioning**: Dropdowns render upward instead of downward
2. **Container Clipping**: Dropdowns are clipped by table boundaries
3. **Horizontal Scrollbars**: Unnecessary horizontal scrollbars appear
4. **Cascading Logic**: Tool and charge code dropdowns don't update properly

### Solutions Applied

1. **CSS Overrides**: Force dropdown positioning with CSS
2. **JavaScript Configuration**: Use Handsontable configuration options
3. **Event Handlers**: Use afterDropdownMenuShow to force positioning
4. **Container Modifications**: Add invisible padding/margin for dropdown space
5. **Overflow Settings**: Set overflow: visible on all containers

### Future Considerations

1. **Custom Dropdown Component**: Consider custom dropdown implementation
2. **Virtual Scrolling**: Implement virtual scrolling for large datasets
3. **Advanced Validation**: Implement more sophisticated validation rules
4. **Performance Optimization**: Optimize for very large datasets
5. **Mobile Support**: Ensure mobile compatibility
