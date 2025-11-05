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
import { MacroRow, loadMacros, isMacroEmpty } from '../../utils/macroStorage';

type ButtonStatus = 'neutral' | 'ready' | 'warning';
import { formatTimeInput, normalizeRowData, isValidDate, isValidTime, hasTimeOverlapWithPreviousEntries } from './timesheet.schema';
import { projects, chargeCodes, projectsWithoutTools, toolsWithoutCharges, getToolOptions, toolNeedsChargeCode, projectNeedsTools } from './timesheet.options';
import { submitTimesheet } from './timesheet.submit';
import { saveLocalBackup, batchSaveToDatabase as batchSaveToDatabaseUtil, deleteDraftRows } from './timesheet.persistence';
import { SpellcheckEditor } from './SpellcheckEditor';

// Register all Handsontable modules
registerAllModules();

// Register custom spellcheck editor
registerEditor('spellcheckText', SpellcheckEditor);

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
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [currentEntry, setCurrentEntry] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const { token, isAdmin } = useSession();
  
  // Macro state
  const [macros, setMacros] = useState<MacroRow[]>([]);
  const [showMacroDialog, setShowMacroDialog] = useState(false);
  
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
        next[rowIdx] = projectsWithoutTools.has(project)
          ? { ...currentRow, project, tool: null, chargeCode: null }
          : { ...currentRow, project };
      } else if (propStr === 'tool' && newVal !== oldVal) {
        const tool = String(newVal ?? '');
        next[rowIdx] = toolsWithoutCharges.has(tool)
          ? { ...currentRow, tool, chargeCode: null }
          : { ...currentRow, tool };
      } else {
        next[rowIdx] = { ...currentRow, [propStr]: newVal ?? '' };
      }
    }
    
    const normalized = next.map(row => normalizeRowData(row, projectNeedsTools, toolNeedsChargeCode));
    setTimesheetDraftData(normalized);
    onChange?.(normalized);
    saveLocalBackup(normalized);

    // VALIDATION: Mark cells as invalid AFTER changes (doesn't block editing)
    if (hotInstance) {
      for (const change of changes) {
        const [rowIdx, prop, , newVal] = change;
        const propStr = String(prop);
        let isValid = true;

        // Validate dates
        if (propStr === 'date' && newVal) {
          isValid = isValidDate(String(newVal));
        }
        // Validate times and check for overlaps
        else if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal) {
          isValid = isValidTime(String(newVal));
          if (isValid && normalized[rowIdx]) {
            // Check for time overlaps
            if (hasTimeOverlapWithPreviousEntries(rowIdx, normalized)) {
              isValid = false;
            }
          }
        }
        // Validate required fields
        else if ((propStr === 'project' || propStr === 'taskDescription') && !newVal) {
          isValid = false;
        }

        // Mark cell as invalid or clear the mark
        const colIdx = hotInstance.propToCol(propStr);
        if (typeof colIdx === 'number' && colIdx >= 0) {
          if (!isValid) {
            hotInstance.setCellMeta(rowIdx, colIdx, 'className', 'htInvalid');
          } else {
            hotInstance.setCellMeta(rowIdx, colIdx, 'className', '');
          }
        }
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

  // Normalize pasted data
  const handleBeforePaste = useCallback((data: unknown[][]) => {
    data.forEach((row, i) => {
      if (row.length >= 7) {
        const [date, timeIn, timeOut, project, tool, chargeCode, taskDescription] = row;
        
        let normalizedTool = tool;
        let normalizedChargeCode = chargeCode;
        
        if (typeof project === 'string' && projectsWithoutTools.has(project)) {
          normalizedTool = null;
          normalizedChargeCode = null;
        } else if (typeof tool === 'string' && toolsWithoutCharges.has(tool)) {
          normalizedChargeCode = null;
        }
        
        data[i] = [date, timeIn, timeOut, project, normalizedTool, normalizedChargeCode, taskDescription];
      }
    });
    return true;
  }, []);

  // Handle editor opening - add date picker close handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAfterBeginEditing = useCallback((_row: number, column: number) => {
    // CRITICAL: For date editor, attach close handler to prevent stuck editor
    if (column === 0) {
      const hotInstance = hotTableRef.current?.hotInstance;
      const editor = hotInstance?.getActiveEditor();
      if (editor) {
        const dateEditor = editor as any;
        if (dateEditor.$datePicker && dateEditor.$datePicker._o) {
          const originalOnSelect = dateEditor.$datePicker._o.onSelect;
          dateEditor.$datePicker._o.onSelect = function(this: any, date: any) {
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


  // Listen for submission progress events
  useEffect(() => {
    if (!window.timesheet?.onSubmissionProgress) {
      return;
    }
    
    // Set up progress listener
    window.timesheet.onSubmissionProgress((progress) => {
      window.logger?.debug('Submission progress update', progress);
      setSubmissionProgress(progress.percent);
      setCurrentEntry(progress.current);
      setTotalEntries(progress.total);
      setProgressMessage(progress.message);
    });
    
    // Cleanup on unmount
    return () => {
      window.timesheet?.removeProgressListener?.();
    };
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

    // Apply macro fields using setDataAtCell (triggers handleAfterChange)
    const changes: [number, string, string | null][] = [];
    if (macro.timeIn) changes.push([targetRow, 'timeIn', macro.timeIn]);
    if (macro.timeOut) changes.push([targetRow, 'timeOut', macro.timeOut]);
    if (macro.project) changes.push([targetRow, 'project', macro.project]);
    if (macro.tool !== undefined) changes.push([targetRow, 'tool', macro.tool]);
    if (macro.chargeCode !== undefined) changes.push([targetRow, 'chargeCode', macro.chargeCode]);
    if (macro.taskDescription) changes.push([targetRow, 'taskDescription', macro.taskDescription]);

    // Apply all changes at once
    changes.forEach(([row, prop, value]) => {
      hotInstance.setDataAtCell(row, hotInstance.propToCol(prop) as number, value);
    });

    // Select the row that was modified
    hotInstance.selectCell(targetRow, 0);
  }, [macros]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
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
    
    // Reset progress state
    setSubmissionProgress(0);
    setCurrentEntry(0);
    setTotalEntries(0);
    setProgressMessage('');
    
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
      isProcessingRef.current = false; // Clear synchronous guard
      setIsProcessing(false);
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
    
    // Tool column - dynamic dropdown based on selected project
    if (col === 4) {
      const project = rowData?.project;
      if (!project || !projectNeedsTools(project)) {
        return { 
          className: 'htDimmed', 
          placeholder: project ? 'N/A' : '',
          readOnly: true,
          source: []
        };
      }
      return { 
        source: getToolOptions(project), 
        placeholder: 'Pick a Tool',
        readOnly: false
      };
    }
    
    // Charge code column - conditional based on selected tool
    if (col === 5) {
      const tool = rowData?.tool;
      if (!tool || !toolNeedsChargeCode(tool)) {
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

  // Column definitions - NO validators (validation happens in afterChange to prevent editor blocking)
  const columnDefinitions = useMemo(() => [
    { data: 'date', title: 'Date', type: 'date', dateFormat: 'MM/DD/YYYY', placeholder: 'MM/DD/YYYY', className: 'htCenter' },
    { data: 'timeIn', title: 'Start Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
    { data: 'timeOut', title: 'End Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
    { data: 'project', 
      title: 'Project', 
      type: 'dropdown', 
      source: projects, 
      strict: true, 
      allowInvalid: false, 
      placeholder: 'Pick a project', 
      className: 'htCenter',
      trimDropdown: false
    },
    { data: 'tool', title: 'Tool', type: 'dropdown', source: [], strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'chargeCode', title: 'Charge Code', type: 'dropdown', source: chargeCodes, strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
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
    for (const row of realRows) {
      // Check required fields
      if (!row.date || !isValidDate(row.date)) {
        hasErrors = true;
        break;
      }
      if (!row.timeIn || !isValidTime(row.timeIn)) {
        hasErrors = true;
        break;
      }
      if (!row.timeOut || !isValidTime(row.timeOut)) {
        hasErrors = true;
        break;
      }
      if (!row.project) {
        hasErrors = true;
        break;
      }
      if (!row.taskDescription) {
        hasErrors = true;
        break;
      }
      // Check if tool is required
      if (projectNeedsTools(row.project) && !row.tool) {
        hasErrors = true;
        break;
      }
      // Check if charge code is required
      if (row.tool && toolNeedsChargeCode(row.tool) && !row.chargeCode) {
        hasErrors = true;
        break;
      }
    }

    if (hasErrors) {
      return 'warning';
    }

    // Check for time overlaps
    for (let i = 0; i < timesheetDraftData.length; i++) {
      if (hasTimeOverlapWithPreviousEntries(i, timesheetDraftData)) {
        return 'warning';
      }
    }

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
          const label = isEmpty 
            ? `Macro ${index + 1}`
            : macro.taskDescription 
              ? `${macro.taskDescription.slice(0, 30)}${macro.taskDescription.length > 30 ? '...' : ''}`
              : `Macro ${index + 1}`;
          
          return (
            <Button
              key={index}
              className="macro-button"
              variant="outlined"
              size="small"
              disabled={isEmpty}
              onClick={() => applyMacro(index)}
              title={isEmpty ? `Macro ${index + 1} not configured` : `Apply: ${macro.taskDescription || ''}`}
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
        afterBeginEditing={handleAfterBeginEditing}
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
        fillHandle={false}
        autoWrapRow={false}
        autoWrapCol={false}
        fragmentSelection={true}
        disableVisualSelection={false}
        selectionMode="range"
        outsideClickDeselects={true}
        viewportRowRenderingOffset={24}
        columnSorting={{
          initialConfig: [
            { column: 0, sortOrder: 'asc' },  // Date: least recent to most recent
            { column: 1, sortOrder: 'asc' }   // Time In: earliest to latest
          ],
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
        <SubmitProgressBar
          status={buttonStatus}
          onSubmit={handleSubmitTimesheet}
          isSubmitting={isProcessing}
          progress={submissionProgress}
          currentEntry={currentEntry}
          totalEntries={totalEntries}
          message={progressMessage}
          icon={<PlayArrowIcon />}
          disabled={isAdmin}
        >
          Submit Timesheet
        </SubmitProgressBar>
      </div>

      {/* Macro Manager Dialog */}
      <MacroManagerDialog
        open={showMacroDialog}
        onClose={() => setShowMacroDialog(false)}
        onSave={(savedMacros) => {
          setMacros(savedMacros);
          window.logger?.info('Macros updated', { count: savedMacros.filter(m => !isMacroEmpty(m)).length });
        }}
      />
    </div>
  );
});

// Wrap with React.memo to prevent unnecessary re-renders
export default memo(TimesheetGrid);
