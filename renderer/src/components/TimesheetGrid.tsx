import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import type { HotTableRef } from '@handsontable/react-wrapper';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import { useData } from '../contexts/DataContext';
import './TimesheetGrid.css';

// Register all Handsontable modules
registerAllModules();

interface TimesheetRow {
  id?: number;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

// Business logic: dependent dropdown data structures
const projectsWithoutTools = new Set([
  "ERT",
  "PTO/RTO", 
  "SWFL-CHEM/GAS",
  "Training"
]);

const toolsWithoutCharges = new Set([
  "Internal Meeting",
  "DECA Meeting",
  "Logistics",
  "Meeting",
  "Non Tool Related",
  "Admin",
  "Training"
]);

const projects = [
  "FL-Carver Techs",
  "FL-Carver Tools",
  "OSC-BBB",
  "PTO/RTO",
  "SWFL-CHEM/GAS",
  "SWFL-EQUIP",
  "Training"
];

const toolsByProject: Record<string, string[]> = {
  "FL-Carver Techs": [
    "DECA Meeting", "Logistics", "Peripherals", "#1 Rinse and 2D marker", "#2 Sputter",
    "#3 Laminator 300mm", "#4 Laminator 200mm", "#5 LDI", "#5B LDI", "#6 Decover",
    "#7 Develop", "#8 Optical Metrology", "#9 Scope", "#10 Plate", "#11 Strip for dry film",
    "#12 Solvent strip RDL resist, Cu/Ti Etch", "#13 Automated Inspection", "#14 Probe",
    "#15 Shear", "#16 Laminator", "#17 Backgrind/Mount/Detape", "#18 Laser groove",
    "#19 Saw", "#20 UV treatment", "#21 Carrier Laminator", "#22 Die Attach",
    "#23 Die Position Metrology", "#24 Pre Bake Oven #1", "#25 Compression Mold",
    "#26 Integrated Bond/Debond", "#27 Post Mold Cure Oven #2", "#28 CSAM102",
    "#29 Top Grind", "#30 Panelization Metrology", "#31 O2 Plasma Clean",
    "#32 VIAX Spin Coater", "#33 VIAX Developer", "#34 VIAX Cure Oven #3",
    "#35 Ball Attach", "#36 Reflow", "#37 Flux Rinse", "#38 Laser Marker",
    "#39 Tape and Reel", "#40 FOUP Cleaner", "#41 Wafer Transfer System",
    "#42 Lead Reflow", "#43 Cure Oven Loader", "#44 Conveyor Indexers",
    "#45 Manual Bonder", "#46 Manual Debonder", "#47 SEM w/EDX", "#48 Surface Profiler",
    "#49 FTIR Spectrometer", "#52 High Power Microscope", "#56 Filmetrics",
    "#59 Auto Titrator", "#60 Cyclic Voltametry", "#62 XRF", "Backgrind Abatement",
    "PLATE101 3rd HSP Chamber", "eFocus Rapid Cure", "PGV Load Cart / FOUP racks"
  ],
  "FL-Carver Tools": [
    "DECA Meeting", "Logistics", "Peripherals", "#1 Rinse and 2D marker", "#2 Sputter",
    "#3 Laminator 300mm", "#4 Laminator 200mm", "#5 LDI", "#5B LDI", "#6 Decover",
    "#7 Develop", "#8 Optical Metrology", "#9 Scope", "#10 Plate", "#11 Strip for dry film",
    "#12 Solvent strip RDL resist, Cu/Ti Etch", "#13 Automated Inspection", "#14 Probe",
    "#15 Shear", "#16 Laminator", "#17 Backgrind/Mount/Detape", "#18 Laser groove",
    "#19 Saw", "#20 UV treatment", "#21 Carrier Laminator", "#22 Die Attach",
    "#23 Die Position Metrology", "#24 Pre Bake Oven #1", "#25 Compression Mold",
    "#26 Integrated Bond/Debond", "#27 Post Mold Cure Oven #2", "#28 CSAM102",
    "#29 Top Grind", "#30 Panelization Metrology", "#31 O2 Plasma Clean",
    "#32 VIAX Spin Coater", "#33 VIAX Developer", "#34 VIAX Cure Oven #3",
    "#35 Ball Attach", "#36 Reflow", "#37 Flux Rinse", "#38 Laser Marker",
    "#39 Tape and Reel", "#40 FOUP Cleaner", "#41 Wafer Transfer System",
    "#42 Lead Reflow", "#43 Cure Oven Loader", "#44 Conveyor Indexers",
    "#45 Manual Bonder", "#46 Manual Debonder", "#47 SEM w/EDX", "#48 Surface Profiler",
    "#49 FTIR Spectrometer", "#52 High Power Microscope", "#56 Filmetrics",
    "#59 Auto Titrator", "#60 Cyclic Voltametry", "#62 XRF", "Backgrind Abatement",
    "PLATE101 3rd HSP Chamber", "eFocus Rapid Cure", "PGV Load Cart / FOUP racks"
  ],
  "OSC-BBB": [
    "Meeting", "Non Tool Related", "#1 CSAM101", "#2 BOND Pull Tester", "#3 Defect Measurement",
    "#4 AMICRA101", "#5 POLYCURE101", "#6 SAW101", "#7 BOND103", "#8 PLASMA101",
    "#9 Wafer or Die Ball Attach", "#10 Reflow Oven", "#11 Leak Detector", "#12 Lid Attach",
    "#13 Environmental Chamber", "#14 FEMTO101", "#15 Compression Mold Tool", "#16 LMARK101", "#17 Wire Bonder"
  ],
  "SWFL-EQUIP": [
    "Meeting", "Non Tool Related", "Training", "AFM101", "ALD101", "ALIGN101", "ANL101",
    "ASET101", "ASH101", "BLUEM101", "BOLD101", "BOND101", "BOND102", "CLN101",
    "COAT101", "COAT102", "DEBOND101", "DEBOND102", "DPS101", "DPS102", "DSM8101",
    "DSS101", "ECI101", "ENDURA101", "ENDURA102", "ETEST101", "EVAP101", "FIB101",
    "GAS101", "GONI101", "JST101", "JST102", "KLA101", "KLA102", "MIRRA102",
    "MIRRAC101", "NADA101", "NADA102", "NIKON101", "NOV101", "OVLY101", "OXID101",
    "PLATE101", "PROBE101", "PROBE102", "PROFIL101", "SCOPE101", "SCOPE102",
    "SCOPE103", "SCOPE113", "SCOPE114", "SCRIB101", "SEM101", "SRD102", "SRD103",
    "STORM101", "TAPE101", "TRAK101", "TRAK102", "TRENCH101"
  ]
};

const chargeCodes = [
  "Admin", "EPR1", "EPR2", "EPR3", "EPR4", "Repair", "Meeting", "Other", "PM", "Training", "Upgrade"
];

// Helper functions for dropdown cascading logic
function getToolOptions(project?: string): string[] {
  if (!project || projectsWithoutTools.has(project)) return [];
  return toolsByProject[project] || [];
}

function toolNeedsChargeCode(tool?: string): boolean {
  return !!tool && !toolsWithoutCharges.has(tool);
}

function projectNeedsTools(project?: string): boolean {
  return !!project && !projectsWithoutTools.has(project);
}

// Validation helpers
function isValidDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && !!dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
}

// Helper function to format numeric time input (e.g., 800 -> 08:00, 1430 -> 14:30)
function formatTimeInput(timeStr: unknown): string {
  if (typeof timeStr !== 'string') return String(timeStr || '');
  // Remove any non-numeric characters
  const numericOnly = timeStr.replace(/\D/g, '');
  
  // Handle different input formats
  if (numericOnly.length === 3) {
    // 800 -> 08:00
    const hours = numericOnly.substring(0, 1);
    const minutes = numericOnly.substring(1, 3);
    return `${hours.padStart(2, '0')}:${minutes}`;
  } else if (numericOnly.length === 4) {
    // 1430 -> 14:30
    const hours = numericOnly.substring(0, 2);
    const minutes = numericOnly.substring(2, 4);
    return `${hours}:${minutes}`;
  } else if (numericOnly.length === 2) {
    // 08 -> 08:00
    return `${numericOnly}:00`;
  } else if (numericOnly.length === 1) {
    // 8 -> 08:00
    return `${numericOnly.padStart(2, '0')}:00`;
  }
  
  // Return original if it doesn't match expected patterns
  return timeStr;
}

function isValidTime(timeStr?: string): boolean {
  if (!timeStr) return false;
  
  // First try to format the input
  const formattedTime = formatTimeInput(timeStr);
  
  // Check if it matches HH:MM format
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(formattedTime)) return false;
  
  const [hours, minutes] = formattedTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Check if it's a multiple of 15 minutes
  return totalMinutes % 15 === 0;
}

function isTimeOutAfterTimeIn(timeIn?: string, timeOut?: string): boolean {
  if (!timeIn || !timeOut) return true; // Let other validations handle missing values
  
  const [inHours, inMinutes] = timeIn.split(':').map(Number);
  const [outHours, outMinutes] = timeOut.split(':').map(Number);
  
  const inTotalMinutes = inHours * 60 + inMinutes;
  const outTotalMinutes = outHours * 60 + outMinutes;
  
  return outTotalMinutes > inTotalMinutes;
}

function validateField(value: unknown, row: number, prop: string | number, rows: TimesheetRow[]): string | null {
  const rowData = rows[row];
  
  switch (prop) {
    case 'date': {
      if (!value) return 'Please enter a date';
      if (!isValidDate(String(value))) return 'Date must be like 2024-01-15';
      return null;
    }
      
    case 'timeIn': {
      if (!value) return 'Please enter start time';
      if (!isValidTime(String(value))) return 'Time must be like 09:00, 800, or 1430 and in 15 minute steps';
      return null;
    }
      
    case 'timeOut': {
      if (!value) return 'Please enter end time';
      if (!isValidTime(String(value))) return 'Time must be like 17:00, 1700, or 530 and in 15 minute steps';
      if (!isTimeOutAfterTimeIn(rowData?.timeIn, String(value))) return 'End time must be after start time';
      return null;
    }
      
    case 'project':
      if (!value) return 'Please pick a project';
      if (!projects.includes(String(value))) return 'Please pick from the list';
      return null;
      
    case 'tool': {
      const project = rowData?.project;
      if (!projectNeedsTools(project)) {
        // Tool is N/A for this project, normalize to null
        return null;
      }
      if (!value) return 'Please pick a tool for this project';
      const toolOptions = getToolOptions(project);
      if (!toolOptions.includes(String(value))) return 'Please pick from the list';
      return null;
    }
      
    case 'chargeCode': {
      const tool = rowData?.tool;
      if (!toolNeedsChargeCode(tool || undefined)) {
        // Charge code is N/A for this tool, normalize to null
        return null;
      }
      if (!value) return 'Please pick a charge code for this tool';
      if (!chargeCodes.includes(String(value))) return 'Please pick from the list';
      return null;
    }
      
    case 'taskDescription':
      if (!value) return 'Please describe what you did';
      return null;
      
    default:
      return null;
  }
}

// Normalization helpers
function normalizeRowData(row: TimesheetRow): TimesheetRow {
  const normalized = { ...row };
  if (!projectNeedsTools(normalized.project)) {
    normalized.tool = null;
    normalized.chargeCode = null;
  }
  if (!toolNeedsChargeCode(normalized.tool || undefined)) {
    normalized.chargeCode = null;
  }
  return normalized;
}

// Ensure one blank row at end for new entries
function normalizeTrailingBlank(rows: TimesheetRow[]): TimesheetRow[] {
  // Remove trailing empty rows
  let lastNonEmptyIndex = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row?.date || row?.timeIn || row?.timeOut || row?.project || row?.tool || row?.chargeCode || row?.taskDescription) {
      lastNonEmptyIndex = i;
      break;
    }
  }
  return rows.slice(0, lastNonEmptyIndex + 2); // Keep one blank row at the end
}

interface TimesheetGridProps {
  onChange?: (rows: TimesheetRow[]) => void;
}

const TimesheetGrid: React.FC<TimesheetGridProps> = ({ onChange }) => {
  const [saveButtonState, setSaveButtonState] = useState<'normal' | 'saving' | 'success'>('normal');
  const hotTableRef = useRef<HotTableRef>(null);
  
  // Use preloaded data from context
  const { 
    timesheetDraftData, 
    setTimesheetDraftData, 
    isTimesheetDraftLoading, 
    timesheetDraftError 
  } = useData();

  // Update data using updateData() to preserve table state (selection, scroll position)
  const updateTableData = useCallback((newData: TimesheetRow[]) => {
    if (hotTableRef.current?.hotInstance) {
      console.log('[TimesheetGrid] Updating table data while preserving state');
      hotTableRef.current.hotInstance.updateData(newData);
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

  // LocalStorage backup for offline resilience
  const saveLocalBackup = useCallback((data: TimesheetRow[]) => {
    try {
      const dataToBackup = data.filter(row => 
        row.date || row.timeIn || row.timeOut || row.project || row.taskDescription
      );
      localStorage.setItem('sheetpilot_timesheet_backup', JSON.stringify({
        data: dataToBackup,
        timestamp: new Date().toISOString()
      }));
      console.log('[TimesheetGrid] Local backup saved', { rows: dataToBackup.length });
    } catch (error) {
      console.error('[TimesheetGrid] Could not save local backup:', error);
    }
  }, []);

  // Autosave row to database when complete
  const autosaveRow = useCallback(async (row: TimesheetRow) => {
    if (!row.date || !row.timeIn || !row.timeOut || !row.project || !row.taskDescription) return;
    
    try {
      const result = await window.timesheet.saveDraft({
        id: row.id,
        date: row.date,
        timeIn: row.timeIn,
        timeOut: row.timeOut,
        project: row.project,
        tool: row.tool,
        chargeCode: row.chargeCode,
        taskDescription: row.taskDescription
      });
      if (!result.success) {
        console.error('[TimesheetGrid] Autosave failed:', result.error);
      }
    } catch (error) {
      console.error('[TimesheetGrid] Autosave error:', error);
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAfterChange = useCallback((changes: any, source: string) => {
    if (!changes || source === 'loadData') return;
    
    const next = [...timesheetDraftData];
    
    for (const change of changes) {
      const [rowIdx, prop, oldVal, newVal] = change;
      if (!next[rowIdx]) continue;
      
      const currentRow = next[rowIdx];
      const propStr = String(prop);
      
      // Auto-format time inputs
      if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal !== oldVal && newVal) {
        next[rowIdx] = { ...currentRow, [propStr]: formatTimeInput(String(newVal)) };
        continue;
      }
      
      // Cascading dropdown rules
      if (propStr === 'project' && newVal !== oldVal) {
        const project = typeof newVal === 'string' ? newVal : String(newVal || '');
        next[rowIdx] = projectsWithoutTools.has(project)
          ? { ...currentRow, project, tool: null, chargeCode: null }
          : { ...currentRow, project, tool: null, chargeCode: null };
      } else if (propStr === 'tool' && newVal !== oldVal) {
        const tool = typeof newVal === 'string' ? newVal : String(newVal || '');
        next[rowIdx] = toolsWithoutCharges.has(tool)
          ? { ...currentRow, tool, chargeCode: null }
          : { ...currentRow, tool };
      } else {
        next[rowIdx] = { ...currentRow, [propStr]: newVal };
      }
    }
    
    // Normalize and save
    const normalizedRows = normalizeTrailingBlank(next.map(normalizeRowData));
    setTimesheetDraftData(normalizedRows);
    onChange?.(normalizedRows);
    saveLocalBackup(normalizedRows);
    
    // Autosave first changed row
    if (changes.length > 0 && normalizedRows[changes[0][0]]) {
      autosaveRow(normalizedRows[changes[0][0]]);
    }
  }, [timesheetDraftData, setTimesheetDraftData, onChange, autosaveRow, saveLocalBackup]);

  // Handle row removal (note: deleteDraft API not yet implemented)
  const handleAfterRemoveRow = useCallback(() => {
    // TODO: Implement deleteDraft API in window.timesheet
    // For now, removed rows will be handled on next data refresh
  }, []);

  // Validation hooks
  const handleBeforeValidate = useCallback((value: unknown, row: number, prop: string | number) => {
    const errorMessage = validateField(value, row, prop, timesheetDraftData);
    return errorMessage || value;
  }, [timesheetDraftData]);

  const handleAfterValidate = useCallback((isValid: boolean, _value: unknown, row: number, prop: string | number) => {
    // N/A fields are always valid
    if (prop === 'tool' && !projectNeedsTools(timesheetDraftData[row]?.project)) return true;
    if (prop === 'chargeCode' && !toolNeedsChargeCode(timesheetDraftData[row]?.tool || undefined)) return true;
    return isValid;
  }, [timesheetDraftData]);

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

  // PersistentState hooks for localStorage state management
  const handlePersistentStateSave = useCallback((key: string, value: unknown) => {
    try {
      localStorage.setItem(`sheetpilot_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('[TimesheetGrid] Could not save to localStorage:', error);
    }
  }, []);

  const handlePersistentStateLoad = useCallback((key: string) => {
    try {
      const stored = localStorage.getItem(`sheetpilot_${key}`);
      return stored ? JSON.parse(stored) : undefined;
    } catch (error) {
      console.error('[TimesheetGrid] Could not load from localStorage:', error);
      return undefined;
    }
  }, []);

  const handlePersistentStateReset = useCallback((key: string) => {
    try {
      localStorage.removeItem(`sheetpilot_${key}`);
    } catch (error) {
      console.error('[TimesheetGrid] Could not reset localStorage:', error);
    }
  }, []);

  // Cell-level configuration (cascades over column config)
  const cellsFunction = useCallback((row: number, col: number) => {
    const rowData = timesheetDraftData[row];
    
    // Tool column - dynamic dropdown based on selected project
    if (col === 4) {
      const project = rowData?.project;
      return !projectNeedsTools(project)
        ? { readOnly: true, className: 'htDimmed', placeholder: 'N/A for this project' }
        : { source: getToolOptions(project) };
    }
    
    // Charge code column - conditional based on selected tool
    if (col === 5 && !toolNeedsChargeCode(rowData?.tool || undefined)) {
      return { readOnly: true, className: 'htDimmed', placeholder: 'N/A for this tool' };
    }
    
    return {};
  }, [timesheetDraftData]);

  // Column definitions using cascading configuration
  const columnDefinitions = useMemo(() => [
    { data: 'date', type: 'date', dateFormat: 'YYYY-MM-DD', placeholder: 'Like 2024-01-15', className: 'htCenter' },
    { data: 'timeIn', type: 'text', placeholder: 'Like 09:00 or 800', className: 'htCenter' },
    { data: 'timeOut', type: 'text', placeholder: 'Like 17:00 or 1700', className: 'htCenter' },
    { data: 'project', type: 'dropdown', source: projects, strict: true, allowInvalid: false, placeholder: 'Pick a project', className: 'htCenter' },
    { data: 'tool', type: 'dropdown', source: [], strict: true, allowInvalid: false, placeholder: 'Pick a tool', className: 'htCenter' },
    { data: 'chargeCode', type: 'dropdown', source: chargeCodes, strict: true, allowInvalid: false, placeholder: 'Pick a charge code', className: 'htCenter' },
    { data: 'taskDescription', type: 'text', placeholder: 'Describe what you did', className: 'htLeft' }
  ], []);

  // Save all rows manually
  const handleSaveAll = useCallback(async () => {
    if (saveButtonState !== 'normal') return;
    
    try {
      setSaveButtonState('saving');
      
      for (const row of timesheetDraftData) {
        if (row.date && row.timeIn && row.timeOut && row.project && row.taskDescription) {
          await window.timesheet.saveDraft({
            id: row.id,
            date: row.date,
            timeIn: row.timeIn,
            timeOut: row.timeOut,
            project: row.project,
            tool: row.tool,
            chargeCode: row.chargeCode,
            taskDescription: row.taskDescription
          });
        }
      }
      
      setSaveButtonState('success');
      setTimeout(() => setSaveButtonState('normal'), 5000);
    } catch (error) {
      console.error('[TimesheetGrid] Error saving all rows:', error);
      setSaveButtonState('normal');
    }
  }, [timesheetDraftData, saveButtonState]);

  if (isTimesheetDraftLoading) {
    return (
      <div>
        <h2>Timesheet</h2>
        <p>Loading draft data...</p>
      </div>
    );
  }

  if (timesheetDraftError) {
    return (
      <div>
        <h2>Timesheet</h2>
        <p>Error loading timesheet data: {timesheetDraftError}</p>
      </div>
    );
  }


  return (
    <div className="timesheet-page">
      <h2 className="md-typescale-headline-medium">Timesheet</h2>
      <div className="timesheet-grid-container">
        <button 
          onClick={handleSaveAll} 
          className={`save-button ${saveButtonState === 'success' ? 'save-success' : ''} ${saveButtonState === 'saving' ? 'save-loading' : ''}`}
          disabled={saveButtonState === 'saving'}
        >
          {saveButtonState === 'success' ? '✓ Complete' : saveButtonState === 'saving' ? 'Saving...' : 'Save All Rows'}
        </button>
        <span className="save-info-text md-typescale-body-small">
          Your work is saved automatically when you finish each row
        </span>
      </div>
      <div className="timesheet-table-container">
        <HotTable
        ref={hotTableRef}
        id="sheetpilot-timesheet-grid"
        data={timesheetDraftData}
        columns={columnDefinitions}
        cells={cellsFunction}
        afterChange={handleAfterChange}
        afterRemoveRow={handleAfterRemoveRow}
        beforeValidate={handleBeforeValidate}
        afterValidate={handleAfterValidate}
        beforePaste={handleBeforePaste}
        persistentState={true}
        persistentStateSave={handlePersistentStateSave}
        persistentStateLoad={handlePersistentStateLoad}
        persistentStateReset={handlePersistentStateReset}
        themeName="ht-theme-horizon"
        width="100%"
        height={400}
        rowHeaders={true}
        colHeaders={['Date', 'Start Time', 'End Time', 'Project', 'Tool', 'Charge Code', 'Task Description']}
        contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo', '---------', 'copy', 'cut']}
        manualColumnResize={true}
        manualRowResize={true}
        stretchH="all"
        licenseKey="non-commercial-and-evaluation"
        minSpareRows={1}
        readOnly={false}
        fillHandle={true}
        autoWrapRow={true}
        autoWrapCol={true}
        fragmentSelection={true}
        disableVisualSelection={false}
        selectionMode="multiple"
        outsideClickDeselects={true}
        columnSorting={{
          initialConfig: { column: 0, sortOrder: 'desc' },
          indicator: true,
          headerAction: true,
          sortEmptyCells: true,
          compareFunctionFactory: (sortOrder: string) => (value: unknown, nextValue: unknown): -1 | 0 | 1 => {
            if (value === null || value === undefined || value === '') return sortOrder === 'asc' ? 1 : -1;
            if (nextValue === null || nextValue === undefined || nextValue === '') return sortOrder === 'asc' ? -1 : 1;
            if (value === nextValue) return 0;
            return (value < nextValue ? -1 : 1) * (sortOrder === 'asc' ? 1 : -1) as -1 | 0 | 1;
          }
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
    </div>
  );
};

export default TimesheetGrid;
