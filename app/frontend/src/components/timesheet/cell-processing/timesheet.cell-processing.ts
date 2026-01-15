/**
 * Cell-level processing logic for timesheet grid
 * 
 * Handles validation, formatting, and cascading rules for individual cell changes.
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';
import { isValidDate, isValidHours, normalizeDateFormat } from '@/components/timesheet/schema/timesheet.schema';
import { doesProjectNeedTools, doesToolNeedChargeCode } from '@sheetpilot/shared/business-config';

export interface ValidationError {
  row: number;
  col: number;
  field: string;
  message: string;
}

/**
 * Represents a single cell change in Handsontable afterChange callback
 * Format: [rowIndex, propertyName, oldValue, newValue]
 * Note: Using unknown for prop to match Handsontable's ColumnDataGetterSetterFunction type
 */
export type HandsontableChange = [row: number, prop: unknown, oldValue: unknown, newValue: unknown];

/**
 * Process a single cell change with validation, formatting, and cascading rules
 * 
 * Handles all cell-level logic including:
 * - Date and hours format validation
 * - Required field validation
 * - Auto-clearing invalid values (reverts to previous value)
 * - Cascading business rules (project → tool → charge code)
 * - Visual feedback via cell meta styling
 * 
 * WHY inline validation instead of column validators:
 * Column validators block editor closing and cause navigation issues.
 * This approach validates in afterChange hook and uses setCellMeta for visual feedback.
 * 
 * @param change - Handsontable change tuple [row, prop, oldValue, newValue]
 * @param currentRow - Current row data before change
 * @param hotInstance - Handsontable instance for cell manipulation
 * @returns Processing result with updated row, validation status, and error info
 */
export function processCellChange(
  change: HandsontableChange,
  currentRow: TimesheetRow,
  hotInstance: { propToCol: (prop: string) => number | unknown; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void; setCellMeta: (row: number, col: number, key: string, value: unknown) => void }
): {
  updatedRow: TimesheetRow;
  isValid: boolean;
  error: ValidationError | null;
  shouldSkip: boolean;
} {
  const [rowIdx, prop, oldVal, newVal] = change;
  const propStr = typeof prop === 'string' ? prop : typeof prop === 'number' ? String(prop) : '';
  const colIdxRaw = hotInstance.propToCol(propStr);
  const colIdx = typeof colIdxRaw === 'number' ? colIdxRaw : -1;
  
  if (colIdx < 0) {
    return { updatedRow: currentRow, isValid: true, error: null, shouldSkip: true };
  }
  
  let isValid = true;
  let errorMessage = '';
  let shouldClear = false;
  
  // Validate and normalize dates
  if (propStr === 'date' && newVal) {
    const dateStr = String(newVal);
    isValid = isValidDate(dateStr);
    if (!isValid) {
      errorMessage = `Invalid date format "${String(newVal)}" (must be MM/DD/YYYY or YYYY-MM-DD)`;
      shouldClear = true;
    }
  }
  // Validate hours
  else if (propStr === 'hours' && newVal !== undefined && newVal !== null && newVal !== '') {
    const hoursValue = typeof newVal === 'number' ? newVal : Number(newVal);
    isValid = !isNaN(hoursValue) && isValidHours(hoursValue);
    if (!isValid) {
      errorMessage = `Invalid hours "${String(newVal)}" (must be between 0.25 and 24.0 in 15-minute increments)`;
      shouldClear = true;
    }
  }
  // Validate required fields
  else if ((propStr === 'project' || propStr === 'taskDescription') && !newVal) {
    isValid = false;
    const fieldName = propStr === 'project' ? 'Project' : 'Task Description';
    errorMessage = `${fieldName} is required`;
    shouldClear = true;
  }
  
  // AUTO-CLEAR: If invalid, revert to previous value
  if (shouldClear && isValid === false) {
    const revertValue = oldVal ?? '';
    hotInstance.setDataAtCell(rowIdx, colIdx, revertValue);
    hotInstance.setCellMeta(rowIdx, colIdx, 'className', 'htInvalid');
    
    return {
      updatedRow: { ...currentRow, [propStr]: revertValue },
      isValid: false,
      error: {
        row: rowIdx,
        col: colIdx,
        field: propStr,
        message: errorMessage
      },
      shouldSkip: true
    };
  }
  
  // VALID CHANGE: Process normally
  let updatedRow: TimesheetRow = currentRow;
  
  if (isValid) {
    // Normalize and format date inputs
    if (propStr === 'date' && newVal && newVal !== oldVal) {
      updatedRow = { ...currentRow, date: normalizeDateFormat(String(newVal)) };
    }
    // Handle hours input (convert to number if string)
    else if (propStr === 'hours' && newVal !== undefined && newVal !== null && newVal !== '') {
      const hoursValue = typeof newVal === 'number' ? newVal : Number(newVal);
      updatedRow = { ...currentRow, hours: !isNaN(hoursValue) ? hoursValue : (typeof newVal === 'number' ? newVal : 0) };
    }
    // Cascade project → tool → chargeCode
    else if (propStr === 'project' && newVal !== oldVal) {
      const project = String(newVal ?? '');
      updatedRow = !doesProjectNeedTools(project)
        ? { ...currentRow, project, tool: null, chargeCode: null }
        : { ...currentRow, project };
    } else if (propStr === 'tool' && newVal !== oldVal) {
      const tool = String(newVal ?? '');
      updatedRow = !doesToolNeedChargeCode(tool)
        ? { ...currentRow, tool, chargeCode: null }
        : { ...currentRow, tool };
    } else {
      updatedRow = { ...currentRow, [propStr]: newVal ?? '' };
    }
    
    // Clear invalid styling if previously invalid
    hotInstance.setCellMeta(rowIdx, colIdx, 'className', '');
  }
  
  return { updatedRow, isValid, error: null, shouldSkip: false };
}
