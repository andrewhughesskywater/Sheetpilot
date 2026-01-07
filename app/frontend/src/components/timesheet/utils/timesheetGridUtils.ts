import type { MutableRefObject } from 'react';
import type { TimesheetRow } from '../timesheet.schema';
import {
  isValidDate,
  isValidTime,
  isTimeOutAfterTimeIn,
  hasTimeOverlapWithPreviousEntries,
  normalizeDateFormat,
  formatTimeInput,
  normalizeRowData,
} from '../timesheet.schema';
import { doesProjectNeedTools, doesToolNeedChargeCode } from '../../../../../shared/business-config';
import { getSmartPlaceholder, incrementDate, formatDateForDisplay } from '../../../utils/smartDate';
import { clearInvalidIfPresent } from '../utils/hotHelpers';

// Types mirrored from Handsontable-related usage
export type HandsontableChange = [row: number, prop: unknown, oldValue: unknown, newValue: unknown];

export interface ValidationError {
  row: number;
  col: number;
  field: string;
  message: string;
}

export interface DatePickerOptions {
  onSelect?: (this: DatePickerOptions, date: Date) => void;
  [key: string]: unknown;
}

export interface DateEditor {
  $datePicker?: {
    _o?: DatePickerOptions;
  };
  isOpened?: () => boolean;
  finishEditing: (restoreOriginalValue: boolean, ctrlDown: boolean) => void;
}

// Utility: normalize prop and column index
export function getPropAndCol(hotInstance: { propToCol: (prop: string) => number | unknown }, prop: unknown) {
  const propStr = typeof prop === 'string' ? prop : typeof prop === 'number' ? String(prop) : '';
  const colIdxRaw = hotInstance.propToCol(propStr);
  const colIdx = typeof colIdxRaw === 'number' ? colIdxRaw : -1;
  return { propStr, colIdx };
}

// Field validations
export function validateDateField(dateStr: string): { isValid: boolean; message: string } {
  const ok = isValidDate(dateStr);
  return { isValid: ok, message: ok ? '' : `Invalid date format "${dateStr}" (must be MM/DD/YYYY or YYYY-MM-DD)` };
}

export function validateTimeField(timeStr: string, fieldName: 'start time' | 'end time'): { isValid: boolean; message: string } {
  const ok = isValidTime(timeStr);
  return { isValid: ok, message: ok ? '' : `Invalid ${fieldName} "${timeStr}" (must be HH:MM in 15-min increments)` };
}

export function validateRequiredField(propStr: string, value: unknown): { isValid: boolean; message: string } {
  if (value) return { isValid: true, message: '' };
  const fieldName = propStr === 'project' ? 'Project' : 'Task Description';
  return { isValid: false, message: `${fieldName} is required` };
}

export function validateField(propStr: string, newVal: unknown): { isValid: boolean; shouldClear: boolean; message: string } {
  if ((propStr === 'date' || propStr === 'timeIn' || propStr === 'timeOut') && !newVal) {
    return { isValid: true, shouldClear: false, message: '' };
  }
  if (propStr === 'date') {
    const r = validateDateField(String(newVal));
    return { isValid: r.isValid, shouldClear: !r.isValid, message: r.message };
  }
  if (propStr === 'timeIn') {
    const r = validateTimeField(String(newVal), 'start time');
    return { isValid: r.isValid, shouldClear: !r.isValid, message: r.message };
  }
  if (propStr === 'timeOut') {
    const r = validateTimeField(String(newVal), 'end time');
    return { isValid: r.isValid, shouldClear: !r.isValid, message: r.message };
  }
  if (propStr === 'project' || propStr === 'taskDescription') {
    const r = validateRequiredField(propStr, newVal);
    return { isValid: r.isValid, shouldClear: !r.isValid, message: r.message };
  }
  return { isValid: true, shouldClear: false, message: '' };
}

// Cascading updates
export function applyProjectUpdate(project: string, currentRow: TimesheetRow): TimesheetRow {
  return !doesProjectNeedTools(project)
    ? { ...currentRow, project, tool: null, chargeCode: null }
    : { ...currentRow, project };
}

export function applyToolUpdate(tool: string, currentRow: TimesheetRow): TimesheetRow {
  return !doesToolNeedChargeCode(tool)
    ? { ...currentRow, tool, chargeCode: null }
    : { ...currentRow, tool };
}

export function applyValidUpdate(propStr: string, oldVal: unknown, newVal: unknown, currentRow: TimesheetRow): TimesheetRow {
  if (newVal === oldVal) return currentRow;
  if (propStr === 'date') {
    return newVal ? { ...currentRow, date: normalizeDateFormat(String(newVal)) } : currentRow;
  }
  if (propStr === 'timeIn' || propStr === 'timeOut') {
    return newVal ? { ...currentRow, [propStr]: formatTimeInput(String(newVal)) } : currentRow;
  }
  if (propStr === 'project') {
    return applyProjectUpdate(String(newVal ?? ''), currentRow);
  }
  if (propStr === 'tool') {
    return applyToolUpdate(String(newVal ?? ''), currentRow);
  }
  return { ...currentRow, [propStr]: newVal ?? '' } as TimesheetRow;
}

// Single change processing
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
  const { propStr, colIdx } = getPropAndCol(hotInstance, prop);

  if (colIdx < 0) {
    return { updatedRow: currentRow, isValid: true, error: null, shouldSkip: true };
  }

  const { isValid, shouldClear, message } = validateField(propStr, newVal);

  if (shouldClear && !isValid) {
    const revertValue = oldVal ?? '';
    hotInstance.setDataAtCell(rowIdx, colIdx, revertValue);
    hotInstance.setCellMeta(rowIdx, colIdx, 'className', 'htInvalid');
    return {
      updatedRow: { ...currentRow, [propStr]: revertValue },
      isValid: false,
      error: { row: rowIdx, col: colIdx, field: propStr, message },
      shouldSkip: true,
    };
  }

  const updatedRow = isValid ? applyValidUpdate(propStr, oldVal, newVal, currentRow) : currentRow;
  hotInstance.setCellMeta(rowIdx, colIdx, 'className', '');
  return { updatedRow, isValid, error: null, shouldSkip: false };
}

// Changes list processing
export function processChangesList(
  changes: HandsontableChange[],
  timesheetDraftData: TimesheetRow[],
  hotInstance: { propToCol: (prop: string) => number | unknown; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void; setCellMeta: (row: number, col: number, key: string, value: unknown) => void }
) {
  const next = [...timesheetDraftData];
  const newErrors: ValidationError[] = [];
  const cellsToClearErrors: Array<{ row: number; col: number }> = [];
  let needsUpdate = false;
  for (const change of changes) {
    const [rowIdx] = change;
    if (!next[rowIdx]) continue;
    const currentRow = next[rowIdx];
    const result = processCellChange(change, currentRow, hotInstance);
    if (result.shouldSkip) {
      if (result.error) newErrors.push(result.error);
      continue;
    }
    next[rowIdx] = result.updatedRow;
    needsUpdate = true;
    const [, prop] = change;
    const { propStr, colIdx } = getPropAndCol(hotInstance, prop);
    if (propStr && colIdx >= 0) cellsToClearErrors.push({ row: rowIdx, col: colIdx });
  }
  return { next, newErrors, cellsToClearErrors, needsUpdate };
}

// Overlap / timeout validations across rows
export function applyOverlapValidation(
  normalized: TimesheetRow[],
  hotInstance: { propToCol: (prop: string) => number | unknown; setCellMeta: (row: number, col: number, key: string, value: unknown) => void; getCellMeta: (row: number, col: number) => { className?: string | string[] } }
) {
  const overlapErrors: ValidationError[] = [];
  const overlapClearedRows: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i];
    if (!row) continue;
    if (row.date && row.timeIn && row.timeOut) {
      const hasOverlap = hasTimeOverlapWithPreviousEntries(i, normalized);
      const dateColIdx = hotInstance.propToCol('date');
      const timeInColIdx = hotInstance.propToCol('timeIn');
      const timeOutColIdx = hotInstance.propToCol('timeOut');
      const cols = [dateColIdx, timeInColIdx, timeOutColIdx].filter((c): c is number => typeof c === 'number' && c >= 0);
      if (hasOverlap) {
        cols.forEach(colIdx => hotInstance.setCellMeta(i, colIdx, 'className', 'htInvalid'));
        if (typeof dateColIdx === 'number' && dateColIdx >= 0) {
          overlapErrors.push({ row: i, col: dateColIdx, field: 'date', message: `Time overlap detected on ${row.date || 'this date'}` });
        }
      } else {
        cols.forEach(colIdx => {
          clearInvalidIfPresent(hotInstance, i, colIdx);
        });
        overlapClearedRows.push(i);
      }
    }
  }
  return { overlapErrors, overlapClearedRows };
}

export function applyTimeOutValidation(
  normalized: TimesheetRow[],
  hotInstance: { propToCol: (prop: string) => number | unknown; setCellMeta: (row: number, col: number, key: string, value: unknown) => void; getCellMeta: (row: number, col: number) => { className?: string | string[] } }
) {
  const timeOutErrors: ValidationError[] = [];
  const timeOutClearedRows: number[] = [];
  const timeOutColIdx = hotInstance.propToCol('timeOut');
  const validCol = typeof timeOutColIdx === 'number' && timeOutColIdx >= 0 ? timeOutColIdx : -1;
  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i];
    if (!row) continue;
    if (row.timeIn && row.timeOut) {
      if (!isTimeOutAfterTimeIn(row.timeIn, row.timeOut)) {
        if (validCol >= 0) {
          hotInstance.setCellMeta(i, validCol, 'className', 'htInvalid');
          timeOutErrors.push({ row: i, col: validCol, field: 'timeOut', message: `End time ${row.timeOut} must be after start time ${row.timeIn}` });
        }
      } else if (validCol >= 0) {
        clearInvalidIfPresent(hotInstance, i, validCol);
        timeOutClearedRows.push(i);
      }
    }
  }
  return { timeOutErrors, timeOutClearedRows, timeOutColIdxForClearing: validCol };
}

export function mergeValidationErrors(
  prev: ValidationError[],
  newErrors: ValidationError[],
  cellsToClearErrors: Array<{ row: number; col: number }>
): ValidationError[] {
  let filtered = prev;
  if (cellsToClearErrors.length > 0) {
    filtered = filtered.filter(prevErr => !cellsToClearErrors.some(clear => clear.row === prevErr.row && clear.col === prevErr.col));
  }
  if (newErrors.length > 0) {
    filtered = filtered.filter(prevErr => !newErrors.some(newErr => newErr.row === prevErr.row && newErr.col === prevErr.col));
  }
  return [...filtered, ...newErrors];
}

// Timesheet-level validation used for Submit button state
export function validateTimesheetRows(rows: TimesheetRow[]): { hasErrors: boolean; errorDetails: string[] } {
  if (!rows || rows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  const realRows = rows.filter((row) => row.date || row.timeIn || row.timeOut || row.project || row.taskDescription);
  if (realRows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  let hasErrors = false;
  const errorDetails: string[] = [];

  realRows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const checks: Array<{ ok: boolean; msg: string }> = [
      { ok: !!row.date, msg: `Row ${rowNum}: Missing date` },
      { ok: !row.date || isValidDate(row.date), msg: `Row ${rowNum}: Invalid date format "${row.date}"` },
      { ok: !!row.timeIn, msg: `Row ${rowNum}: Missing start time` },
      { ok: !row.timeIn || isValidTime(row.timeIn), msg: `Row ${rowNum}: Invalid start time "${row.timeIn}" (must be HH:MM in 15-min increments)` },
      { ok: !!row.timeOut, msg: `Row ${rowNum}: Missing end time` },
      { ok: !row.timeOut || isValidTime(row.timeOut), msg: `Row ${rowNum}: Invalid end time "${row.timeOut}" (must be HH:MM in 15-min increments)` },
      { ok: !!row.project, msg: `Row ${rowNum}: Missing project` },
      { ok: !!row.taskDescription, msg: `Row ${rowNum}: Missing task description` },
    ];

    for (const c of checks) {
      if (!c.ok) {
        errorDetails.push(c.msg);
        hasErrors = true;
      }
    }

    if (row.project && doesProjectNeedTools(row.project) && !row.tool) {
      errorDetails.push(`Row ${rowNum}: Project "${row.project}" requires a tool`);
      hasErrors = true;
    }
    if (row.tool && doesToolNeedChargeCode(row.tool) && !row.chargeCode) {
      errorDetails.push(`Row ${rowNum}: Tool "${row.tool}" requires a charge code`);
      hasErrors = true;
    }
  });

  rows.forEach((row, idx) => {
    if (hasTimeOverlapWithPreviousEntries(idx, rows)) {
      errorDetails.push(`Row ${idx + 1}: Time overlap detected on ${row.date}`);
      hasErrors = true;
    }
  });

  return { hasErrors, errorDetails };
}

// Date insertion via keyboard shortcuts
export type DateInsertContext = { row: number; col: number; timesheetDraftData: TimesheetRow[]; weekdayPattern: boolean };
export function computeDateInsert(
  event: globalThis.KeyboardEvent,
  ctx: DateInsertContext
): { dateToInsert: string | null; preventDefault: boolean } {
  const { row, col, timesheetDraftData, weekdayPattern } = ctx;
  if (col !== 1) return { dateToInsert: null, preventDefault: false };
  const currentRow = timesheetDraftData[row];
  if (!currentRow) return { dateToInsert: null, preventDefault: false };
  const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
  const smartPlaceholder = getSmartPlaceholder(previousRow, timesheetDraftData, weekdayPattern);

  const actions: Array<{ test: () => boolean; compute: () => { dateToInsert: string | null; preventDefault: boolean } }> = [
    {
      test: () => event.key === 'Tab' && event.ctrlKey,
      compute: () => {
        const last = timesheetDraftData.slice(0, row).reverse().find(r => r.date);
        return last?.date
          ? { dateToInsert: incrementDate(last.date, 1, weekdayPattern), preventDefault: true }
          : { dateToInsert: null, preventDefault: false };
      },
    },
    {
      test: () => event.key === 'Tab' && event.shiftKey && !currentRow.date && !!smartPlaceholder,
      compute: () => ({ dateToInsert: incrementDate(smartPlaceholder!, 1, weekdayPattern), preventDefault: true }),
    },
    {
      test: () => event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !currentRow.date && !!smartPlaceholder,
      compute: () => ({ dateToInsert: smartPlaceholder!, preventDefault: true }),
    },
    {
      test: () => event.ctrlKey && (event.key === 't' || event.key === 'T'),
      compute: () => ({ dateToInsert: formatDateForDisplay(new Date()), preventDefault: true }),
    },
  ];

  for (const a of actions) {
    if (a.test()) return a.compute();
  }
  return { dateToInsert: null, preventDefault: false };
}

// Pasting helpers
export function setTempDropdownValue(
  hotInstance: { setCellMeta: (row: number, col: number, key: string, value: unknown) => void; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void },
  row: number,
  col: number,
  value: unknown
) {
  hotInstance.setCellMeta(row, col, 'allowInvalid', true);
  hotInstance.setCellMeta(row, col, 'strict', false);
  hotInstance.setDataAtCell(row, col, value, 'paste');
  setTimeout(() => {
    hotInstance.setCellMeta(row, col, 'allowInvalid', false);
    hotInstance.setCellMeta(row, col, 'strict', true);
  }, 10);
}

export const applyPastedToolAndChargeCode = (
  data: unknown[][],
  startRow: number,
  startCol: number,
  hotInstance: { propToCol: (prop: string) => number | unknown; setCellMeta: (row: number, col: number, key: string, value: unknown) => void; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void }
): void => {
  const toolCol = hotInstance.propToCol('tool');
  const chargeCodeCol = hotInstance.propToCol('chargeCode');

  data.forEach((row, i) => {
    const targetRow = startRow + i;
    if (targetRow < 0 || row.length < 7) return;

    const [_date, _timeIn, _timeOut, _project, tool, chargeCode, _taskDescription] = row;
    const hasTool = tool !== undefined && tool !== null && tool !== '';
    const hasCharge = chargeCode !== undefined && chargeCode !== null && chargeCode !== '';
    if (startCol <= 4 && hasTool && typeof toolCol === 'number' && toolCol >= 0) {
      setTempDropdownValue(hotInstance, targetRow, toolCol, tool);
    }
    if (startCol <= 5 && hasCharge && typeof chargeCodeCol === 'number' && chargeCodeCol >= 0) {
      setTempDropdownValue(hotInstance, targetRow, chargeCodeCol, chargeCode);
    }
  });
};

export const normalizePastedRows = (
  pastedRowIndices: number[],
  currentData: TimesheetRow[],
  hotInstance: { propToCol: (prop: string) => number | unknown; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void; render: () => void }
): { updatedData: TimesheetRow[]; hasChanges: boolean } => {
  const updatedData = [...currentData];
  let hasChanges = false;

  pastedRowIndices.forEach(rowIdx => {
    const row = updatedData[rowIdx];
    if (!row) return;

    const normalizedRow = normalizeRowData(row, (p?: string) => doesProjectNeedTools(p || ''), (t?: string) => doesToolNeedChargeCode(t || ''));

    if (normalizedRow.tool !== row.tool || normalizedRow.chargeCode !== row.chargeCode) {
      hasChanges = true;
      updatedData[rowIdx] = normalizedRow;

      if (normalizedRow.tool !== row.tool) {
        const toolCol = hotInstance.propToCol('tool');
        if (typeof toolCol === 'number' && toolCol >= 0) {
          hotInstance.setDataAtCell(rowIdx, toolCol, normalizedRow.tool, 'paste');
        }
      }
      if (normalizedRow.chargeCode !== row.chargeCode) {
        const chargeCodeCol = hotInstance.propToCol('chargeCode');
        if (typeof chargeCodeCol === 'number' && chargeCodeCol >= 0) {
          hotInstance.setDataAtCell(rowIdx, chargeCodeCol, normalizedRow.chargeCode, 'paste');
        }
      }
    }
  });

  return { updatedData, hasChanges };
};

export type PasteSaveContext = {
  saveTimersRef: MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>;
  pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>;
  saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>;
};

export const savePastedRows = (
  pastedRowIndices: number[],
  normalizedData: TimesheetRow[],
  ctx: PasteSaveContext
): void => {
  pastedRowIndices.forEach(rowIdx => {
    const normalizedRow = normalizedData[rowIdx];
    if (!normalizedRow) return;
    if (normalizedRow.date && normalizedRow.timeIn && normalizedRow.timeOut && normalizedRow.project && normalizedRow.taskDescription) {
      const existingTimer = ctx.saveTimersRef.current.get(rowIdx);
      if (existingTimer) {
        clearTimeout(existingTimer);
        ctx.saveTimersRef.current.delete(rowIdx);
      }
      ctx.pendingSaveRef.current.delete(rowIdx);
      ctx.saveAndReloadRow(normalizedRow, rowIdx).catch(() => void 0);
    }
  });
};

// Receipt verification helper
export function rowsFieldsMatch(a: TimesheetRow, b: TimesheetRow): boolean {
  return (
    a.date === b.date &&
    a.timeIn === b.timeIn &&
    a.timeOut === b.timeOut &&
    a.project === b.project &&
    (a.tool ?? null) === (b.tool ?? null) &&
    (a.chargeCode ?? null) === (b.chargeCode ?? null) &&
    a.taskDescription === b.taskDescription
  );
}
