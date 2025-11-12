import { useState, useCallback, useMemo, useEffect, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import { registerEditor } from 'handsontable/editors';
import type { HotTableRef } from '@handsontable/react-wrapper';
import { Alert, Button } from '@mui/material';
import { PlayArrow as PlayArrowIcon, Edit as EditIcon } from '@mui/icons-material';
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

import { formatTimeInput, normalizeRowData, isValidDate, isValidTime, hasTimeOverlapWithPreviousEntries } from './timesheet.schema';
import { PROJECTS, CHARGE_CODES, getToolsForProject, doesToolNeedChargeCode, doesProjectNeedTools } from '../../config/business-config';
import { submitTimesheet } from './timesheet.submit';
import { saveLocalBackup, batchSaveToDatabase as batchSaveToDatabaseUtil, deleteDraftRows } from './timesheet.persistence';
import { SpellcheckEditor } from './SpellcheckEditor';
import { detectWeekdayPattern, getSmartPlaceholder, incrementDate, formatDateForDisplay } from '../../utils/smartDate';

// Register all Handsontable modules
registerAllModules();

// Register custom spellcheck editor
registerEditor('spellcheckText', SpellcheckEditor);

// Wrapper functions to match expected signatures
const projectNeedsToolsWrapper = (p?: string) => doesProjectNeedTools(p || '');
const toolNeedsChargeCodeWrapper = (t?: string) => doesToolNeedChargeCode(t || '');

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
  const isDirtyRef = useRef(false); // Track if data has changed since last save
  const { token, isAdmin } = useSession();
  
  // Macro state
  const [macros, setMacros] = useState<MacroRow[]>([]);
  const [showMacroDialog, setShowMacroDialog] = useState(false);
  
  // Keyboard shortcuts hint dialog state
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  
  // Validation error state
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  
  // Track weekday pattern for smart date suggestions
  const weekdayPatternRef = useRef<boolean>(false);
  
  // Track previous cell selection for clearing invalid entries
  const previousSelectionRef = useRef<{ row: number; col: number } | null>(null);
  
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

  // Show keyboard shortcuts hint on mount
  useEffect(() => {
    // TEMPORARY: Force show for demo
    setShowShortcutsHint(true);
  }, []);

  // Detect weekday pattern when data changes
  useEffect(() => {
    if (timesheetDraftData && timesheetDraftData.length > 0) {
      weekdayPatternRef.current = detectWeekdayPattern(timesheetDraftData);
    }
  }, [timesheetDraftData]);

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

  // Save to database on unmount (app close)
  useEffect(() => {
    return () => {
      // Synchronously save on unmount - this runs before the component is destroyed
      window.logger?.info('[TimesheetGrid] Component unmounting, triggering batch save');
      batchSaveToDatabase();
    };
  }, [batchSaveToDatabase]);

  // Auto-save to database every 5 minutes (only if dirty)
  useEffect(() => {
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    window.logger?.info('[TimesheetGrid] Setting up 5-minute auto-save interval');
    const intervalId = setInterval(() => {
      if (isDirtyRef.current) {
        window.logger?.info('[TimesheetGrid] 5-minute interval triggered, data is dirty, saving to database');
        batchSaveToDatabase();
        isDirtyRef.current = false; // Clear dirty flag after save
      } else {
        window.logger?.debug('[TimesheetGrid] 5-minute interval triggered, data is clean, skipping save');
      }
    }, FIVE_MINUTES);

    return () => {
      window.logger?.info('[TimesheetGrid] Clearing 5-minute auto-save interval');
      clearInterval(intervalId);
    };
  }, [batchSaveToDatabase]);

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


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAfterChange = useCallback((changes: any, source: string) => {
    if (!changes || source === 'loadData') return;
    
    // Mark data as dirty when changes occur
    isDirtyRef.current = true;
    
    const hotInstance = hotTableRef.current?.hotInstance;
    const next = [...timesheetDraftData];
    
    for (const change of changes) {
      const [rowIdx, prop, oldVal, newVal] = change;
      if (!next[rowIdx]) continue;
      
      const currentRow = next[rowIdx];
      const propStr = String(prop);
      
      // Format time inputs
      if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal && newVal !== oldVal) {
        next[rowIdx] = { ...currentRow, [propStr]: formatTimeInput(String(newVal)) };
        continue;
      }
      
      // Cascade project → tool → chargeCode
      if (propStr === 'project' && newVal !== oldVal) {
        const project = String(newVal ?? '');
        next[rowIdx] = !doesProjectNeedTools(project)
          ? { ...currentRow, project, tool: null, chargeCode: null }
          : { ...currentRow, project };
      } else if (propStr === 'tool' && newVal !== oldVal) {
        const tool = String(newVal ?? '');
        next[rowIdx] = !doesToolNeedChargeCode(tool)
          ? { ...currentRow, tool, chargeCode: null }
          : { ...currentRow, tool };
      } else {
        next[rowIdx] = { ...currentRow, [propStr]: newVal ?? '' };
      }
    }
    
    const normalized = next.map(row => normalizeRowData(row, projectNeedsToolsWrapper, toolNeedsChargeCodeWrapper));
    setTimesheetDraftData(normalized);
    onChange?.(normalized);
    saveLocalBackup(normalized);

    // VALIDATION: Mark cells as invalid AFTER changes (doesn't block editing)
    if (hotInstance) {
      const newErrors: ValidationError[] = [];
      
      for (const change of changes) {
        const [rowIdx, prop, , newVal] = change;
        const propStr = String(prop);
        let isValid = true;
        let errorMessage = '';

        // Validate dates
        if (propStr === 'date' && newVal) {
          isValid = isValidDate(String(newVal));
          if (!isValid) {
            errorMessage = `Invalid date format "${newVal}" (must be MM/DD/YYYY)`;
          }
        }
        // Validate times and check for overlaps
        else if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal) {
          isValid = isValidTime(String(newVal));
          if (!isValid) {
            const fieldName = propStr === 'timeIn' ? 'start time' : 'end time';
            errorMessage = `Invalid ${fieldName} "${newVal}" (must be HH:MM in 15-min increments)`;
          } else if (normalized[rowIdx]) {
            // Check for time overlaps
            if (hasTimeOverlapWithPreviousEntries(rowIdx, normalized)) {
              isValid = false;
              const rowData = normalized[rowIdx];
              errorMessage = `Time overlap detected on ${rowData.date || 'this date'}`;
            }
          }
        }
        // Validate required fields
        else if ((propStr === 'project' || propStr === 'taskDescription') && !newVal) {
          isValid = false;
          const fieldName = propStr === 'project' ? 'Project' : 'Task Description';
          errorMessage = `${fieldName} is required`;
        }

        // Mark cell as invalid or clear the mark
        const colIdx = hotInstance.propToCol(propStr);
        if (typeof colIdx === 'number' && colIdx >= 0) {
          if (!isValid) {
            hotInstance.setCellMeta(rowIdx, colIdx, 'className', 'htInvalid');
            newErrors.push({
              row: rowIdx,
              col: colIdx,
              field: propStr,
              message: errorMessage
            });
          } else {
            hotInstance.setCellMeta(rowIdx, colIdx, 'className', '');
            // Remove this cell's error from the list if it was previously invalid
            setValidationErrors(prev => prev.filter(err => !(err.row === rowIdx && err.col === colIdx)));
          }
        }
      }
      
      // Add new errors to state
      if (newErrors.length > 0) {
        setValidationErrors(prev => {
          // Remove duplicates and add new errors
          const filtered = prev.filter(prevErr => 
            !newErrors.some(newErr => newErr.row === prevErr.row && newErr.col === prevErr.col)
          );
          return [...filtered, ...newErrors];
        });
      }
      
      hotInstance.render();
    }
  }, [timesheetDraftData, setTimesheetDraftData, onChange]);

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
    saveLocalBackup(hotData);
    onChange?.(hotData);
  }, [timesheetDraftData, setTimesheetDraftData, onChange]);

  // Normalize pasted data and handle via afterPaste to bypass read-only restrictions
  const handleBeforePaste = useCallback((data: unknown[][]) => {
    // Normalize data based on cascading rules before paste
    data.forEach((row, i) => {
      if (row.length >= 7) {
        const [date, timeIn, timeOut, project, tool, chargeCode, taskDescription] = row;
        
        let normalizedTool = tool;
        let normalizedChargeCode = chargeCode;
        
        if (typeof project === 'string' && !doesProjectNeedTools(project)) {
          normalizedTool = null;
          normalizedChargeCode = null;
        } else if (typeof tool === 'string' && !doesToolNeedChargeCode(tool)) {
          normalizedChargeCode = null;
        }
        
        data[i] = [date, timeIn, timeOut, project, normalizedTool, normalizedChargeCode, taskDescription];
      }
    });
    return true;
  }, []);

  // After paste completes, manually apply Tool and ChargeCode to bypass read-only
  const handleAfterPaste = useCallback((data: unknown[][], coords: { startRow: number; startCol: number; endRow: number; endCol: number }[]) => {
    if (!coords || coords.length === 0) return;
    
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;
    
    const { startRow, startCol } = coords[0];
    
    // Only handle full row pastes (starting from column 0)
    if (startCol !== 0) return;
    
    // For each pasted row, manually set Tool and ChargeCode if they were skipped due to read-only
    data.forEach((row, i) => {
      const targetRow = startRow + i;
      if (row.length >= 7) {
        const [_date, _timeIn, _timeOut, project, tool, chargeCode, _taskDescription] = row;
        
        // Only apply if project exists and needs tools
        if (project && doesProjectNeedTools(project as string)) {
          const toolCol = hotInstance.propToCol('tool');
          const currentTool = hotInstance.getDataAtCell(targetRow, toolCol as number);
          
          // If tool wasn't set (because it was read-only), set it now
          if (!currentTool && tool) {
            hotInstance.setDataAtCell(targetRow, toolCol as number, tool, 'paste');
          }
          
          // Similarly for charge code
          if (tool && doesToolNeedChargeCode(tool as string)) {
            const chargeCodeCol = hotInstance.propToCol('chargeCode');
            const currentChargeCode = hotInstance.getDataAtCell(targetRow, chargeCodeCol as number);
            
            if (!currentChargeCode && chargeCode) {
              hotInstance.setDataAtCell(targetRow, chargeCodeCol as number, chargeCode, 'paste');
            }
          }
        }
      }
    });
  }, []);

  // Handle editor opening - add date picker close handler and dismiss errors
   
  const handleAfterBeginEditing = useCallback((row: number, column: number) => {
    // Dismiss errors for this cell when user starts editing
    setValidationErrors(prev => prev.filter(err => !(err.row === row && err.col === column)));
    
    // CRITICAL: For date editor, attach close handler to prevent stuck editor
    if (column === 0) {
      const hotInstance = hotTableRef.current?.hotInstance;
      const editor = hotInstance?.getActiveEditor();
      if (editor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dateEditor = editor as any;
        if (dateEditor.$datePicker && dateEditor.$datePicker._o) {
          const originalOnSelect = dateEditor.$datePicker._o.onSelect;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, react-hooks/unsupported-syntax
          dateEditor.$datePicker._o.onSelect = function(this: any, date: Date) {
            if (originalOnSelect) originalOnSelect.call(this, date);
            // Close editor after date selection
            setTimeout(() => {
              if (editor.isOpened && editor.isOpened()) {
                editor.finishEditing(false, false);
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
    isDirtyRef.current = true;

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
      window.alert('❌ Admin users cannot submit timesheet entries to SmartSheet.');
      window.logger?.warn('Admin attempted timesheet submission');
      return;
    }

    if (!token) {
      window.alert('❌ Session token is required. Please log in again.');
      window.logger?.warn('Submit attempted without session token');
      return;
    }
    
    isProcessingRef.current = true; // Set synchronously to block subsequent calls immediately
    setIsProcessing(true);
    try {
      const res = await submitTimesheet(token, async () => {
        await refreshTimesheetDraft();
        await refreshArchiveData();
      });
      
      if (res.error) {
        const errorMsg = `❌ Submission failed: ${res.error}`;
        window.alert(errorMsg);
        return;
      }
      
      // Check if submission was successful
      if (res.submitResult && !res.submitResult.ok) {
        const errorMsg = `❌ Submission failed: ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries processed, ${res.submitResult.removedCount} failed. Error: ${res.submitResult.error || 'Unknown error'}`;
        window.alert(errorMsg);
        return;
      }
      
      const submitMsg = res.submitResult ? 
        `✅ Submitted ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries to SmartSheet` : 
        '✅ No pending entries to submit';
      window.alert(submitMsg);
    } catch (error) {
      const errorMsg = `❌ Unexpected error during submission: ${error instanceof Error ? error.message : String(error)}`;
      window.logger?.error('Unexpected error during submission', { error: error instanceof Error ? error.message : String(error) });
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
      window.logger?.verbose('Refreshing data in finally block');
      Promise.all([
        refreshTimesheetDraft().catch(err => {
          window.logger?.error('Could not refresh timesheet data in finally block', { error: err });
        }),
        refreshArchiveData().catch(err => {
          window.logger?.error('Could not refresh archive data in finally block', { error: err });
        })
      ]);
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
          readOnly: true,
          source: []
        };
      }
      return { 
        source: getToolsForProject(project), 
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
          readOnly: true
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
  const columnDefinitions = useMemo(() => [
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

    // Check if there's any real data (non-empty rows)
    const realRows = timesheetDraftData.filter((row: TimesheetRow) => {
      return row.date || row.timeIn || row.timeOut || row.project || row.taskDescription;
    });

    if (realRows.length === 0) {
      return 'neutral';
    }

    // Check if all real rows are valid
    let hasErrors = false;
    let errorDetails: string[] = [];
    
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
    for (let i = 0; i < timesheetDraftData.length; i++) {
      if (hasTimeOverlapWithPreviousEntries(i, timesheetDraftData)) {
        const row = timesheetDraftData[i];
        errorDetails.push(`Row ${i + 1}: Time overlap detected on ${row.date}`);
        hasErrors = true;
      }
    }

    // Log validation errors to console for debugging
    if (hasErrors) {
      console.group('⚠️ Timesheet Validation Errors');
      errorDetails.forEach(err => console.warn(err));
      console.groupEnd();
      return 'warning';
    }

    console.log('✅ All timesheet validations passed - button is ready');
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

  return (
    <div className="timesheet-page">
      <div className="timesheet-header">
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
        <SubmitProgressBar
          status={buttonStatus}
          onSubmit={handleSubmitTimesheet}
          isSubmitting={isProcessing}
          icon={<PlayArrowIcon />}
          disabled={isAdmin}
        >
          Submit Timesheet
        </SubmitProgressBar>
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

