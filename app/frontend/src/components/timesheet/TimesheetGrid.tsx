import { useState, useCallback, useMemo, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import type { HotTableRef } from '@handsontable/react-wrapper';
import { Button, CircularProgress, Alert } from '@mui/material';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import { useData } from '../../contexts/DataContext';
import { useSession } from '../../contexts/SessionContext';
import './TimesheetGrid.css';
import type { TimesheetRow } from './timesheet.schema';
import { formatTimeInput, normalizeRowData, isValidDate, isValidTime, hasTimeOverlapWithPreviousEntries } from './timesheet.schema';
import { projects, chargeCodes, projectsWithoutTools, toolsWithoutCharges, getToolOptions, toolNeedsChargeCode, projectNeedsTools } from './timesheet.options';
import { submitTimesheet } from './timesheet.submit';
import { saveLocalBackup, batchSaveToDatabase as batchSaveToDatabaseUtil, deleteDraftRows } from './timesheet.persistence';

// Register all Handsontable modules
registerAllModules();

// Validator functions for Handsontable columns
// These return true for valid, false for invalid
// Note: Handsontable validators have access to 'this' context with row, col, and instance
const dateValidator = (value: unknown): boolean => {
  if (!value) return false;
  return isValidDate(String(value));
};

const timeInValidator = function(this: any, value: unknown): boolean {
  if (!value) return false;
  if (!isValidTime(String(value))) return false;
  
  // Check for overlaps with previous entries
  const allRows = this.instance.getSourceData() as TimesheetRow[];
  const currentRow = allRows[this.row];
  if (!currentRow) return true; // Can't validate without row data
  
  // Create updated row with the new timeIn value
  const updatedRow = { ...currentRow, timeIn: String(value) };
  const updatedRows = [...allRows];
  updatedRows[this.row] = updatedRow;
  
  // Check for overlap
  if (hasTimeOverlapWithPreviousEntries(this.row, updatedRows)) {
    return false;
  }
  
  return true;
};

const timeOutValidator = function(this: any, value: unknown, callback: (valid: boolean) => void): void {
  if (!value) {
    callback(false);
    return;
  }
  if (!isValidTime(String(value))) {
    callback(false);
    return;
  }
  
  // Check for overlaps with previous entries
  const allRows = this.instance.getSourceData() as TimesheetRow[];
  const currentRow = allRows[this.row];
  if (!currentRow) {
    callback(true); // Can't validate without row data
    return;
  }
  
  // Create updated row with the new timeOut value
  const updatedRow = { ...currentRow, timeOut: String(value) };
  const updatedRows = [...allRows];
  updatedRows[this.row] = updatedRow;
  
  // Check for overlap
  if (hasTimeOverlapWithPreviousEntries(this.row, updatedRows)) {
    callback(false);
    return;
  }
  
  callback(true);
};

const projectValidator = (value: unknown): boolean => {
  return !!value;
};

const taskDescriptionValidator = (value: unknown): boolean => {
  return !!value;
};

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

  // Auto-save to database every 5 minutes
  useEffect(() => {
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    window.logger?.info('[TimesheetGrid] Setting up 5-minute auto-save interval');
    const intervalId = setInterval(() => {
      window.logger?.info('[TimesheetGrid] 5-minute interval triggered, saving to database');
      batchSaveToDatabase();
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

  // Column definitions using cascading configuration
  const columnDefinitions = useMemo(() => [
    { data: 'date', title: 'Date', type: 'date', dateFormat: 'MM/DD/YYYY', placeholder: 'MM/DD/YYYY', className: 'htCenter', validator: dateValidator },
    { data: 'timeIn', title: 'Start Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter', validator: timeInValidator },
    { data: 'timeOut', title: 'End Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter', validator: timeOutValidator },
    { data: 'project', 
      title: 'Project', 
      type: 'dropdown', 
      source: projects, 
      strict: true, 
      allowInvalid: false, 
      placeholder: 'Pick a project', 
      className: 'htCenter',
      trimDropdown: false,
      validator: projectValidator
    },
    { data: 'tool', title: 'Tool', type: 'dropdown', source: [], strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'chargeCode', title: 'Charge Code', type: 'dropdown', source: chargeCodes, strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'taskDescription', title: 'Task Description', type: 'text', placeholder: '', className: 'htLeft', validator: taskDescriptionValidator, maxLength: 120 }
  ], []);

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
        <Button
          variant="contained"
          size="large"
          className="submit-timesheet-button"
          startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
          onClick={handleSubmitTimesheet}
          disabled={isProcessing || isAdmin}
        >
          {isProcessing ? 'Submitting...' : 'Submit Timesheet'}
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
        selectionMode="single"
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
    </div>
  );
});

export default TimesheetGrid;
