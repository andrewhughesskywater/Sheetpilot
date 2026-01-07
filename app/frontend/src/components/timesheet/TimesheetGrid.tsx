/**
 * @fileoverview TimesheetGrid Component
 * 
 * Core timesheet data entry component using Handsontable for spreadsheet-like data manipulation.
 * Handles real-time validation, auto-save with debouncing, macro support, and timesheet submission.
 * 
 * Key features:
 * - Real-time validation with visual feedback (no blocking validators to prevent editor issues)
 * - Individual row auto-save with debouncing and receipt verification
 * - Smart date suggestions with weekday pattern detection
 * - Time overlap detection to prevent double-booking
 * - Macro system for quick data entry (Ctrl+1-5)
 * - Keyboard shortcuts for date entry (Tab, Shift+Tab, Ctrl+Tab, Ctrl+T)
 * - Cascading business rules (project → tool → charge code dependencies)
 * 
 * Architecture decisions:
 * - Validators removed from column config to prevent editor blocking (validation in afterChange)
 * - Individual row saves instead of batch saves for better UX and data safety
 * - Receipt verification system to handle race conditions during rapid edits
 * - Hidden ID column (col 0) as "Golden Rule" for Handsontable-SQL sync
 */

import { useState, useCallback, useMemo, useEffect, useRef, useImperativeHandle, forwardRef, memo, type MutableRefObject } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import { registerEditor } from 'handsontable/editors';
import type { HotTableRef } from '@handsontable/react-wrapper';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import { useData } from '../../contexts/DataContext';
import { useSession } from '../../contexts/SessionContext';
import { SubmitProgressBar } from '../SubmitProgressBar';
import './TimesheetGrid.css';
import type { TimesheetRow } from './timesheet.schema';
import MacroManagerDialog from './MacroManagerDialog';
import KeyboardShortcutsHintDialog from '../KeyboardShortcutsHintDialog';
import { ValidationErrors } from './ValidationErrors';
import { ValidationErrorDialog } from './ValidationErrorDialog';
import type { MacroRow } from '../../utils/macroStorage';
import { loadMacros, isMacroEmpty } from '../../utils/macroStorage';

type ButtonStatus = 'neutral' | 'ready' | 'warning';

interface ValidationError {
  row: number;
  col: number;
  field: string;
  message: string;
}

// Handsontable type definitions
/**
 * Represents a single cell change in Handsontable afterChange callback
 * Format: [rowIndex, propertyName, oldValue, newValue]
 * Note: Using unknown for prop to match Handsontable's ColumnDataGetterSetterFunction type
 */
type HandsontableChange = [row: number, prop: unknown, oldValue: unknown, newValue: unknown];

/**
 * Date picker options interface for Handsontable date editor
 */
interface DatePickerOptions {
  onSelect?: (this: DatePickerOptions, date: Date) => void;
  [key: string]: unknown;
}

/**
 * Date editor interface for Handsontable date editor
 * Extends the base editor with date picker specific properties
 */
interface DateEditor {
  $datePicker?: {
    _o?: DatePickerOptions;
  };
  isOpened?: () => boolean;
  finishEditing: (restoreOriginalValue: boolean, ctrlDown: boolean) => void;
}

import { formatTimeInput, normalizeRowData, isValidDate, isValidTime, isTimeOutAfterTimeIn, hasTimeOverlapWithPreviousEntries, normalizeDateFormat } from './timesheet.schema';
import { PROJECTS, CHARGE_CODES, getToolsForProject, doesToolNeedChargeCode, doesProjectNeedTools } from '../../../../shared/business-config';
import { submitTimesheet } from './timesheet.submit';
import { batchSaveToDatabase as batchSaveToDatabaseUtil, deleteDraftRows, saveRowToDatabase } from './timesheet.persistence';
import { SpellcheckEditor } from './SpellcheckEditor';
import { detectWeekdayPattern, getSmartPlaceholder, incrementDate, formatDateForDisplay } from '../../utils/smartDate';
import { cancelTimesheetSubmission, loadDraft as loadDraftIpc, resetInProgress as resetInProgressIpc } from '../../services/ipc/timesheet';
import { logError, logInfo, logWarn, logVerbose } from '../../services/ipc/logger';
import { clearInvalidIfPresent } from './utils/hotHelpers';

// Register all Handsontable modules
registerAllModules();

// Register custom spellcheck editor
registerEditor('spellcheckText', SpellcheckEditor);

// Wrapper functions to match expected signatures
const projectNeedsToolsWrapper = (p?: string) => doesProjectNeedTools(p || '');
const toolNeedsChargeCodeWrapper = (t?: string) => doesToolNeedChargeCode(t || '');
// Helpers for afterChange processing
function processChangesList(
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

function applyOverlapValidation(
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

function applyTimeOutValidation(
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

function mergeValidationErrors(
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
// Helper: compute date to insert based on key combo and context
type DateInsertContext = { row: number; col: number; timesheetDraftData: TimesheetRow[]; weekdayPattern: boolean };
function computeDateInsert(
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
      }
    },
    {
      test: () => event.key === 'Tab' && event.shiftKey && !currentRow.date && !!smartPlaceholder,
      compute: () => ({ dateToInsert: incrementDate(smartPlaceholder!, 1, weekdayPattern), preventDefault: true })
    },
    {
      test: () => event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !currentRow.date && !!smartPlaceholder,
      compute: () => ({ dateToInsert: smartPlaceholder!, preventDefault: true })
    },
    {
      test: () => event.ctrlKey && (event.key === 't' || event.key === 'T'),
      compute: () => ({ dateToInsert: formatDateForDisplay(new Date()), preventDefault: true })
    }
  ];

  for (const a of actions) {
    if (a.test()) return a.compute();
  }
  return { dateToInsert: null, preventDefault: false };
}

// Helper: normalize prop and column index
function getPropAndCol(hotInstance: { propToCol: (prop: string) => number | unknown }, prop: unknown) {
  const propStr = typeof prop === 'string' ? prop : typeof prop === 'number' ? String(prop) : '';
  const colIdxRaw = hotInstance.propToCol(propStr);
  const colIdx = typeof colIdxRaw === 'number' ? colIdxRaw : -1;
  return { propStr, colIdx };
}

// Helper: validate date field
function validateDateField(dateStr: string): { isValid: boolean; message: string } {
  const ok = isValidDate(dateStr);
  return { isValid: ok, message: ok ? '' : `Invalid date format "${dateStr}" (must be MM/DD/YYYY or YYYY-MM-DD)` };
}

// Helper: validate time field
function validateTimeField(timeStr: string, fieldName: 'start time' | 'end time'): { isValid: boolean; message: string } {
  const ok = isValidTime(timeStr);
  return { isValid: ok, message: ok ? '' : `Invalid ${fieldName} "${timeStr}" (must be HH:MM in 15-min increments)` };
}

// Helper: validate required field
function validateRequiredField(propStr: string, value: unknown): { isValid: boolean; message: string } {
  if (value) return { isValid: true, message: '' };
  const fieldName = propStr === 'project' ? 'Project' : 'Task Description';
  return { isValid: false, message: `${fieldName} is required` };
}

// Helper: validate a single field value
function validateField(propStr: string, newVal: unknown): { isValid: boolean; shouldClear: boolean; message: string } {
  // Date, time fields: optional if not provided
  if ((propStr === 'date' || propStr === 'timeIn' || propStr === 'timeOut') && !newVal) {
    return { isValid: true, shouldClear: false, message: '' };
  }
  
  if (propStr === 'date') {
    const result = validateDateField(String(newVal));
    return { isValid: result.isValid, shouldClear: !result.isValid, message: result.message };
  }
  
  if (propStr === 'timeIn') {
    const result = validateTimeField(String(newVal), 'start time');
    return { isValid: result.isValid, shouldClear: !result.isValid, message: result.message };
  }
  
  if (propStr === 'timeOut') {
    const result = validateTimeField(String(newVal), 'end time');
    return { isValid: result.isValid, shouldClear: !result.isValid, message: result.message };
  }
  
  // Required fields
  if (propStr === 'project' || propStr === 'taskDescription') {
    const result = validateRequiredField(propStr, newVal);
    return { isValid: result.isValid, shouldClear: !result.isValid, message: result.message };
  }
  
  return { isValid: true, shouldClear: false, message: '' };
}

// Helper: apply project cascading rules
function applyProjectUpdate(project: string, currentRow: TimesheetRow): TimesheetRow {
  return !doesProjectNeedTools(project)
    ? { ...currentRow, project, tool: null, chargeCode: null }
    : { ...currentRow, project };
}

// Helper: apply tool cascading rules
function applyToolUpdate(tool: string, currentRow: TimesheetRow): TimesheetRow {
  return !doesToolNeedChargeCode(tool)
    ? { ...currentRow, tool, chargeCode: null }
    : { ...currentRow, tool };
}

// Helper: apply valid update with cascading rules
function applyValidUpdate(propStr: string, newVal: unknown, oldVal: unknown, currentRow: TimesheetRow): TimesheetRow {
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

/**
 * Process a single cell change with validation, formatting, and cascading rules
 * 
 * Handles all cell-level logic including:
 * - Date and time format validation
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
function processCellChange(
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
      shouldSkip: true
    };
  }

  const updatedRow = isValid ? applyValidUpdate(propStr, oldVal, newVal, currentRow) : currentRow;
  // Clear invalid styling if previously invalid
  hotInstance.setCellMeta(rowIdx, colIdx, 'className', '');
  return { updatedRow, isValid, error: null, shouldSkip: false };
}

/**
 * Validate complete timesheet for submission readiness
 * 
 * Performs comprehensive validation including:
 * - Required field presence (date, times, project, description)
 * - Date and time format validation
 * - Time range validation (end > start)
 * - Business rule compliance (tool/charge code requirements)
 * - Time overlap detection across all rows
 * 
 * Used by submit button to determine if submission can proceed.
 * Only validates rows with at least one field populated (ignores empty rows).
 * 
 * @param rows - Array of timesheet rows to validate
 * @returns Validation result with error flag and detailed error messages
 */
function validateTimesheetRows(rows: TimesheetRow[]): { hasErrors: boolean; errorDetails: string[] } {
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
      { ok: !!row.taskDescription, msg: `Row ${rowNum}: Missing task description` }
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

// NOTE: Column validators removed - they block editor closing and cause navigation issues
// Validation now happens in afterChange hook using setCellMeta for visual feedback

interface TimesheetGridProps {
  onChange?: (rows: TimesheetRow[]) => void;
}

export interface TimesheetGridHandle {
  batchSaveToDatabase: () => Promise<void>;
}

/**
 * Core timesheet grid component with spreadsheet interface
 * 
 * Provides Excel-like data entry with real-time validation, auto-save, and smart features.
 * Uses forwardRef to expose batchSaveToDatabase for parent component control.
 * 
 * Key behaviors:
 * - Individual row auto-save with 500ms debounce
 * - Receipt verification to handle race conditions during rapid edits
 * - Smart date suggestions based on previous entries and patterns
 * - Time overlap detection to prevent double-booking
 * - Cascading dropdowns (project → tool → charge code)
 * - Macro support for quick data entry (Ctrl+1-5)
 * - Keyboard shortcuts for date entry
 * 
 * Performance optimizations:
 * - Lazy component loading
 * - Debounced saves per row
 * - Abort controllers for in-flight saves
 * - updateData() instead of loadData() to preserve UI state
 * 
 * @param props - Component props
 * @param props.onChange - Optional callback fired when data changes
 * @param ref - Forward ref exposing batchSaveToDatabase method
 * @returns Timesheet grid with toolbar and dialogs
 */
const TimesheetGrid = forwardRef<TimesheetGridHandle, TimesheetGridProps>(function TimesheetGrid({ onChange }, ref) {
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false); // Synchronous guard against race conditions
  const { token, isAdmin } = useSession();
  
  // Macro state
  const [macros, setMacros] = useState<MacroRow[]>([]);
  const [showMacroDialog, setShowMacroDialog] = useState(false);
  
  // Keyboard shortcuts hint dialog state
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  
  // Validation error state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  
  const weekdayPatternRef = useRef<boolean>(false);
  const previousSelectionRef = useRef<{ row: number; col: number } | null>(null);
  const pendingSaveRef = useRef<Map<number, TimesheetRow>>(new Map());
  const saveTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const inFlightSavesRef = useRef<Map<number, AbortController>>(new Map());
  const [saveButtonState, setSaveButtonState] = useState<'saved' | 'saving' | 'save'>('saved');
  const unsavedRowsRef = useRef<Map<number, TimesheetRow>>(new Map());
  const saveStartTimeRef = useRef<number | null>(null);
  const hotTableRef = useRef<HotTableRef | null>(null);
  
  const { 
    timesheetDraftData, 
    setTimesheetDraftData, 
    isTimesheetDraftLoading, 
    timesheetDraftError,
    refreshTimesheetDraft,
    refreshArchiveData
  } = useData();

  const updateTableData = useCallback((newData: TimesheetRow[]) => {
    if (hotTableRef.current?.hotInstance) {
      requestAnimationFrame(() => {
        window.logger?.debug('[TimesheetGrid] Updating table data while preserving state');
        hotTableRef.current?.hotInstance?.updateData(newData);
      });
    }
    onChange?.(newData);
  }, [onChange]);

  const isInitialLoadRef = useRef(true);
  const isProcessingChangeRef = useRef(false);
  const previousDataRef = useRef<TimesheetRow[]>(timesheetDraftData);
  useEffect(() => {
    if (isProcessingChangeRef.current) {
      return;
    }
    
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousDataRef.current = timesheetDraftData;
      onChange?.(timesheetDraftData);
    } else if (timesheetDraftData && hotTableRef.current?.hotInstance) {
      const dataChanged = 
        previousDataRef.current.length !== timesheetDraftData.length ||
        JSON.stringify(previousDataRef.current.slice(0, 3)) !== JSON.stringify(timesheetDraftData.slice(0, 3));
      
      if (dataChanged) {
        previousDataRef.current = timesheetDraftData;
        updateTableData(timesheetDraftData);
      }
    }
  }, [timesheetDraftData, updateTableData, onChange]);
  useEffect(() => {
    const loaded = loadMacros();
    setMacros(loaded);
  }, []);

  useEffect(() => {
    if (timesheetDraftData && timesheetDraftData.length > 0) {
      weekdayPatternRef.current = detectWeekdayPattern(timesheetDraftData);
    }
  }, [timesheetDraftData]);

  /**
   * WHY: MUI Dialog modifies body overflow which breaks Handsontable scrollbar.
   * Force layout recalculation after dialog closes to restore scrollbar visibility.
   */
  useEffect(() => {
    if (showMacroDialog) return;

    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const timer = setTimeout(() => {
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
      window.dispatchEvent(new Event('resize'));
      hotInstance.render();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [showMacroDialog]);
  const batchSaveToDatabase = useCallback(async () => {
    await batchSaveToDatabaseUtil(timesheetDraftData);
  }, [timesheetDraftData]);

  // Expose batch save function to parent component via ref
  useImperativeHandle(ref, () => ({
    batchSaveToDatabase
  }), [batchSaveToDatabase]);

  useEffect(() => {
    const saveTimers = saveTimersRef.current;
    const pendingSaves = pendingSaveRef.current;
    const inFlightSaves = inFlightSavesRef.current;
    
    return () => {
      window.logger?.info('[TimesheetGrid] Component unmounting, flushing pending saves');
      
      inFlightSaves.forEach((controller) => {
        controller.abort();
      });
      inFlightSaves.clear();
      
      saveTimers.forEach(timer => clearTimeout(timer));
      saveTimers.clear();
      
      const pendingRows = Array.from(pendingSaves.entries());
      for (const [rowIdx, row] of pendingRows) {
        saveRowToDatabase(row).catch(error => {
          window.logger?.error('Could not flush pending save on unmount', { 
            rowIdx,
            error: error instanceof Error ? error.message : String(error) 
          });
        });
      }
      pendingSaves.clear();
    };
  }, []);

  const rowsPendingRemovalRef = useRef<TimesheetRow[]>([]);
  const handleBeforeRemoveRow = useCallback((index: number, amount: number) => {
    const start = Math.max(0, index);
    const _end = Math.min(timesheetDraftData.length, index + amount);
    rowsPendingRemovalRef.current = timesheetDraftData.slice(start, _end);
    window.logger?.verbose('[TimesheetGrid] Captured rows for deletion', { start, amount, captured: rowsPendingRemovalRef.current.length });
  }, [timesheetDraftData]);
  const updateSaveButtonState = useCallback(() => {
    const hasUnsavedRows = unsavedRowsRef.current.size > 0;
    const hasInFlightSaves = inFlightSavesRef.current.size > 0;
    
    if (hasInFlightSaves) {
      if (saveStartTimeRef.current === null) {
        saveStartTimeRef.current = Date.now();
        setSaveButtonState('saving');
      }
      
      const elapsed = Date.now() - (saveStartTimeRef.current || Date.now());
      const minDuration = 1000;
      
      if (elapsed >= minDuration) {
        const stillHasInFlight = inFlightSavesRef.current.size > 0;
        const stillHasUnsaved = unsavedRowsRef.current.size > 0;
        
        if (!stillHasInFlight && !stillHasUnsaved) {
          setSaveButtonState('saved');
          saveStartTimeRef.current = null;
        } else if (!stillHasInFlight && stillHasUnsaved) {
          setSaveButtonState('save');
          saveStartTimeRef.current = null;
        }
      } else {
        const remaining = minDuration - elapsed;
        setTimeout(() => {
          updateSaveButtonState();
        }, remaining);
      }
    } else {
      if (hasUnsavedRows) {
        setSaveButtonState('save');
      } else {
        setSaveButtonState('saved');
      }
      saveStartTimeRef.current = null;
    }
  }, []);
  
  // Helper: compare row fields for receipt verification
  function rowsFieldsMatch(a: TimesheetRow, b: TimesheetRow): boolean {
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
  
  const saveAndReloadRow = useCallback(async (row: TimesheetRow, rowIdx: number) => {
    const existingController = inFlightSavesRef.current.get(rowIdx);
    if (existingController) {
      existingController.abort();
      window.logger?.debug('Cancelled previous save operation for row', { rowIdx });
    }
    
    const abortController = new AbortController();
    inFlightSavesRef.current.set(rowIdx, abortController);
    
    try {
      const saveResult = await saveRowToDatabase(row);
      
      if (abortController.signal.aborted) {
        window.logger?.debug('Save operation aborted', { rowIdx });
        return;
      }
      
      if (saveResult.success && saveResult.entry) {
        const savedEntry = saveResult.entry;
        
        const hotInstance = hotTableRef.current?.hotInstance;
        if (hotInstance) {
          const currentData = hotInstance.getSourceData() as TimesheetRow[];
          const currentRow = currentData[rowIdx];
          
          if (!currentRow) {
            window.logger?.warn('Current row not found for receipt check', { rowIdx });
            unsavedRowsRef.current.delete(rowIdx);
            return;
          }
          
          if (rowsFieldsMatch(currentRow, savedEntry)) {
            unsavedRowsRef.current.delete(rowIdx);
            window.logger?.verbose('Row synced successfully', { 
              id: savedEntry.id,
              rowIdx 
            });
          } else {
            window.logger?.debug('Row values changed during save (race condition)', { 
              rowIdx,
              saved: savedEntry,
              current: currentRow
            });
          }
          
          // Apply saved entry to component state if needed
          if (!currentRow.id || currentRow.id !== savedEntry.id || currentRow.timeIn !== savedEntry.timeIn || currentRow.timeOut !== savedEntry.timeOut) {
            const updatedData = [...currentData];
            updatedData[rowIdx] = { ...currentRow, ...savedEntry };
            setTimesheetDraftData(updatedData);
            onChange?.(updatedData);
            window.logger?.verbose('Row saved and state updated', { id: savedEntry.id, rowIdx });
          }
        }
      } else {
        window.logger?.warn('Could not save row to database', { 
          error: saveResult.error,
          rowIdx 
        });
      }
      
      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      
      updateSaveButtonState();
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }
      
      window.logger?.error('Encountered error saving and reloading row', { 
        rowIdx,
        error: error instanceof Error ? error.message : String(error) 
      });
      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      
      updateSaveButtonState();
    }
  }, [onChange, setTimesheetDraftData, updateSaveButtonState]);

  const handleAfterChange = useCallback((changes: HandsontableChange[] | null, source: string) => {
    if (!changes || source === 'loadData' || source === 'updateData' || source === 'internal') return;
    
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;
    
    isProcessingChangeRef.current = true;
    
    const { next, newErrors: baseErrors, cellsToClearErrors, needsUpdate } = processChangesList(changes, timesheetDraftData, hotInstance);
    const normalized = next.map(row => normalizeRowData(row, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper));
    const { overlapErrors, overlapClearedRows } = applyOverlapValidation(normalized, hotInstance);
    const { timeOutErrors, timeOutClearedRows, timeOutColIdxForClearing } = applyTimeOutValidation(normalized, hotInstance);
    const newErrors = [...baseErrors, ...overlapErrors, ...timeOutErrors];
    
    const dateColIdx = hotInstance.propToCol('date');
    if (typeof dateColIdx === 'number' && dateColIdx >= 0) {
      for (const rowIdx of overlapClearedRows) cellsToClearErrors.push({ row: rowIdx, col: dateColIdx });
    }
    if (timeOutColIdxForClearing >= 0) {
      for (const rowIdx of timeOutClearedRows) cellsToClearErrors.push({ row: rowIdx, col: timeOutColIdxForClearing });
    }
    
    if (needsUpdate) {
      setTimesheetDraftData(normalized);
      onChange?.(normalized);
    }
    setValidationErrors(prev => mergeValidationErrors(prev, newErrors, cellsToClearErrors));
    for (const change of changes) {
      const [rowIdx] = change;
      if (normalized[rowIdx]) unsavedRowsRef.current.set(rowIdx, normalized[rowIdx]);
    }
    if (changes.length > 0) setSaveButtonState('save');
    
    const DEBOUNCE_DELAY = 500;
    for (const change of changes) {
      const [rowIdx] = change;
      const row = normalized[rowIdx];
      if (!row) continue;
      const hasAnyData = row.date || row.timeIn || row.timeOut || row.project || row.taskDescription;
      if (hasAnyData) {
        const existingTimer = saveTimersRef.current.get(rowIdx);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          void (async () => {
            window.logger?.verbose('[TimesheetGrid] Saving individual row', { rowIdx });
            await saveAndReloadRow(row, rowIdx);
            saveTimersRef.current.delete(rowIdx);
          })();
        }, DEBOUNCE_DELAY);
        saveTimersRef.current.set(rowIdx, timer);
      }
    }
    
    hotInstance.render();
    
    setTimeout(() => {
      isProcessingChangeRef.current = false;
    }, 100);
  }, [timesheetDraftData, setTimesheetDraftData, onChange, saveAndReloadRow]);
  const handleAfterRemoveRow = useCallback(async (index: number, amount: number) => {
    const removedRows = rowsPendingRemovalRef.current || [];
    rowsPendingRemovalRef.current = [];

    /**
     * WHY: Handsontable sometimes calls afterRemoveRow without beforeRemoveRow hook,
     * causing missing row capture. This safety check prevents data loss by detecting
     * the edge case, though it means we skip DB deletion for those rows.
     */
    if (removedRows.length === 0) {
      const start = Math.max(0, index);
      window.logger?.warn('No captured rows before deletion; skipping DB delete', { index: start, amount });
      return;
    }

    // Delete from database
    const rowIds = removedRows
      .filter(row => row?.id !== undefined && row?.id !== null)
      .map(row => row.id!);
    
    if (rowIds.length > 0) {
      const deletedCount = await deleteDraftRows(rowIds);
      window.logger?.info('Rows removed from database successfully', { count: deletedCount, requested: amount });
    }

    /**
     * WHY: Handsontable has already removed rows from its internal data at this point.
     * We need to sync React state to match, otherwise the state becomes stale and causes
     * inconsistencies in other operations.
     */
    if (!hotTableRef.current?.hotInstance) {
      window.logger?.warn('Cannot sync state - Handsontable instance not available');
      return;
    }
    
    const hotData = hotTableRef.current.hotInstance.getSourceData() as TimesheetRow[];
    window.logger?.verbose('Syncing state with Handsontable', {
      hotDataLength: hotData.length,
      oldStateLength: timesheetDraftData.length,
      deletedRowsCount: amount
    });
    
    setTimesheetDraftData(hotData);
    onChange?.(hotData);
  }, [timesheetDraftData, setTimesheetDraftData, onChange]);

  /**
   * WHY: Handsontable's strict validation blocks paste for Tool/Charge Code dropdowns
   * when values aren't in current dropdown source. We bypass this by allowing paste,
   * then manually applying Tool/Charge Code in afterPaste with relaxed validation.
   */
  const handleBeforePaste = useCallback(() => {
    return true;
  }, []);

  // Helper: temporarily relax validation to set dropdown value
  function setTempDropdownValue(
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

  // Apply pasted tool and charge code values to Handsontable
  const applyPastedToolAndChargeCode = useCallback((
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
      
      /**
       * WHY: Temporarily relax validation to allow pasting Tool values that aren't
       * in current project's dropdown. Without this, strict validation blocks the paste.
       * Validation gets re-enabled after 10ms to restore normal behavior.
       */
      const hasTool = tool !== undefined && tool !== null && tool !== '';
      const hasCharge = chargeCode !== undefined && chargeCode !== null && chargeCode !== '';
      if (startCol <= 4 && hasTool && typeof toolCol === 'number' && toolCol >= 0) {
        setTempDropdownValue(hotInstance, targetRow, toolCol, tool);
      }
      if (startCol <= 5 && hasCharge && typeof chargeCodeCol === 'number' && chargeCodeCol >= 0) {
        setTempDropdownValue(hotInstance, targetRow, chargeCodeCol, chargeCode);
      }
    });
  }, []);

  // Normalize pasted rows and update Handsontable if needed
  const normalizePastedRows = useCallback((
    pastedRowIndices: number[],
    currentData: TimesheetRow[],
    hotInstance: { propToCol: (prop: string) => number | unknown; setDataAtCell: (row: number, col: number, value: unknown, source?: string) => void; render: () => void }
  ): { updatedData: TimesheetRow[]; hasChanges: boolean } => {
    const updatedData = [...currentData];
    let hasChanges = false;
    
    pastedRowIndices.forEach(rowIdx => {
      const row = updatedData[rowIdx];
      if (!row) return;
      
      const normalizedRow = normalizeRowData(row, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper);
      
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
  }, []);

  // Save complete pasted rows immediately (without debounce)
  type PasteSaveContext = {
    saveTimersRef: MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>;
    pendingSaveRef: MutableRefObject<Map<number, TimesheetRow>>;
    saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>;
  };
  const savePastedRows = useCallback((
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
        window.logger?.verbose('Immediately saving pasted row', { rowIdx });
        ctx.saveAndReloadRow(normalizedRow, rowIdx).catch(error => {
          window.logger?.error('Could not save pasted row immediately', {
            rowIdx,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    });
  }, []);

  // After paste completes, manually apply Tool and Charge Code, then normalize and save
  const handleAfterPaste = useCallback((data: unknown[][], coords: { startRow: number; startCol: number; endRow: number; endCol: number }[]) => {
    if (!coords || coords.length === 0) return;
    
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;
    
    const firstCoord = coords[0];
    if (!firstCoord) return;
    const { startRow, startCol } = firstCoord;
    
    // First, manually apply Tool and Charge Code from pasted data
    applyPastedToolAndChargeCode(data, startRow, startCol, hotInstance);
    
    // Wait for Handsontable to finish processing the paste, then normalize and validate
    setTimeout(() => {
      const hotInstanceAfterPaste = hotTableRef.current?.hotInstance;
      if (!hotInstanceAfterPaste) return;
      
      const currentData = hotInstanceAfterPaste.getSourceData() as TimesheetRow[];
      const pastedRowIndices: number[] = [];
      
      // Collect all pasted row indices
      for (let i = startRow; i <= startRow + data.length - 1 && i < currentData.length; i++) {
        if (i >= 0) {
          pastedRowIndices.push(i);
        }
      }
      
      // Normalize each pasted row
      const { updatedData, hasChanges } = normalizePastedRows(pastedRowIndices, currentData, hotInstanceAfterPaste);
      
      // Update state if normalization changed anything
      if (hasChanges) {
        setTimesheetDraftData(updatedData);
        onChange?.(updatedData);
        hotInstanceAfterPaste.render();
      }
      
      // Now save all complete pasted rows immediately
      const normalizedData = updatedData.map(row => 
        normalizeRowData(row, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper)
      );
      
      savePastedRows(pastedRowIndices, normalizedData, { saveTimersRef, pendingSaveRef, saveAndReloadRow });
    }, 100);
  }, [applyPastedToolAndChargeCode, normalizePastedRows, savePastedRows, saveAndReloadRow, setTimesheetDraftData, onChange]);

  const handleAfterBeginEditing = useCallback((row: number, column: number) => {
    setValidationErrors(prev => prev.filter(err => !(err.row === row && err.col === column)));
    
    /**
     * WHY: Handsontable's date picker sometimes doesn't close after selection,
     * leaving the editor stuck open and blocking navigation. We override the
     * onSelect callback to forcibly close the editor after date selection.
     */
    if (column === 0) {
      const hotInstance = hotTableRef.current?.hotInstance;
      const editor = hotInstance?.getActiveEditor();
      if (editor) {
        const dateEditor = editor as DateEditor;
        if (dateEditor.$datePicker && dateEditor.$datePicker._o) {
          const originalOnSelect = dateEditor.$datePicker._o.onSelect;
          // WHY: 'this' context must be preserved for picker's internal state management
          // eslint-disable-next-line react-hooks/unsupported-syntax
          dateEditor.$datePicker._o.onSelect = function(this: DatePickerOptions, date: Date) {
            if (originalOnSelect) originalOnSelect.call(this, date);
            setTimeout(() => {
              if (dateEditor.isOpened && dateEditor.isOpened()) {
                dateEditor.finishEditing(false, false);
              }
            }, 50);
          };
        }
      }
    }
  }, []);



  // Apply macro to current or first empty row
  const applyMacro = useCallback((macroIndex: number) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      window.logger?.warn('Cannot apply macro - Handsontable instance not available');
      return;
    }

    const macro = macros[macroIndex];
    if (!macro || isMacroEmpty(macro)) {
      window.logger?.verbose('Macro is empty, skipping application', { macroIndex });
      return;
    }

    // Get current selection or find first empty row
    let targetRow = 0;
    const selected = hotInstance.getSelected();
    if (selected && selected.length > 0) {
      const firstSelection = selected[0];
      if (firstSelection && typeof firstSelection[0] === 'number') {
        targetRow = firstSelection[0]; // First selected row
      }
    } else {
      // Find first empty row
      const sourceData = hotInstance.getSourceData() as TimesheetRow[];
      const emptyRowIndex = sourceData.findIndex(row => 
        !row.date && !row.timeIn && !row.timeOut && !row.project && !row.taskDescription
      );
      if (emptyRowIndex >= 0) {
        targetRow = emptyRowIndex;
      } else {
        targetRow = sourceData.length; // Add to end if no empty row found
      }
    }

    window.logger?.info('Applying macro to row', { macroIndex: macroIndex + 1, targetRow });

    /**
     * WHY: Using setDataAtCell() would trigger validation that might block macro application.
     * Directly modifying source data bypasses these restrictions, then loadData() applies
     * changes with proper validation through the normal afterChange flow.
     */
    const sourceData = hotInstance.getSourceData() as TimesheetRow[];
    
    if (!sourceData[targetRow]) {
      sourceData[targetRow] = {
        date: '',
        timeIn: '',
        timeOut: '',
        project: '',
        tool: null,
        chargeCode: null,
        taskDescription: ''
      };
    }

    const updatedRow: TimesheetRow = { ...sourceData[targetRow] };
    if (macro.timeIn) updatedRow.timeIn = macro.timeIn;
    if (macro.timeOut) updatedRow.timeOut = macro.timeOut;
    if (macro.project) updatedRow.project = macro.project;
    if (macro.tool !== undefined) updatedRow.tool = macro.tool;
    if (macro.chargeCode !== undefined) updatedRow.chargeCode = macro.chargeCode;
    if (macro.taskDescription) updatedRow.taskDescription = macro.taskDescription;

    const normalizedRow = normalizeRowData(updatedRow, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper);
    
    sourceData[targetRow] = normalizedRow;
    
    hotInstance.loadData(sourceData);
    
    setTimesheetDraftData(sourceData);
    onChange?.(sourceData);

    requestAnimationFrame(() => {
      hotInstance.selectCell(targetRow, 1);
    });
  }, [macros, setTimesheetDraftData, onChange]);

  const duplicateSelectedRow = useCallback(() => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) {
      window.logger?.warn('Cannot duplicate row - Handsontable instance not available');
      return;
    }

    const selected = hotInstance.getSelected();
    if (!selected || selected.length === 0) {
      window.logger?.verbose('No row selected for duplication');
      return;
    }

    const firstSelection = selected[0];
    const selectedRow = firstSelection?.[0];
    if (typeof selectedRow !== 'number') return;
    const rowData = hotInstance.getDataAtRow(selectedRow);
    
    if (!rowData || rowData.every(cell => !cell)) {
      window.logger?.verbose('Selected row is empty, skipping duplication');
      return;
    }

    window.logger?.info('Duplicating row', { selectedRow });

    hotInstance.alter('insert_row_below', selectedRow, 1);
    
    const newRow = selectedRow + 1;
    hotInstance.populateFromArray(newRow, 0, [rowData], undefined, undefined, 'overwrite');
    
    hotInstance.selectCell(newRow, 1);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!e.ctrlKey) return;

      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const macroIndex = parseInt(e.key, 10) - 1;
        applyMacro(macroIndex);
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        duplicateSelectedRow();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [applyMacro, duplicateSelectedRow]);
  const handleSubmitTimesheet = async () => {
    window.logger?.info('Submit button clicked');
    
    /**
     * WHY: Use synchronous ref instead of state to prevent race condition where
     * rapid clicks could start multiple submissions before state updates propagate.
     */
    if (isProcessingRef.current) {
      window.logger?.warn('Submit ignored - already processing (ref)');
      return;
    }

    if (isAdmin) {
      const errorMsg = '❌ Admin users cannot submit timesheet entries to SmartSheet.';
      window.alert(errorMsg);
      window.logger?.warn('Admin attempted timesheet submission');
      return;
    }

    if (!token) {
      const errorMsg = '❌ Session token is required. Please log in again.';
      window.alert(errorMsg);
      window.logger?.warn('Submit attempted without session token');
      return;
    }
    
    if (!timesheetDraftData || timesheetDraftData.length === 0) {
      const errorMsg = '❌ No timesheet data to submit.';
      window.alert(errorMsg);
      window.logger?.warn('Submit attempted with no data');
      return;
    }
    
    isProcessingRef.current = true;
    setIsProcessing(true);
    
    let submissionError: Error | null = null;
    let refreshError: Error | null = null;
    
    try {
      const res = await submitTimesheet(token, async () => {
        try {
          await refreshTimesheetDraft();
        } catch (err) {
          refreshError = err instanceof Error ? err : new Error(String(err));
          window.logger?.error('Could not refresh timesheet data after submission', { 
            error: refreshError.message 
          });
        }
        try {
          await refreshArchiveData();
        } catch (err) {
          refreshError = err instanceof Error ? err : new Error(String(err));
          window.logger?.error('Could not refresh archive data after submission', { 
            error: refreshError.message 
          });
        }
      });
      
      if (res.error) {
        submissionError = new Error(res.error);
        const errorMsg = `❌ Submission failed: ${res.error}`;
        window.alert(errorMsg);
        window.logger?.error('Timesheet submission failed', { error: res.error });
        return;
      }
      
      if (res.submitResult && !res.submitResult.ok) {
        const errorDetails = res.submitResult.error || 'Unknown error';
        submissionError = new Error(errorDetails);
        const errorMsg = `❌ Submission failed: ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries processed, ${res.submitResult.removedCount} failed. Error: ${errorDetails}`;
        window.alert(errorMsg);
        window.logger?.error('Timesheet submission partially failed', { 
          successCount: res.submitResult.successCount,
          totalProcessed: res.submitResult.totalProcessed,
          removedCount: res.submitResult.removedCount,
          error: errorDetails
        });
        return;
      }
      
      const submitMsg = res.submitResult ? 
        `✅ Submitted ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries to SmartSheet` : 
        '✅ No pending entries to submit';
      window.alert(submitMsg);
      window.logger?.info('Timesheet submission completed successfully', {
        successCount: res.submitResult?.successCount,
        totalProcessed: res.submitResult?.totalProcessed
      });
    } catch (error) {
      submissionError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = `❌ Unexpected error during submission: ${submissionError.message}`;
      window.logger?.error('Unexpected error during submission', { 
        error: submissionError.message,
        stack: submissionError.stack 
      });
      window.alert(errorMsg);
    } finally {
      /**
       * WHY: Must reset state in finally block to prevent UI lockup if browser closed
       * during submission or if errors occur. Without this, submit button stays disabled.
       */
      window.logger?.verbose('Resetting submission state in finally block');
      isProcessingRef.current = false;
      setIsProcessing(false);
      
      /**
       * WHY: Refresh data even on error to handle partial successes where some entries
       * submitted but others failed. Ensures UI reflects actual database state.
       */
      if (!submissionError) {
        logVerbose('Refreshing data in finally block');
        try {
          await Promise.all([
            refreshTimesheetDraft().catch(err => {
              logError('Could not refresh timesheet data in finally block', { 
                error: err instanceof Error ? err.message : String(err) 
              });
            }),
            refreshArchiveData().catch(err => {
              logError('Could not refresh archive data in finally block', { 
                error: err instanceof Error ? err.message : String(err) 
              });
            })
          ]);
        } catch (err) {
          logError('Error during data refresh in finally block', { 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      }
      
      if (refreshError !== null && !submissionError) {
        const err: Error = refreshError as Error;
        const errorMessage = err.message || String(refreshError);
        logWarn('Submission succeeded but data refresh failed', { 
          error: errorMessage
        });
      }
    }
  };
  const handleStopSubmission = async () => {
    logInfo('Stop button clicked');
    
    if (!isProcessingRef.current) {
      logWarn('Stop ignored - no submission in progress');
      return;
    }

    try {
      const result = await cancelTimesheetSubmission();
      if (result.success) {
          logInfo('Submission cancelled successfully');
          window.alert('⏹️ Submission cancelled. Entries have been reset to pending status.');
          
          // Reset processing state
          isProcessingRef.current = false;
          setIsProcessing(false);
          
          // Refresh data to show updated status
          await refreshTimesheetDraft();
          await refreshArchiveData();
      } else {
        logWarn('Could not cancel submission', { error: result.error });
        window.alert(`⚠️ Could not cancel submission: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      logError('Unexpected error during cancellation', { error: error instanceof Error ? error.message : String(error) });
      window.alert(`❌ Unexpected error during cancellation: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Cell-level configuration (cascades over column config)
  const cellsFunction = useCallback((row: number, col: number) => {
    // Add bounds checking to prevent out-of-bounds access
    if (row < 0 || row >= timesheetDraftData.length) {
      return {};
    }
    
    const rowData = timesheetDraftData[row];
    if (!rowData) {
      return {};
    }
    
    // Date column (col 1, after hidden ID at col 0) - smart placeholder
    if (col === 1 && !rowData.date) {
      const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
      const smartPlaceholder = getSmartPlaceholder(previousRow, timesheetDraftData, weekdayPatternRef.current);
      return {
        placeholder: smartPlaceholder
      };
    }
    
    // Tool column (col 5, after ID/Date/TimeIn/TimeOut/Project) - dynamic dropdown based on selected project
    if (col === 5) {
      const project = rowData?.project;
      if (!project || !doesProjectNeedTools(project)) {
        return { 
          className: 'htDimmed', 
          placeholder: project ? 'N/A' : '',
          readOnly: false,
          source: []
        };
      }
      return { 
        source: [...getToolsForProject(project)], 
        placeholder: 'Pick a Tool',
        readOnly: false
      };
    }
    
    // Charge code column (col 6) - conditional based on selected tool
    if (col === 6) {
      const tool = rowData?.tool;
      if (!tool || !doesToolNeedChargeCode(tool)) {
        return { 
          className: 'htDimmed', 
          placeholder: tool ? 'N/A' : '',
          readOnly: false
        };
      }
      return { 
        placeholder: 'Pick a Charge Code',
        readOnly: false
      };
    }
    
    return {};
  }, [timesheetDraftData]);

  // Keyboard shortcuts for date column
  const handleBeforeKeyDown = useCallback((event: globalThis.KeyboardEvent) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const selected = hotInstance.getSelected();
    if (!selected || selected.length === 0) return;

    const firstSelection = selected[0];
    if (!firstSelection) return;
    const [row, col] = firstSelection;
    if (typeof row !== 'number' || typeof col !== 'number') return;
    
    // Check if the date editor is currently open
    const editor = hotInstance.getActiveEditor();
    const isEditorOpen = editor && editor.isOpened && editor.isOpened();
    
    const { dateToInsert, preventDefault } = computeDateInsert(event, { row, col, timesheetDraftData, weekdayPattern: weekdayPatternRef.current });
    if (dateToInsert && preventDefault) {
      event.preventDefault();
      event.stopPropagation();
      
      // If editor is open, close it first
      if (isEditorOpen && editor) {
        editor.finishEditing(false, false);
      }
      
      // Insert the date (column 1)
      hotInstance.setDataAtCell(row, 1, dateToInsert);
      
      // Move focus to next column (timeIn at column 2)
      setTimeout(() => {
        hotInstance.selectCell(row, 2);
      }, 10);
    }
  }, [timesheetDraftData]);

  // Handle cell selection changes - clear invalid entries when user moves away
  const handleAfterSelection = useCallback((row: number, col: number) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    // Validate row and col are valid unsigned integers (Handsontable can pass -1 for headers)
    if (row < 0 || col < 0 || !Number.isInteger(row) || !Number.isInteger(col)) {
      return;
    }

    const prevSelection = previousSelectionRef.current;
    
    // If user moved away from a cell
    if (prevSelection && (prevSelection.row !== row || prevSelection.col !== col)) {
      // Validate previous selection coordinates before using them
      if (prevSelection.row < 0 || prevSelection.col < 0 || 
          !Number.isInteger(prevSelection.row) || !Number.isInteger(prevSelection.col)) {
        // Update current selection and skip invalid cell cleanup
        previousSelectionRef.current = { row, col };
        return;
      }
      
      // Check if previous cell was invalid
      const cellMeta = hotInstance.getCellMeta(prevSelection.row, prevSelection.col);
      if (cellMeta.className === 'htInvalid') {
        // Clear the invalid cell value after a brief delay
        setTimeout(() => {
          hotInstance.setDataAtCell(prevSelection.row, prevSelection.col, '', 'clearInvalid');
          
          // Clear the validation error styling
          hotInstance.setCellMeta(prevSelection.row, prevSelection.col, 'className', '');
          hotInstance.render();
          
          // Remove the error from state
          setValidationErrors(prev => 
            prev.filter(err => !(err.row === prevSelection.row && err.col === prevSelection.col))
          );
          
          window.logger?.verbose('Cleared invalid entry', { row: prevSelection.row, col: prevSelection.col });
        }, 100);
      }
    }
    
    // Update previous selection
    previousSelectionRef.current = { row, col };
  }, []);

  // Column definitions - NO validators (validation happens in afterChange to prevent editor blocking)
  // CRITICAL: ID column must be first and hidden - this is the "Golden Rule" for Handsontable-SQL sync
  const columnDefinitions = useMemo(() => [
    { data: 'id', title: 'ID', type: 'numeric', width: 0.1, readOnly: true }, // Hidden ID column for row identity
    { data: 'date', title: 'Date', type: 'date', dateFormat: 'MM/DD/YYYY', placeholder: 'MM/DD/YYYY', className: 'htCenter' },
    { data: 'timeIn', title: 'Start Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
    { data: 'timeOut', title: 'End Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
    { data: 'project', 
      title: 'Project', 
      type: 'dropdown', 
      source: [...PROJECTS], 
      strict: true, 
      allowInvalid: false, 
      placeholder: 'Pick a project', 
      className: 'htCenter',
      trimDropdown: false
    },
    { data: 'tool', title: 'Tool', type: 'dropdown', source: [], strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'chargeCode', title: 'Charge Code', type: 'dropdown', source: [...CHARGE_CODES], strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'taskDescription', title: 'Task Description', editor: 'spellcheckText', placeholder: '', className: 'htLeft', maxLength: 120 }
  ], []);

  // Validate timesheet data for button status - MUST be before early returns
  const buttonStatus: ButtonStatus = useMemo(() => {
    if (!timesheetDraftData || timesheetDraftData.length === 0) {
      return 'neutral';
    }

    const validation = validateTimesheetRows(timesheetDraftData);

    // Log validation errors for debugging
    if (validation.hasErrors) {
      window.logger?.warn('Timesheet validation errors detected', { 
        errorCount: validation.errorDetails.length,
        errors: validation.errorDetails 
      });
      return 'warning';
    }

    window.logger?.debug('All timesheet validations passed - button is ready');
    return 'ready';
  }, [timesheetDraftData]);

  // Manual save handler - saves all unsaved rows
  const handleManualSave = useCallback(async () => {
    if (saveButtonState !== 'save') return;
    
    const unsavedRows = Array.from(unsavedRowsRef.current.entries());
    if (unsavedRows.length === 0) return;
    
    // Set saving state
    if (saveStartTimeRef.current === null) {
      saveStartTimeRef.current = Date.now();
    }
    setSaveButtonState('saving');
    
    // Save all unsaved rows individually to get receipt checks
    const savePromises = unsavedRows.map(([rowIdx, row]) => 
      saveAndReloadRow(row, rowIdx).catch(error => {
        window.logger?.error('Could not save row during manual save', {
          rowIdx,
          error: error instanceof Error ? error.message : String(error)
        });
      })
    );
    
    await Promise.all(savePromises);
    
    // Update button state (with minimum duration enforcement)
    updateSaveButtonState();
  }, [saveButtonState, saveAndReloadRow, updateSaveButtonState]);

  if (isTimesheetDraftLoading) {
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large">Loading draft data...</p>
      </div>
    );
  }

  if (timesheetDraftError) {
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large timesheet-error-message">
          Error loading timesheet data: {timesheetDraftError}
        </p>
      </div>
    );
  }

  return (
    <div className="timesheet-page">
      <div className="timesheet-header">
        {/* Save Button */}
        <Button
          className="save-button"
          variant="contained"
          onClick={handleManualSave}
          disabled={saveButtonState === 'saving' || saveButtonState === 'saved'}
          startIcon={
            saveButtonState === 'saving' ? (
              <CircularProgress size={16} sx={{ color: 'inherit' }} />
            ) : (
              <SaveIcon />
            )
          }
          sx={{
            backgroundColor: 
              saveButtonState === 'saved' 
                ? '#4CAF50' // Green for "Saved" state
                : saveButtonState === 'saving'
                ? 'var(--md-sys-color-primary)'
                : '#2196F3', // Blue for "Save" state
            color: 
              saveButtonState === 'saved'
                ? '#FFFFFF' // White text on green
                : '#FFFFFF', // White text for blue/primary backgrounds
            '&:disabled': {
              backgroundColor: 
                saveButtonState === 'saved'
                  ? '#4CAF50' // Green for "Saved" state
                  : saveButtonState === 'saving'
                  ? 'var(--md-sys-color-primary)'
                  : '#2196F3',
              color: '#FFFFFF',
            },
            textTransform: 'none',
            minWidth: 120,
          }}
        >
          {saveButtonState === 'saved' 
            ? 'Saved' 
            : saveButtonState === 'saving' 
            ? 'Saving' 
            : 'Save'}
        </Button>
        
        {isAdmin && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Admin users cannot submit timesheet entries to SmartSheet.
          </Alert>
        )}
      </div>
      
      {/* Macro Toolbar */}
      <div className="macro-toolbar">
        {macros.map((macro, index) => {
          const isEmpty = isMacroEmpty(macro);
          const displayName = macro.name?.trim() || `Macro ${index + 1}`;
          const label = isEmpty 
            ? `Macro ${index + 1}`
            : displayName.length > 30
              ? `${displayName.slice(0, 30)}...`
              : displayName;
          
          const tooltipText = isEmpty 
            ? `Macro ${index + 1} not configured`
            : `${displayName}${macro.taskDescription ? ` - ${macro.taskDescription}` : ''}`;
          
          return (
            <Button
              key={index}
              className="macro-button"
              variant="outlined"
              size="small"
              disabled={isEmpty}
              onClick={() => applyMacro(index)}
              title={tooltipText}
            >
              <span className="macro-button-label">
                {label}
                <span className="macro-button-shortcut">Ctrl+{index + 1}</span>
              </span>
            </Button>
          );
        })}
        <Button
          className="macro-edit-button"
          variant="text"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setShowMacroDialog(true)}
        >
          Edit Macros...
        </Button>
      </div>

      <HotTable
        ref={hotTableRef}
        id="sheetpilot-timesheet-grid"
        data={timesheetDraftData}
        columns={columnDefinitions}
        cells={cellsFunction}
        beforeRemoveRow={handleBeforeRemoveRow}
        afterChange={handleAfterChange}
        afterRemoveRow={handleAfterRemoveRow}
        beforePaste={handleBeforePaste}
        afterPaste={handleAfterPaste}
        afterBeginEditing={handleAfterBeginEditing}
        beforeKeyDown={handleBeforeKeyDown}
        afterSelection={handleAfterSelection}
        themeName="ht-theme-horizon"
        width="100%"
        rowHeaders={true}
        colHeaders={true}
        customBorders={[]}
        contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo', '---------', 'copy', 'cut']}
        manualColumnResize={true}
        manualRowResize={true}
        stretchH="all"
        licenseKey="non-commercial-and-evaluation"
        minSpareRows={1}
        readOnly={false}
        fillHandle={true}
        autoWrapRow={false}
        autoWrapCol={false}
        fragmentSelection={true}
        disableVisualSelection={false}
        selectionMode="range"
        outsideClickDeselects={true}
        viewportRowRenderingOffset={24}
        columnSorting={{
          indicator: true,
          headerAction: true,
          sortEmptyCells: true
        }}
        tabNavigation={true}
        navigableHeaders={true}
        copyPaste={true}
        search={true}
        enterMoves={{ row: 1, col: 0 }}
        tabMoves={{ row: 0, col: 1 }}
        invalidCellClassName="htInvalid"
      />
      <div className="timesheet-footer">
        <ValidationErrors
          errors={validationErrors}
          onShowAllErrors={() => setShowErrorDialog(true)}
        />
        <div className="timesheet-footer-actions">
          <Button
            variant="outlined"
            size="medium"
            startIcon={<RefreshIcon />}
            onClick={async () => {
              logInfo('Refresh button clicked - resetting in-progress entries and reloading table');
              try {
                // First, explicitly reset in-progress entries
                const resetResult = await resetInProgressIpc();
                if (resetResult.success) {
                  logInfo('Reset in-progress entries', { count: resetResult.count || 0 });
                  if (resetResult.count && resetResult.count > 0) {
                    window.alert(`✅ Reset ${resetResult.count} in-progress ${resetResult.count === 1 ? 'entry' : 'entries'} to pending status.`);
                  }
                } else if (resetResult.error) {
                  logWarn('Could not reset in-progress entries', { error: resetResult.error });
                }
                
                // Then refresh the table data
                const response = await loadDraftIpc();
                if (response?.success) {
                  const draftData = response.entries || [];
                  const rowsWithBlank =
                    draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0 ? [...draftData, {}] : [{}];
                  setTimesheetDraftData(rowsWithBlank);
                  logInfo('Table refreshed successfully', { count: draftData.length });
                } else {
                  logWarn('Refresh failed', { error: response?.error });
                  window.alert(`⚠️ Could not load table data: ${response?.error || 'Unknown error'}`);
                }
              } catch (error) {
                logError('Could not refresh table', { error: error instanceof Error ? error.message : String(error) });
                window.alert(`❌ Could not refresh table: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
            disabled={isTimesheetDraftLoading}
            sx={{
              minWidth: 'auto',
              textTransform: 'none'
            }}
          >
            Refresh
          </Button>
          <SubmitProgressBar
            status={buttonStatus}
            onSubmit={handleSubmitTimesheet}
            isSubmitting={isProcessing}
            icon={<PlayArrowIcon />}
            disabled={isAdmin}
          >
            Submit Timesheet
          </SubmitProgressBar>
          {isProcessing && (
            <Button
              variant="contained"
              size="large"
              color="error"
              startIcon={<StopIcon />}
              onClick={handleStopSubmission}
              sx={{ minWidth: 200 }}
            >
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Validation Error Dialog */}
      <ValidationErrorDialog
        open={showErrorDialog}
        errors={validationErrors}
        onClose={() => setShowErrorDialog(false)}
      />

      {/* Macro Manager Dialog */}
      <MacroManagerDialog
        open={showMacroDialog}
        onClose={() => setShowMacroDialog(false)}
        onSave={(savedMacros) => {
          setMacros(savedMacros);
          window.logger?.info('Macros updated', { count: savedMacros.filter(m => !isMacroEmpty(m)).length });
        }}
      />

      {/* Keyboard Shortcuts Hint Dialog */}
      <KeyboardShortcutsHintDialog
        open={showShortcutsHint}
        onClose={() => setShowShortcutsHint(false)}
      />
    </div>
  );
});

// Wrap with React.memo to prevent unnecessary re-renders
export default memo(TimesheetGrid);

