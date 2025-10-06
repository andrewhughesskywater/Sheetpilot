import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import './TimesheetGrid.css';

// Register all Handsontable modules
registerAllModules();

// Define the row data type according to Phase 1 requirements
interface TimesheetRow {
  date?: string;
  timeIn?: string;
  timeOut?: string;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

// Phase 2: Data structures for dependent dropdowns
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

// Phase 2: Helper functions for cascading rules
function getToolOptions(project?: string): string[] {
  if (!project || projectsWithoutTools.has(project)) {
    return [];
  }
  return toolsByProject[project] || [];
}

function toolNeedsChargeCode(tool?: string): boolean {
  return !!tool && !toolsWithoutCharges.has(tool);
}

function projectNeedsTools(project?: string): boolean {
  return !!project && !projectsWithoutTools.has(project);
}

// Phase 3: Validation helper functions
function isValidDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
}

function isValidTime(timeStr?: string): boolean {
  if (!timeStr) return false;
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(timeStr)) return false;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
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

function validateField(value: unknown, row: number, prop: string, rows: TimesheetRow[]): string | null {
  const rowData = rows[row];
  
  switch (prop) {
    case 'date': {
      if (!value) return 'Please enter a date';
      if (!isValidDate(value)) return 'Date must be like 2024-01-15';
      return null;
    }
      
    case 'timeIn': {
      if (!value) return 'Please enter start time';
      if (!isValidTime(value)) return 'Time must be like 09:00 and in 15 minute steps';
      return null;
    }
      
    case 'timeOut': {
      if (!value) return 'Please enter end time';
      if (!isValidTime(value)) return 'Time must be like 17:00 and in 15 minute steps';
      if (!isTimeOutAfterTimeIn(rowData?.timeIn, value)) return 'End time must be after start time';
      return null;
    }
      
    case 'project':
      if (!value) return 'Please pick a project';
      if (!projects.includes(value)) return 'Please pick from the list';
      return null;
      
    case 'tool': {
      const project = rowData?.project;
      if (!projectNeedsTools(project)) {
        // Tool is N/A for this project, normalize to null
        return null;
      }
      if (!value) return 'Please pick a tool for this project';
      const toolOptions = getToolOptions(project);
      if (!toolOptions.includes(value)) return 'Please pick from the list';
      return null;
    }
      
    case 'chargeCode': {
      const tool = rowData?.tool;
      if (!toolNeedsChargeCode(tool)) {
        // Charge code is N/A for this tool, normalize to null
        return null;
      }
      if (!value) return 'Please pick a charge code for this tool';
      if (!chargeCodes.includes(value)) return 'Please pick from the list';
      return null;
    }
      
    case 'taskDescription':
      if (!value) return 'Please describe what you did';
      return null;
      
    default:
      return null;
  }
}

// Phase 3: Normalization helper functions
function normalizeRowData(row: TimesheetRow): TimesheetRow {
  const normalized = { ...row };
  
  // Normalize N/A fields to null
  if (!projectNeedsTools(normalized.project)) {
    normalized.tool = null;
    normalized.chargeCode = null;
  }
  
  if (!toolNeedsChargeCode(normalized.tool)) {
    normalized.chargeCode = null;
  }
  
  return normalized;
}


// Helper function to normalize trailing blank rows
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
  refreshTrigger?: number; // External trigger to refresh data
}

const TimesheetGrid: React.FC<TimesheetGridProps> = ({ onChange, refreshTrigger }) => {
  const [rows, setRows] = useState<TimesheetRow[]>([{}]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveButtonState, setSaveButtonState] = useState<'normal' | 'saving' | 'success'>('normal');

  // Phase 4: Load draft data function
  const loadDraftData = useCallback(async () => {
    try {
      setIsLoading(true);
      const draftData = await window.timesheet.loadDraft();
      console.log('[TimesheetGrid] Loaded draft data:', draftData);
      
      // Phase 5: Apply hydration normalization for imported data
      const normalizedData = draftData.map(row => {
        // If project doesn't need tools, clear tool and chargeCode
        if (projectsWithoutTools.has(row.project)) {
          return { ...row, tool: null, chargeCode: null };
        }
        return row;
      });
      
      // Add one blank row at the end if we have data
      const rowsWithBlank = normalizedData.length > 0 ? [...normalizedData, {}] : [{}];
      setRows(rowsWithBlank);
      onChange?.(rowsWithBlank);
    } catch (error) {
      console.error('[TimesheetGrid] Error loading draft data:', error);
      // Keep the default empty row on error
      setRows([{}]);
    } finally {
      setIsLoading(false);
    }
  }, [onChange]);

  // Phase 4: Load draft data on component mount
  useEffect(() => {
    loadDraftData();
  }, [loadDraftData]);

  // Phase 5: Refresh data when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      console.log('[TimesheetGrid] Refresh triggered, reloading data...');
      loadDraftData();
    }
  }, [refreshTrigger, loadDraftData]);

  // Phase 4: Autosave function
  const autosaveRow = useCallback(async (row: TimesheetRow) => {
    // Only autosave if row has required fields
    if (!row.date || !row.timeIn || !row.timeOut || !row.project || !row.taskDescription) {
      return;
    }
    
    try {
      console.log('[TimesheetGrid] Autosaving row:', row);
      const result = await window.timesheet.saveDraft(row);
      if (result.success) {
        console.log('[TimesheetGrid] Autosave successful, changes:', result.changes);
      } else {
        console.error('[TimesheetGrid] Autosave failed:', result.error);
      }
    } catch (error) {
      console.error('[TimesheetGrid] Autosave error:', error);
    }
  }, []);

  const handleAfterChange = useCallback((changes: Array<[number, string, unknown, unknown]>, source: string) => {
    if (!changes || source === 'loadData') return;
    
    const next = [...rows];
    for (const [rowIdxStr, prop, oldVal, newVal] of changes) {
      const rowIdx = Number(rowIdxStr);
      if (next[rowIdx]) {
        const currentRow = next[rowIdx];
        
        // Phase 2: Implement cascading rules
        if (prop === 'project' && newVal !== oldVal) {
          // When project changes, clear tool and chargeCode if project doesn't need tools
          if (projectsWithoutTools.has(newVal)) {
            next[rowIdx] = { ...currentRow, project: newVal, tool: null, chargeCode: null };
          } else {
            // Clear tool and chargeCode when project changes (user needs to reselect)
            next[rowIdx] = { ...currentRow, project: newVal, tool: null, chargeCode: null };
          }
        } else if (prop === 'tool' && newVal !== oldVal) {
          // When tool changes, clear chargeCode if tool doesn't need it
          if (toolsWithoutCharges.has(newVal)) {
            next[rowIdx] = { ...currentRow, tool: newVal, chargeCode: null };
          } else {
            next[rowIdx] = { ...currentRow, tool: newVal };
          }
        } else {
          // Regular field update
          next[rowIdx] = { ...currentRow, [prop]: newVal };
        }
      }
    }
    
    // Phase 3: Normalize all rows
    const normalizedRows = normalizeTrailingBlank(next.map(normalizeRowData));
    setRows(normalizedRows);
    onChange?.(normalizedRows);
    
    // Phase 4: Autosave the changed row
    if (changes && changes.length > 0) {
      const [rowIdxStr] = changes[0];
      const rowIdx = Number(rowIdxStr);
      if (normalizedRows[rowIdx]) {
        autosaveRow(normalizedRows[rowIdx]);
      }
    }
  }, [rows, onChange, autosaveRow]);

  // Phase 3: Validation hooks
  const handleBeforeValidate = useCallback((value: unknown, row: number, prop: string) => {
    const errorMessage = validateField(value, row, prop, rows);
    if (errorMessage) {
      // Return the error message to be displayed
      return errorMessage;
    }
    return value;
  }, [rows]);

  const handleAfterValidate = useCallback((isValid: boolean, value: unknown, row: number, prop: string) => {
    // For N/A fields, always consider them valid
    if (prop === 'tool' && !projectNeedsTools(rows[row]?.project)) {
      return true;
    }
    if (prop === 'chargeCode' && !toolNeedsChargeCode(rows[row]?.tool)) {
      return true;
    }
    
    return isValid;
  }, [rows]);

  // Phase 6: Copy/paste normalization
  const handleBeforeCopy = useCallback((data: unknown[][]) => {
    console.log('[TimesheetGrid] Copying data:', data);
    return data;
  }, []);

  const handleBeforePaste = useCallback((data: unknown[][]) => {
    console.log('[TimesheetGrid] Pasting data:', data);
    
    // Normalize pasted data
    const normalizedData = data.map(row => {
      if (row.length >= 7) {
        const [date, timeIn, timeOut, project, tool, chargeCode, taskDescription] = row;
        
        // Apply normalization rules
        let normalizedTool = tool;
        let normalizedChargeCode = chargeCode;
        
        // If project doesn't need tools, clear tool and chargeCode
        if (project && projectsWithoutTools.has(project)) {
          normalizedTool = null;
          normalizedChargeCode = null;
        }
        // If tool doesn't need charge codes, clear chargeCode
        else if (tool && toolsWithoutCharges.has(tool)) {
          normalizedChargeCode = null;
        }
        
        return [date, timeIn, timeOut, project, normalizedTool, normalizedChargeCode, taskDescription];
      }
      return row;
    });
    
    return normalizedData;
  }, []);

  const handleAfterCopy = useCallback(() => {
    console.log('[TimesheetGrid] Data copied successfully');
  }, []);

  const handleAfterPaste = useCallback(() => {
    console.log('[TimesheetGrid] Data pasted successfully');
  }, []);

  // Phase 2: Create cells function for enable/disable logic
  const cellsFunction = useCallback((row: number, col: number) => {
    const rowData = rows[row];
    const cellProps: Record<string, unknown> = {};
    
    if (col === 4) { // tool column
      const project = rowData?.project;
      if (!projectNeedsTools(project)) {
        cellProps.readOnly = true;
        cellProps.className = 'htDimmed';
        cellProps.placeholder = 'N/A for this project';
      }
    } else if (col === 5) { // chargeCode column
      const tool = rowData?.tool;
      if (!toolNeedsChargeCode(tool)) {
        cellProps.readOnly = true;
        cellProps.className = 'htDimmed';
        cellProps.placeholder = 'N/A for this tool';
      }
    }
    
    return cellProps;
  }, [rows]);

  // Phase 2: Create dynamic tool source function
  const createToolSource = useCallback((rowIndex: number) => {
    return (query: string, callback: (data: string[]) => void) => {
      const project = rows[rowIndex]?.project;
      const toolOptions = getToolOptions(project);
      const filteredOptions = toolOptions.filter(option => 
        option.toLowerCase().includes(query.toLowerCase())
      );
      callback(filteredOptions);
    };
  }, [rows]);

  // Phase 2: Create dynamic column definitions with Phase 6 accessibility enhancements
  const columnDefinitions = useMemo(() => [
    { 
      data: 'date', 
      type: 'date', 
      dateFormat: 'YYYY-MM-DD', 
      placeholder: 'Like 2024-01-15',
      // Phase 6: Accessibility
      className: 'htCenter',
      renderer: 'date',
      validator: 'date'
    },
    { 
      data: 'timeIn', 
      type: 'text', 
      placeholder: 'Like 09:00',
      // Phase 6: Accessibility
      className: 'htCenter',
      validator: 'time'
    },
    { 
      data: 'timeOut', 
      type: 'text', 
      placeholder: 'Like 09:00',
      // Phase 6: Accessibility
      className: 'htCenter',
      validator: 'time'
    },
    { 
      data: 'project', 
      type: 'autocomplete', 
      source: projects,
      strict: true,
      allowInvalid: false,
      placeholder: 'Pick a project',
      // Phase 6: Accessibility
      className: 'htCenter',
      filter: true
    },
    {
      data: 'tool',
      type: 'autocomplete',
      source: createToolSource(0), // This will be overridden by cells function
      strict: true,
      allowInvalid: false,
      placeholder: 'Pick a tool',
      // Phase 6: Accessibility
      className: 'htCenter',
      filter: true
    },
    {
      data: 'chargeCode',
      type: 'autocomplete',
      source: chargeCodes,
      strict: true,
      allowInvalid: false,
      placeholder: 'Pick a charge code',
      // Phase 6: Accessibility
      className: 'htCenter',
      filter: true
    },
    { 
      data: 'taskDescription', 
      type: 'text', 
      placeholder: 'Describe what you did',
      // Phase 6: Accessibility
      className: 'htLeft'
    }
  ], [createToolSource]);

  // Phase 4: Save all rows action
  const handleSaveAll = useCallback(async () => {
    if (saveButtonState !== 'normal') return; // Prevent multiple saves
    
    try {
      setSaveButtonState('saving');
      console.log('[TimesheetGrid] Saving all rows...');
      let savedCount = 0;
      let errorCount = 0;
      
      for (const row of rows) {
        if (row.date && row.timeIn && row.timeOut && row.project && row.taskDescription) {
          const result = await window.timesheet.saveDraft(row);
          if (result.success) {
            savedCount++;
          } else {
            errorCount++;
            console.error('[TimesheetGrid] Failed to save row:', row, result.error);
          }
        }
      }
      
      console.log(`[TimesheetGrid] Save complete: ${savedCount} saved, ${errorCount} errors`);
      
      // Show success state
      setSaveButtonState('success');
      
      // Fade back to normal after 5 seconds
      setTimeout(() => {
        setSaveButtonState('normal');
      }, 5000);
      
    } catch (error) {
      console.error('[TimesheetGrid] Error saving all rows:', error);
      setSaveButtonState('normal'); // Reset on error
    }
  }, [rows, saveButtonState]);

  if (isLoading) {
    return (
      <div>
        <h2>Timesheet Grid</h2>
        <p>Loading draft data...</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Timesheet Grid</h2>
      <div className="timesheet-grid-container">
        <button 
          onClick={handleSaveAll} 
          className={`save-button ${saveButtonState === 'success' ? 'save-success' : ''} ${saveButtonState === 'saving' ? 'save-loading' : ''}`}
          disabled={saveButtonState === 'saving'}
        >
          {saveButtonState === 'success' ? '✓ Complete' : saveButtonState === 'saving' ? 'Saving...' : 'Save All Rows'}
        </button>
        <span className="save-info-text">
          Your work is saved automatically when you finish each row
        </span>
      </div>
      <HotTable
        data={rows}
        columns={columnDefinitions}
        cells={cellsFunction}
        afterChange={handleAfterChange}
        beforeValidate={handleBeforeValidate}
        afterValidate={handleAfterValidate}
        beforeCopy={handleBeforeCopy}
        beforePaste={handleBeforePaste}
        afterCopy={handleAfterCopy}
        afterPaste={handleAfterPaste}
        width="100%"
        height={400}
        rowHeaders={true}
        colHeaders={['Date', 'Start Time', 'End Time', 'Project', 'Tool', 'Charge Code', 'What You Did']}
        contextMenu={true}
        manualColumnResize={true}
        manualRowResize={true}
        stretchH="all"
        // Phase 6: Accessibility and UX enhancements
        tabNavigation={true}
        navigableHeaders={true}
        copyPaste={true}
        undoRedo={true}
        search={true}
        ariaLabel="Timesheet data grid"
        ariaDescription="Interactive timesheet grid for entering work hours and project details"
        // Phase 6: Keyboard navigation
        enterMoves={{
          row: 1,
          col: 0
        }}
        tabMoves={{
          row: 0,
          col: 1
        }}
        // Phase 6: Visual indicators
        invalidCellClassName="htInvalid"
        emptyRowsClassName="htEmpty"
        // Phase 6: Copy/paste normalization
        copyPasteEnabled={true}
        copyPasteDelimiter="\t"
      />
    </div>
  );
};

export default TimesheetGrid;
