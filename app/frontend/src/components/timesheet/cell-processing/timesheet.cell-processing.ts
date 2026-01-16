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

type ValidationResult = {
  isValid: boolean;
  shouldClear: boolean;
  errorMessage: string;
};

const validateChange = (
  propStr: string,
  newVal: unknown
): ValidationResult => {
  if (propStr === 'date' && newVal) {
    const dateStr = String(newVal);
    const isValid = isValidDate(dateStr);
    return {
      isValid,
      shouldClear: !isValid,
      errorMessage: isValid
        ? ''
        : `Invalid date format "${String(newVal)}" (must be MM/DD/YYYY or YYYY-MM-DD)`,
    };
  }

  if (
    propStr === 'hours' &&
    newVal !== undefined &&
    newVal !== null &&
    newVal !== ''
  ) {
    const hoursValue = typeof newVal === 'number' ? newVal : Number(newVal);
    const isValid = !isNaN(hoursValue) && isValidHours(hoursValue);
    return {
      isValid,
      shouldClear: !isValid,
      errorMessage: isValid
        ? ''
        : `Invalid hours "${String(newVal)}" (must be between 0.25 and 24.0 in 15-minute increments)`,
    };
  }

  if ((propStr === 'project' || propStr === 'taskDescription') && !newVal) {
    const fieldName = propStr === 'project' ? 'Project' : 'Task Description';
    return {
      isValid: false,
      shouldClear: true,
      errorMessage: `${fieldName} is required`,
    };
  }

  return { isValid: true, shouldClear: false, errorMessage: '' };
};

const buildUpdatedRow = (
  currentRow: TimesheetRow,
  propStr: string,
  newVal: unknown,
  oldVal: unknown
): TimesheetRow => {
  if (propStr === 'date' && newVal && newVal !== oldVal) {
    return { ...currentRow, date: normalizeDateFormat(String(newVal)) };
  }

  if (propStr === 'hours' && newVal !== undefined && newVal !== null && newVal !== '') {
    const hoursValue = typeof newVal === 'number' ? newVal : Number(newVal);
    return {
      ...currentRow,
      hours: !isNaN(hoursValue)
        ? hoursValue
        : typeof newVal === 'number'
          ? newVal
          : 0,
    };
  }

  if (propStr === 'project' && newVal !== oldVal) {
    const project = String(newVal ?? '');
    return !doesProjectNeedTools(project)
      ? { ...currentRow, project, tool: null, chargeCode: null }
      : { ...currentRow, project };
  }

  if (propStr === 'tool' && newVal !== oldVal) {
    const tool = String(newVal ?? '');
    return !doesToolNeedChargeCode(tool)
      ? { ...currentRow, tool, chargeCode: null }
      : { ...currentRow, tool };
  }

  return { ...currentRow, [propStr]: newVal ?? '' };
};

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
  
  const validation = validateChange(propStr, newVal);

  // AUTO-CLEAR: If invalid, revert to previous value
  if (validation.shouldClear && validation.isValid === false) {
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
        message: validation.errorMessage
      },
      shouldSkip: true
    };
  }

  if (validation.isValid) {
    const updatedRow = buildUpdatedRow(currentRow, propStr, newVal, oldVal);
    hotInstance.setCellMeta(rowIdx, colIdx, 'className', '');
    return { updatedRow, isValid: true, error: null, shouldSkip: false };
  }

  return { updatedRow: currentRow, isValid: false, error: null, shouldSkip: false };
}
