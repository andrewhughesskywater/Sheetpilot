import { useState, useCallback, useMemo, useEffect, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import { registerEditor } from 'handsontable/editors';
import type { HotTableRef } from '@handsontable/react-wrapper';
import { Alert, Button, FormControlLabel, Switch, CircularProgress } from '@mui/material';
import { PlayArrow as PlayArrowIcon, Edit as EditIcon, Refresh as RefreshIcon, Stop as StopIcon, Save as SaveIcon } from '@mui/icons-material';
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

import { formatTimeInput, normalizeRowData, isValidDate, isValidTime, hasTimeOverlapWithPreviousEntries } from './timesheet.schema';
import { PROJECTS, CHARGE_CODES, getToolsForProject, doesToolNeedChargeCode, doesProjectNeedTools } from '../../config/business-config';
import { submitTimesheet } from './timesheet.submit';
import { batchSaveToDatabase as batchSaveToDatabaseUtil, deleteDraftRows, saveRowToDatabase } from './timesheet.persistence';
import { SpellcheckEditor } from './SpellcheckEditor';
import { detectWeekdayPattern, getSmartPlaceholder, incrementDate, formatDateForDisplay } from '../../utils/smartDate';

// Register all Handsontable modules
registerAllModules();

// Register custom spellcheck editor
registerEditor('spellcheckText', SpellcheckEditor);

// Wrapper functions to match expected signatures
const projectNeedsToolsWrapper = (p?: string) => doesProjectNeedTools(p || '');
const toolNeedsChargeCodeWrapper = (t?: string) => doesToolNeedChargeCode(t || '');

/**
 * Process a single cell change: validate, format, and apply cascading rules
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
  const propStr = typeof prop === 'string' ? prop : typeof prop === 'number' ? String(prop) : '';
  const colIdxRaw = hotInstance.propToCol(propStr);
  const colIdx = typeof colIdxRaw === 'number' ? colIdxRaw : -1;
  
  if (colIdx < 0) {
    return { updatedRow: currentRow, isValid: true, error: null, shouldSkip: true };
  }
  
  let isValid = true;
  let errorMessage = '';
  let shouldClear = false;
  
  // Validate dates
  if (propStr === 'date' && newVal) {
    isValid = isValidDate(String(newVal));
    if (!isValid) {
      errorMessage = `Invalid date format "${newVal}" (must be MM/DD/YYYY)`;
      shouldClear = true;
    }
  }
  // Validate times
  else if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal) {
    isValid = isValidTime(String(newVal));
    if (!isValid) {
      const fieldName = propStr === 'timeIn' ? 'start time' : 'end time';
      errorMessage = `Invalid ${fieldName} "${newVal}" (must be HH:MM in 15-min increments)`;
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
    // Format time inputs
    if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal && newVal !== oldVal) {
      updatedRow = { ...currentRow, [propStr]: formatTimeInput(String(newVal)) };
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

/**
 * Validate row changes for overlaps and mark rows for saving
 */
function validateRowChanges(
  normalizedRows: TimesheetRow[],
  hotInstance: { propToCol: (prop: string) => number | unknown; setCellMeta: (row: number, col: number, key: string, value: unknown) => void }
): {
  rowsToSave: Set<number>;
  overlapErrors: ValidationError[];
} {
  const rowsToSave = new Set<number>();
  const overlapErrors: ValidationError[] = [];
  
  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i];
    
    // Only check overlaps for rows with complete time data
    if (row.date && row.timeIn && row.timeOut) {
      const hasOverlap = hasTimeOverlapWithPreviousEntries(i, normalizedRows);
      
      if (hasOverlap) {
        // Mark overlap error on date column
        const dateColIdx = hotInstance.propToCol('date');
        const timeInColIdx = hotInstance.propToCol('timeIn');
        const timeOutColIdx = hotInstance.propToCol('timeOut');
        
        // Mark all time-related columns as invalid
        [dateColIdx, timeInColIdx, timeOutColIdx].forEach(colIdx => {
          if (typeof colIdx === 'number' && colIdx >= 0) {
            hotInstance.setCellMeta(i, colIdx, 'className', 'htInvalid');
          }
        });
        
        if (typeof dateColIdx === 'number' && dateColIdx >= 0) {
          overlapErrors.push({
            row: i,
            col: dateColIdx,
            field: 'date',
            message: `Time overlap detected on ${row.date || 'this date'}`
          });
        }
        
        // Don't save rows with overlaps
        continue;
      }
    }
    
    // Mark row for saving if it has all required fields and no overlaps
    if (row.date && row.timeIn && row.timeOut && row.project && row.taskDescription) {
      rowsToSave.add(i);
    }
  }
  
  return { rowsToSave, overlapErrors };
}

/**
 * Validate timesheet rows and return validation result
 * @param rows - Array of timesheet rows to validate
 * @returns Object with hasErrors flag and errorDetails array
 */
function validateTimesheetRows(rows: TimesheetRow[]): { hasErrors: boolean; errorDetails: string[] } {
  if (!rows || rows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  // Check if there's any real data (non-empty rows)
  const realRows = rows.filter((row) => {
    return row.date || row.timeIn || row.timeOut || row.project || row.taskDescription;
  });

  if (realRows.length === 0) {
    return { hasErrors: false, errorDetails: [] };
  }

  let hasErrors = false;
  const errorDetails: string[] = [];
  
  for (let i = 0; i < realRows.length; i++) {
    const row = realRows[i];
    const rowNum = i + 1;
    
    // Check required fields
    if (!row.date) {
      errorDetails.push(`Row ${rowNum}: Missing date`);
      hasErrors = true;
    } else if (!isValidDate(row.date)) {
      errorDetails.push(`Row ${rowNum}: Invalid date format "${row.date}"`);
      hasErrors = true;
    }
    
    if (!row.timeIn) {
      errorDetails.push(`Row ${rowNum}: Missing start time`);
      hasErrors = true;
    } else if (!isValidTime(row.timeIn)) {
      errorDetails.push(`Row ${rowNum}: Invalid start time "${row.timeIn}" (must be HH:MM in 15-min increments)`);
      hasErrors = true;
    }
    
    if (!row.timeOut) {
      errorDetails.push(`Row ${rowNum}: Missing end time`);
      hasErrors = true;
    } else if (!isValidTime(row.timeOut)) {
      errorDetails.push(`Row ${rowNum}: Invalid end time "${row.timeOut}" (must be HH:MM in 15-min increments)`);
      hasErrors = true;
    }
    
    if (!row.project) {
      errorDetails.push(`Row ${rowNum}: Missing project`);
      hasErrors = true;
    }
    
    if (!row.taskDescription) {
      errorDetails.push(`Row ${rowNum}: Missing task description`);
      hasErrors = true;
    }
    
    // Check if tool is required
    if (row.project && doesProjectNeedTools(row.project) && !row.tool) {
      errorDetails.push(`Row ${rowNum}: Project "${row.project}" requires a tool`);
      hasErrors = true;
    }
    
    // Check if charge code is required
    if (row.tool && doesToolNeedChargeCode(row.tool) && !row.chargeCode) {
      errorDetails.push(`Row ${rowNum}: Tool "${row.tool}" requires a charge code`);
      hasErrors = true;
    }
  }

  // Check for time overlaps
  for (let i = 0; i < rows.length; i++) {
    if (hasTimeOverlapWithPreviousEntries(i, rows)) {
      const row = rows[i];
      errorDetails.push(`Row ${i + 1}: Time overlap detected on ${row.date}`);
      hasErrors = true;
    }
  }

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

const TimesheetGrid = forwardRef<TimesheetGridHandle, TimesheetGridProps>(function TimesheetGrid({ onChange }, ref) {
  const hotTableRef = useRef<HotTableRef>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false); // Synchronous guard against race conditions
  const { token, isAdmin } = useSession();
  
  // Macro state
  const [macros, setMacros] = useState<MacroRow[]>([]);
  const [showMacroDialog, setShowMacroDialog] = useState(false);
  
  // Dev mode: toggle for using mock website
  const isDev = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV === true || 
                (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.MODE === 'development';
  const [useMockWebsite, setUseMockWebsite] = useState(false);
  
  // Keyboard shortcuts hint dialog state
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  
  // Validation error state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  
  // Track weekday pattern for smart date suggestions
  const weekdayPatternRef = useRef<boolean>(false);
  
  // Track previous cell selection for clearing invalid entries
  const previousSelectionRef = useRef<{ row: number; col: number } | null>(null);
  
  // Track rows pending save - map of row index to row data
  const pendingSaveRef = useRef<Map<number, TimesheetRow>>(new Map());
  
  // Debounce timer refs per row
  const saveTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  
  // Track in-flight save operations per row to prevent race conditions
  const inFlightSavesRef = useRef<Map<number, AbortController>>(new Map());
  
  // Save button state: 'saved' | 'saving' | 'save'
  const [saveButtonState, setSaveButtonState] = useState<'saved' | 'saving' | 'save'>('saved');
  
  // Track rows with unsaved changes (row index -> row data snapshot)
  const unsavedRowsRef = useRef<Map<number, TimesheetRow>>(new Map());
  
  // Track save start time for minimum 1 second duration
  const saveStartTimeRef = useRef<number | null>(null);
  
  // Use preloaded data from context
  const { 
    timesheetDraftData, 
    setTimesheetDraftData, 
    isTimesheetDraftLoading, 
    timesheetDraftError,
    refreshTimesheetDraft,
    refreshArchiveData
  } = useData();

  // Update data using updateData() to preserve table state (selection, scroll position)
  const updateTableData = useCallback((newData: TimesheetRow[]) => {
    if (hotTableRef.current?.hotInstance) {
      // Use requestAnimationFrame to prevent blocking the UI thread
      requestAnimationFrame(() => {
        window.logger?.debug('[TimesheetGrid] Updating table data while preserving state');
        hotTableRef.current?.hotInstance?.updateData(newData);
      });
    }
    onChange?.(newData);
  }, [onChange]);

  // Track if this is the initial load to avoid unnecessary updateData() calls
  const isInitialLoadRef = useRef(true);

  // Update local state when preloaded data changes from external source (e.g., refresh)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      // First load - no need to use updateData(), just let data prop handle it
      isInitialLoadRef.current = false;
      onChange?.(timesheetDraftData);
    } else if (timesheetDraftData && hotTableRef.current?.hotInstance) {
      // Subsequent loads from external source - use updateData() to preserve UI state
      updateTableData(timesheetDraftData);
    }
  }, [timesheetDraftData, updateTableData, onChange]);

  // Load macros on mount
  useEffect(() => {
    const loaded = loadMacros();
    setMacros(loaded);
  }, []);


  // Detect weekday pattern when data changes
  useEffect(() => {
    if (timesheetDraftData && timesheetDraftData.length > 0) {
      weekdayPatternRef.current = detectWeekdayPattern(timesheetDraftData);
    }
  }, [timesheetDraftData]);

  // Restore scrollbar when Macro dialog closes
  // Material-UI Dialog modifies body overflow which can affect Handsontable's scrollbar
  useEffect(() => {
    if (!showMacroDialog) {
      // Dialog just closed - force Handsontable to recalculate layout
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance) {
        // Use a small delay to ensure dialog has fully closed and DOM has updated
        const timer = setTimeout(() => {
          // Ensure body overflow is restored (Material-UI should do this, but ensure it)
          if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = '';
          }
          
          // Trigger a resize event to force Handsontable to recalculate dimensions
          window.dispatchEvent(new Event('resize'));
          
          // Also explicitly render to ensure scrollbar is restored
          hotInstance.render();
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }
  }, [showMacroDialog]);

  // Simplified - removed complex DOM manipulation that was interfering with CSS


  // Batch save all complete rows to database (called on tab navigation or app close)
  // Also syncs database to remove orphaned rows not in Handsontable
  const batchSaveToDatabase = useCallback(async () => {
    await batchSaveToDatabaseUtil(timesheetDraftData);
  }, [timesheetDraftData]);

  // Expose batch save function to parent component via ref
  useImperativeHandle(ref, () => ({
    batchSaveToDatabase
  }), [batchSaveToDatabase]);

  // Flush pending saves on unmount (app close)
  useEffect(() => {
    // Capture refs at effect creation time for cleanup
    const saveTimers = saveTimersRef.current;
    const pendingSaves = pendingSaveRef.current;
    const inFlightSaves = inFlightSavesRef.current;
    
    return () => {
      window.logger?.info('[TimesheetGrid] Component unmounting, flushing pending saves');
      
      // Cancel all in-flight save operations
      inFlightSaves.forEach((controller) => {
        controller.abort();
      });
      inFlightSaves.clear();
      
      // Clear all pending timers
      saveTimers.forEach(timer => clearTimeout(timer));
      saveTimers.clear();
      
      // Flush all pending saves immediately
      const pendingRows = Array.from(pendingSaves.entries());
      for (const [rowIdx, row] of pendingRows) {
        // Save immediately without debounce
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

  // Track rows slated for removal so we can delete from DB after UI removal
  const rowsPendingRemovalRef = useRef<TimesheetRow[]>([]);

  // Capture rows before they are removed (Handsontable passes index and amount)
  const handleBeforeRemoveRow = useCallback((index: number, amount: number) => {
    // Defensive checks
    const start = Math.max(0, index);
    const _end = Math.min(timesheetDraftData.length, index + amount);
    rowsPendingRemovalRef.current = timesheetDraftData.slice(start, _end);
    window.logger?.verbose('[TimesheetGrid] Captured rows for deletion', { start, amount, captured: rowsPendingRemovalRef.current.length });
  }, [timesheetDraftData]);


  // Function to save a row to database and update state
  // Includes cancellation support to prevent race conditions with rapid edits
  // Implements receipt check to verify saved values match current values
  const saveAndReloadRow = useCallback(async (row: TimesheetRow, rowIdx: number) => {
    // Cancel any in-flight save for this row
    const existingController = inFlightSavesRef.current.get(rowIdx);
    if (existingController) {
      existingController.abort();
      window.logger?.debug('Cancelled previous save operation for row', { rowIdx });
    }
    
    // Create new abort controller for this save operation
    const abortController = new AbortController();
    inFlightSavesRef.current.set(rowIdx, abortController);
    
    try {
      const saveResult = await saveRowToDatabase(row);
      
      // Check if operation was aborted
      if (abortController.signal.aborted) {
        window.logger?.debug('Save operation aborted', { rowIdx });
        return;
      }
      
      if (saveResult.success && saveResult.entry) {
        const savedEntry = saveResult.entry;
        
        // RECEIPT CHECK: Compare saved values with current cell values
        const hotInstance = hotTableRef.current?.hotInstance;
        if (hotInstance) {
          const currentData = hotInstance.getSourceData() as TimesheetRow[];
          const currentRow = currentData[rowIdx];
          
          if (!currentRow) {
            window.logger?.warn('Current row not found for receipt check', { rowIdx });
            unsavedRowsRef.current.delete(rowIdx);
            return;
          }
          
          // Compare each field value exactly
          const fieldsMatch = 
            currentRow.date === savedEntry.date &&
            currentRow.timeIn === savedEntry.timeIn &&
            currentRow.timeOut === savedEntry.timeOut &&
            currentRow.project === savedEntry.project &&
            (currentRow.tool ?? null) === (savedEntry.tool ?? null) &&
            (currentRow.chargeCode ?? null) === (savedEntry.chargeCode ?? null) &&
            currentRow.taskDescription === savedEntry.taskDescription;
          
          if (fieldsMatch) {
            // All values match - mark as synced
            unsavedRowsRef.current.delete(rowIdx);
            window.logger?.verbose('Row synced successfully', { 
              id: savedEntry.id,
              rowIdx 
            });
          } else {
            // Values don't match (race condition) - keep as unsaved
            window.logger?.debug('Row values changed during save (race condition)', { 
              rowIdx,
              saved: savedEntry,
              current: currentRow
            });
            // Keep row in unsavedRowsRef - don't delete it
          }
          
          // Update the row data if ID changed or server formatted something
          const needsUpdate = !currentRow.id || currentRow.id !== savedEntry.id ||
                             currentRow.timeIn !== savedEntry.timeIn ||
                             currentRow.timeOut !== savedEntry.timeOut;

          if (needsUpdate) {
             const updatedData = [...currentData];
             updatedData[rowIdx] = { ...currentRow, ...savedEntry };
             
             // Update React state - this will trigger the useEffect to update Handsontable
             setTimesheetDraftData(updatedData);
             onChange?.(updatedData);
             
             window.logger?.verbose('Row saved and state updated', { 
               id: savedEntry.id,
               rowIdx 
             });
          }
        }
      } else {
        window.logger?.warn('Could not save row to database', { 
          error: saveResult.error,
          rowIdx 
        });
        // Keep row as unsaved on error
      }
      
      // Remove from pending saves and in-flight operations
      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      
      // Update save button state based on unsaved rows
      updateSaveButtonState();
    } catch (error) {
      // Don't log aborted errors
      if (abortController.signal.aborted) {
        return;
      }
      
      window.logger?.error('Encountered error saving and reloading row', { 
        rowIdx,
        error: error instanceof Error ? error.message : String(error) 
      });
      pendingSaveRef.current.delete(rowIdx);
      inFlightSavesRef.current.delete(rowIdx);
      
      // Update save button state on error
      updateSaveButtonState();
    }
  }, [onChange, setTimesheetDraftData]);
  
  // Update save button state based on unsaved rows and enforce minimum duration
  const updateSaveButtonState = useCallback(() => {
    const hasUnsavedRows = unsavedRowsRef.current.size > 0;
    const hasInFlightSaves = inFlightSavesRef.current.size > 0;
    
    if (hasInFlightSaves) {
      // If we're saving, ensure minimum 1 second duration
      if (saveStartTimeRef.current === null) {
        saveStartTimeRef.current = Date.now();
        setSaveButtonState('saving');
      }
      
      // Check if minimum duration has passed
      const elapsed = Date.now() - (saveStartTimeRef.current || Date.now());
      const minDuration = 1000; // 1 second
      
      if (elapsed >= minDuration) {
        // Minimum duration met, check final state
        const stillHasInFlight = inFlightSavesRef.current.size > 0;
        const stillHasUnsaved = unsavedRowsRef.current.size > 0;
        
        if (!stillHasInFlight && !stillHasUnsaved) {
          setSaveButtonState('saved');
          saveStartTimeRef.current = null;
        } else if (!stillHasInFlight && stillHasUnsaved) {
          setSaveButtonState('save');
          saveStartTimeRef.current = null;
        }
        // If still has in-flight, keep as 'saving' and check again
      } else {
        // Minimum duration not met, schedule update
        const remaining = minDuration - elapsed;
        setTimeout(() => {
          updateSaveButtonState();
        }, remaining);
      }
    } else {
      // No in-flight saves
      if (hasUnsavedRows) {
        setSaveButtonState('save');
      } else {
        setSaveButtonState('saved');
      }
      saveStartTimeRef.current = null;
    }
  }, []);

  const handleAfterChange = useCallback((changes: HandsontableChange[] | null, source: string) => {
    if (!changes || source === 'loadData') return;
    
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;
    
    const next = [...timesheetDraftData];
    const newErrors: ValidationError[] = [];
    const cellsToClearErrors: Array<{ row: number; col: number }> = [];
    
    // Process each change: validate, auto-clear invalid, prepare valid changes
    for (const change of changes) {
      const [rowIdx] = change;
      if (!next[rowIdx]) continue;
      
      const currentRow = next[rowIdx];
      const result = processCellChange(change, currentRow, hotInstance);
      
      if (result.shouldSkip) {
        if (result.error) {
          newErrors.push(result.error);
          window.logger?.verbose('Auto-cleared invalid data', { 
            rowIdx, 
            field: result.error.field, 
            oldVal: result.updatedRow[result.error.field as keyof TimesheetRow] 
          });
        }
        continue;
      }
      
      // Update row with processed change
      next[rowIdx] = result.updatedRow;
      
      // Track cells that should have errors cleared
      const [_, prop] = change;
      const propStr = typeof prop === 'string' ? prop : typeof prop === 'number' ? String(prop) : '';
      const colIdxRaw = hotInstance.propToCol(propStr);
      const colIdx = typeof colIdxRaw === 'number' ? colIdxRaw : -1;
      if (colIdx >= 0) {
        cellsToClearErrors.push({ row: rowIdx, col: colIdx });
      }
    }
    
    // Normalize all rows
    const normalized = next.map(row => normalizeRowData(row, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper));
    
    // Validate row changes for overlaps and mark rows for saving
    const { rowsToSave, overlapErrors } = validateRowChanges(normalized, hotInstance);
    newErrors.push(...overlapErrors);
    
    // Update state
    setTimesheetDraftData(normalized);
    onChange?.(normalized);
    
    // Update validation errors
    setValidationErrors(prev => {
      let filtered = prev;
      
      // Clear errors for cells that were successfully updated
      if (cellsToClearErrors.length > 0) {
        filtered = filtered.filter(prevErr => 
          !cellsToClearErrors.some(clear => clear.row === prevErr.row && clear.col === prevErr.col)
        );
      }
      
      // Remove old errors that are being replaced
      if (newErrors.length > 0) {
        filtered = filtered.filter(prevErr => 
          !newErrors.some(newErr => newErr.row === prevErr.row && newErr.col === prevErr.col)
        );
      }
      
      return [...filtered, ...newErrors];
    });
    
    // Mark changed rows as unsaved and update save button state
    for (const change of changes) {
      const [rowIdx] = change;
      if (normalized[rowIdx]) {
        // Mark row as having unsaved changes
        unsavedRowsRef.current.set(rowIdx, normalized[rowIdx]);
      }
    }
    
    // Update save button state to 'save' when changes are detected
    if (changes.length > 0) {
      setSaveButtonState('save');
    }
    
    // Bulk update strategy: Collect all changes and send as single batch after debounce
    // This prevents server flooding from drag-fills or rapid edits
    const DEBOUNCE_DELAY = 500;
    
    // Store all rows that need saving
    for (const rowIdx of rowsToSave) {
      const row = normalized[rowIdx];
      pendingSaveRef.current.set(rowIdx, row);
    }
    
    // Clear existing batch save timer
    if (saveTimersRef.current.has(-1)) {
      clearTimeout(saveTimersRef.current.get(-1)!);
    }
    
    // Schedule single debounced batch save for all changed rows
    const batchTimer = setTimeout(async () => {
      const rowsToSaveNow = Array.from(pendingSaveRef.current.entries())
        .map(([rowIdx, row]) => ({ rowIdx, row }))
        .filter(({ row }) => 
          row.date && row.timeIn && row.timeOut && row.project && row.taskDescription
        );
      
      if (rowsToSaveNow.length === 0) {
        saveTimersRef.current.delete(-1);
        return;
      }
      
      window.logger?.debug('[TimesheetGrid] Executing bulk save', { count: rowsToSaveNow.length });
      
      // Set saving state
      if (saveStartTimeRef.current === null) {
        saveStartTimeRef.current = Date.now();
      }
      setSaveButtonState('saving');
      
      // Save all rows in batch (backend handles UPDATE if id exists, INSERT if not)
      const rowsToSaveArray = rowsToSaveNow.map(({ row }) => row);
      await batchSaveToDatabaseUtil(rowsToSaveArray);
      
      // Refresh draft data to sync IDs and get latest data from database
      // This ensures state stays in sync after bulk save
      try {
        const refreshResult = await window.timesheet?.loadDraft();
        if (refreshResult?.success && refreshResult.entries) {
          const hotInstance = hotTableRef.current?.hotInstance;
          if (hotInstance) {
            const rowsWithBlank = refreshResult.entries.length > 0 && Object.keys(refreshResult.entries[0] || {}).length > 0 
              ? [...refreshResult.entries, {}] 
              : [{}];
            setTimesheetDraftData(rowsWithBlank);
            onChange?.(rowsWithBlank);
            hotInstance.loadData(rowsWithBlank);
            
            // Clear all unsaved rows after successful batch save and refresh
            // Since we've refreshed from database, all saved rows should be synced
            unsavedRowsRef.current.clear();
          }
        }
      } catch (error) {
        window.logger?.warn('Could not refresh data after batch save', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      // Clear pending saves
      pendingSaveRef.current.clear();
      saveTimersRef.current.delete(-1);
      
      // Update save button state (with minimum duration enforcement)
      updateSaveButtonState();
    }, DEBOUNCE_DELAY);
    
    // Store batch timer with special key (-1)
    saveTimersRef.current.set(-1, batchTimer);
    
    hotInstance.render();
  }, [timesheetDraftData, setTimesheetDraftData, onChange, saveAndReloadRow, updateSaveButtonState]);

  // Persist row removal to database
  const handleAfterRemoveRow = useCallback(async (index: number, amount: number) => {
    const removedRows = rowsPendingRemovalRef.current || [];
    rowsPendingRemovalRef.current = [];

    // Handsontable may call afterRemoveRow without before hook; fallback to compute if needed
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

    // Sync React state with Handsontable's current data (which has already removed the rows)
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

  // Allow paste to proceed - we'll handle Tool and Charge Code in afterPaste
  const handleBeforePaste = useCallback(() => {
    // Don't modify data before paste - let it all go through first
    // We'll manually apply Tool and Charge Code in handleAfterPaste
    return true;
  }, []);

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
      
      // Apply Tool if present (column 4 in pasted data, index 4)
      if (startCol <= 4 && tool !== undefined && tool !== null && tool !== '') {
        if (typeof toolCol === 'number' && toolCol >= 0) {
          hotInstance.setCellMeta(targetRow, toolCol, 'allowInvalid', true);
          hotInstance.setCellMeta(targetRow, toolCol, 'strict', false);
          hotInstance.setDataAtCell(targetRow, toolCol, tool, 'paste');
          setTimeout(() => {
            hotInstance.setCellMeta(targetRow, toolCol, 'allowInvalid', false);
            hotInstance.setCellMeta(targetRow, toolCol, 'strict', true);
          }, 10);
        }
      }
      
      // Apply Charge Code if present (column 5 in pasted data, index 5)
      if (startCol <= 5 && chargeCode !== undefined && chargeCode !== null && chargeCode !== '') {
        if (typeof chargeCodeCol === 'number' && chargeCodeCol >= 0) {
          hotInstance.setCellMeta(targetRow, chargeCodeCol, 'allowInvalid', true);
          hotInstance.setCellMeta(targetRow, chargeCodeCol, 'strict', false);
          hotInstance.setDataAtCell(targetRow, chargeCodeCol, chargeCode, 'paste');
          setTimeout(() => {
            hotInstance.setCellMeta(targetRow, chargeCodeCol, 'allowInvalid', false);
            hotInstance.setCellMeta(targetRow, chargeCodeCol, 'strict', true);
          }, 10);
        }
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
  const savePastedRows = useCallback((
    pastedRowIndices: number[],
    normalizedData: TimesheetRow[],
    saveTimersRef: React.MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>,
    pendingSaveRef: React.MutableRefObject<Map<number, TimesheetRow>>,
    saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>
  ): void => {
    pastedRowIndices.forEach(rowIdx => {
      const normalizedRow = normalizedData[rowIdx];
      if (!normalizedRow) return;
      
      // Check if row is complete (has all required fields)
      if (normalizedRow.date && normalizedRow.timeIn && normalizedRow.timeOut && 
          normalizedRow.project && normalizedRow.taskDescription) {
        const hasOverlap = hasTimeOverlapWithPreviousEntries(rowIdx, normalizedData);
        
        if (!hasOverlap) {
          // Clear any existing debounce timer for this row
          const existingTimer = saveTimersRef.current.get(rowIdx);
          if (existingTimer) {
            clearTimeout(existingTimer);
            saveTimersRef.current.delete(rowIdx);
          }
          
          // Remove from pending saves if present
          pendingSaveRef.current.delete(rowIdx);
          
          // Immediately save the row without debounce
          window.logger?.verbose('Immediately saving pasted row', { rowIdx });
          saveAndReloadRow(normalizedRow, rowIdx).catch(error => {
            window.logger?.error('Could not save pasted row immediately', {
              rowIdx,
              error: error instanceof Error ? error.message : String(error)
            });
          });
        }
      }
    });
  }, []);

  // After paste completes, manually apply Tool and Charge Code, then normalize and save
  const handleAfterPaste = useCallback((data: unknown[][], coords: { startRow: number; startCol: number; endRow: number; endCol: number }[]) => {
    if (!coords || coords.length === 0) return;
    
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;
    
    const { startRow, startCol } = coords[0];
    
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
      
      savePastedRows(pastedRowIndices, normalizedData, saveTimersRef, pendingSaveRef, saveAndReloadRow);
    }, 100); // Small delay to ensure Handsontable has processed all paste changes
  }, [applyPastedToolAndChargeCode, normalizePastedRows, savePastedRows, saveAndReloadRow, setTimesheetDraftData, onChange]);

  // Handle editor opening - add date picker close handler and dismiss errors
   
  const handleAfterBeginEditing = useCallback((row: number, column: number) => {
    // Dismiss errors for this cell when user starts editing
    setValidationErrors(prev => prev.filter(err => !(err.row === row && err.col === column)));
    
    // CRITICAL: For date editor, attach close handler to prevent stuck editor
    if (column === 0) {
      const hotInstance = hotTableRef.current?.hotInstance;
      const editor = hotInstance?.getActiveEditor();
      if (editor) {
        const dateEditor = editor as DateEditor;
        if (dateEditor.$datePicker && dateEditor.$datePicker._o) {
          const originalOnSelect = dateEditor.$datePicker._o.onSelect;
          dateEditor.$datePicker._o.onSelect = function(this: DatePickerOptions, date: Date) {
            if (originalOnSelect) originalOnSelect.call(this, date);
            // Close editor after date selection
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
      targetRow = selected[0][0]; // First selected row
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

    // Get the source data and update it directly to bypass read-only restrictions
    const sourceData = hotInstance.getSourceData() as TimesheetRow[];
    
    // Ensure the target row exists
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

    // Build the updated row with macro data
    const updatedRow: TimesheetRow = { ...sourceData[targetRow] };
    if (macro.timeIn) updatedRow.timeIn = macro.timeIn;
    if (macro.timeOut) updatedRow.timeOut = macro.timeOut;
    if (macro.project) updatedRow.project = macro.project;
    if (macro.tool !== undefined) updatedRow.tool = macro.tool;
    if (macro.chargeCode !== undefined) updatedRow.chargeCode = macro.chargeCode;
    if (macro.taskDescription) updatedRow.taskDescription = macro.taskDescription;

    // Normalize the row data based on cascading rules (validation/cleanup)
    const normalizedRow = normalizeRowData(updatedRow, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper);
    
    // Update the source data
    sourceData[targetRow] = normalizedRow;
    
    // Load the updated data back into Handsontable (triggers handleAfterChange via 'edit' source)
    hotInstance.loadData(sourceData);
    
    // Update React state to stay in sync
    setTimesheetDraftData(sourceData);
    onChange?.(sourceData);

    // Select the row that was modified
    requestAnimationFrame(() => {
      hotInstance.selectCell(targetRow, 0);
    });
  }, [macros, setTimesheetDraftData, onChange]);


  // Duplicate currently selected row
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

    const selectedRow = selected[0][0];
    const rowData = hotInstance.getDataAtRow(selectedRow);
    
    if (!rowData || rowData.every(cell => !cell)) {
      window.logger?.verbose('Selected row is empty, skipping duplication');
      return;
    }

    window.logger?.info('Duplicating row', { selectedRow });

    // Insert new row below selected row
    hotInstance.alter('insert_row_below', selectedRow, 1);
    
    // Copy all data to new row
    const newRow = selectedRow + 1;
    hotInstance.populateFromArray(newRow, 0, [rowData], undefined, undefined, 'overwrite');
    
    // Select the new row
    hotInstance.selectCell(newRow, 0);
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Only handle shortcuts when Ctrl is pressed
      if (!e.ctrlKey) return;

      // Ctrl+1 through Ctrl+5 for macros
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const macroIndex = parseInt(e.key, 10) - 1;
        applyMacro(macroIndex);
        return;
      }

      // Ctrl+D for duplicate row
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

  // Submit timesheet functionality
  const handleSubmitTimesheet = async () => {
    window.logger?.info('Submit button clicked');
    
    // Prevent multiple simultaneous submissions using synchronous ref check
    if (isProcessingRef.current) {
      window.logger?.warn('Submit ignored - already processing (ref)');
      return;
    }

    // Check if admin (admins cannot submit)
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
    
    // Validate that we have data to submit
    if (!timesheetDraftData || timesheetDraftData.length === 0) {
      const errorMsg = '❌ No timesheet data to submit.';
      window.alert(errorMsg);
      window.logger?.warn('Submit attempted with no data');
      return;
    }
    
    isProcessingRef.current = true; // Set synchronously to block subsequent calls immediately
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
      }, useMockWebsite);
      
      if (res.error) {
        submissionError = new Error(res.error);
        const errorMsg = `❌ Submission failed: ${res.error}`;
        window.alert(errorMsg);
        window.logger?.error('Timesheet submission failed', { error: res.error });
        return;
      }
      
      // Check if submission was successful
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
      // CRITICAL: Always reset processing state, even if an error occurred
      // This ensures the UI doesn't get stuck if the browser is manually closed
      window.logger?.verbose('Resetting submission state in finally block');
      isProcessingRef.current = false; // Clear synchronous guard
      setIsProcessing(false);
      
      // Refresh both timesheet and archive data to ensure they're in sync with database
      // This handles cases where the browser was closed manually or submission was interrupted
      // or when submission had partial success (some entries succeeded, some failed)
      if (!submissionError) {
        window.logger?.verbose('Refreshing data in finally block');
        try {
          await Promise.all([
            refreshTimesheetDraft().catch(err => {
              window.logger?.error('Could not refresh timesheet data in finally block', { 
                error: err instanceof Error ? err.message : String(err) 
              });
            }),
            refreshArchiveData().catch(err => {
              window.logger?.error('Could not refresh archive data in finally block', { 
                error: err instanceof Error ? err.message : String(err) 
              });
            })
          ]);
        } catch (err) {
          window.logger?.error('Error during data refresh in finally block', { 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      }
      
      // Log if refresh failed but submission succeeded
      if (refreshError !== null && !submissionError) {
        // TypeScript narrowing issue - use type assertion
        const err: Error = refreshError as Error;
        const errorMessage = err.message || String(refreshError);
        window.logger?.warn('Submission succeeded but data refresh failed', { 
          error: errorMessage
        });
      }
    }
  };

  // Stop timesheet submission functionality
  const handleStopSubmission = async () => {
    window.logger?.info('Stop button clicked');
    
    if (!isProcessingRef.current) {
      window.logger?.warn('Stop ignored - no submission in progress');
      return;
    }

    try {
      if (window.timesheet?.cancel) {
        const result = await window.timesheet.cancel();
        if (result.success) {
          window.logger?.info('Submission cancelled successfully');
          window.alert('⏹️ Submission cancelled. Entries have been reset to pending status.');
          
          // Reset processing state
          isProcessingRef.current = false;
          setIsProcessing(false);
          
          // Refresh data to show updated status
          await refreshTimesheetDraft();
          await refreshArchiveData();
        } else {
          window.logger?.warn('Could not cancel submission', { error: result.error });
          window.alert(`⚠️ Could not cancel submission: ${result.error || 'Unknown error'}`);
        }
      } else {
        window.logger?.warn('Cancel function not available');
        window.alert('⚠️ Cancel function not available');
      }
    } catch (error) {
      window.logger?.error('Unexpected error during cancellation', { error: error instanceof Error ? error.message : String(error) });
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
    
    // Date column - smart placeholder
    if (col === 0 && !rowData.date) {
      const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
      const smartPlaceholder = getSmartPlaceholder(previousRow, timesheetDraftData, weekdayPatternRef.current);
      return {
        placeholder: smartPlaceholder
      };
    }
    
    // Tool column - dynamic dropdown based on selected project
    if (col === 4) {
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
    
    // Charge code column - conditional based on selected tool
    if (col === 5) {
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

    const [row, col] = selected[0];
    
    // Only handle date column (column 0)
    if (col !== 0) return;

    const rowData = timesheetDraftData[row];
    if (!rowData) return;

    let dateToInsert: string | null = null;
    let shouldPreventDefault = false;

    // Get the smart placeholder for this cell
    const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
    const smartPlaceholder = getSmartPlaceholder(previousRow, timesheetDraftData, weekdayPatternRef.current);

    // Check if the date editor is currently open
    const editor = hotInstance.getActiveEditor();
    const isEditorOpen = editor && editor.isOpened && editor.isOpened();

    // Handle different key combinations
    if (event.key === 'Tab' && event.ctrlKey) {
      // Ctrl+Tab: insert day after the last entry (regardless of smart suggestion)
      const lastEntryWithDate = timesheetDraftData
        .slice(0, row)
        .reverse()
        .find(r => r.date);
      
      if (lastEntryWithDate?.date) {
        dateToInsert = incrementDate(lastEntryWithDate.date, 1, weekdayPatternRef.current);
        shouldPreventDefault = true;
      }
    } else if (event.key === 'Tab' && event.shiftKey) {
      // Shift+Tab: insert day after placeholder
      if (!rowData.date && smartPlaceholder) {
        dateToInsert = incrementDate(smartPlaceholder, 1, weekdayPatternRef.current);
        shouldPreventDefault = true;
      }
    } else if (event.key === 'Tab') {
      // Tab: accept placeholder value (works even when date picker is open)
      if (!rowData.date && smartPlaceholder) {
        dateToInsert = smartPlaceholder;
        shouldPreventDefault = true;
      }
    } else if (event.ctrlKey && event.key === 't') {
      // Insert today's date
      dateToInsert = formatDateForDisplay(new Date());
      shouldPreventDefault = true;
    }

    if (dateToInsert && shouldPreventDefault) {
      event.preventDefault();
      event.stopPropagation();
      
      // If editor is open, close it first
      if (isEditorOpen && editor) {
        editor.finishEditing(false, false);
      }
      
      // Insert the date
      hotInstance.setDataAtCell(row, 0, dateToInsert);
      
      // Move focus to next column (timeIn)
      setTimeout(() => {
        hotInstance.selectCell(row, 1);
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
        {isDev && (
          <FormControlLabel
            control={
              <Switch
                checked={useMockWebsite}
                onChange={(e) => setUseMockWebsite(e.target.checked)}
                size="small"
              />
            }
            label="Use Mock Website (Dev Only)"
            sx={{ mb: 1 }}
          />
        )}
        <div style={{ display: 'flex', gap: 'var(--sp-space-2)', alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="medium"
            startIcon={<RefreshIcon />}
            onClick={async () => {
              window.logger?.info('Refresh button clicked - resetting in-progress entries and reloading table');
              try {
                // First, explicitly reset in-progress entries
                if (window.timesheet?.resetInProgress) {
                  const resetResult = await window.timesheet.resetInProgress();
                  if (resetResult.success) {
                    window.logger?.info('Reset in-progress entries', { count: resetResult.count || 0 });
                    if (resetResult.count && resetResult.count > 0) {
                      window.alert(`✅ Reset ${resetResult.count} in-progress ${resetResult.count === 1 ? 'entry' : 'entries'} to pending status.`);
                    }
                  } else {
                    window.logger?.warn('Could not reset in-progress entries', { error: resetResult.error });
                  }
                }
                
                // Then refresh the table data
                if (window.timesheet?.loadDraft) {
                  const response = await window.timesheet.loadDraft();
                  if (response?.success) {
                    const draftData = response.entries || [];
                    const rowsWithBlank = draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0 
                      ? [...draftData, {}] 
                      : [{}];
                    setTimesheetDraftData(rowsWithBlank);
                    window.logger?.info('Table refreshed successfully', { count: draftData.length });
                  } else {
                    window.logger?.warn('Refresh failed', { error: response?.error });
                    window.alert(`⚠️ Could not load table data: ${response?.error || 'Unknown error'}`);
                  }
                } else {
                  // Fallback to context refresh
                  await refreshTimesheetDraft();
                }
              } catch (error) {
                window.logger?.error('Could not refresh table', { error: error instanceof Error ? error.message : String(error) });
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

