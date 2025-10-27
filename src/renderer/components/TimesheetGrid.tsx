import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import type { HotTableRef } from '@handsontable/react-wrapper';
import { Button, CircularProgress } from '@mui/material';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
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
  "Training",
  "N/A"
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
  
  // Check format first
  const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (!dateRegex.test(dateStr)) return false;
  
  // Parse the date components
  const [monthStr, dayStr, yearStr] = dateStr.split('/');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  
  // Basic range checks
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  
  // Create date object and verify it matches input
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
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
      if (!isValidDate(String(value))) return 'Date must be like 01/15/2024';
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
  console.log('[TimesheetGrid] Component rendering');
  const hotTableRef = useRef<HotTableRef>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  console.log('[TimesheetGrid] Current isProcessing state:', isProcessing);
  
  // Use preloaded data from context
  const { 
    timesheetDraftData, 
    setTimesheetDraftData, 
    isTimesheetDraftLoading, 
    timesheetDraftError,
    refreshTimesheetDraft,
    refreshArchiveData
  } = useData();
  
  console.log('[TimesheetGrid] Data state:', {
    dataLength: timesheetDraftData.length,
    isLoading: isTimesheetDraftLoading,
    hasError: !!timesheetDraftError
  });
  
  console.log('[TimesheetGrid] IPC Bridge available:', {
    hasWindow: typeof window !== 'undefined',
    hasTimesheet: typeof window.timesheet !== 'undefined',
    hasSubmit: typeof window.timesheet?.submit === 'function'
  });

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
  
  // Track if we've already loaded the initial sort/resize state
  const hasLoadedInitialStateRef = useRef(false);

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
      window.logger?.debug('[TimesheetGrid] Local backup saved', { rows: dataToBackup.length });
    } catch (error) {
      console.error('[TimesheetGrid] Could not save local backup:', error);
    }
  }, []);

  // Autosave row to database when complete
  const autosaveRow = useCallback(async (row: TimesheetRow) => {
    if (!row.date || !row.timeIn || !row.timeOut || !row.project || !row.taskDescription) return;
    
    if (!window.timesheet?.saveDraft) {
      console.warn('[TimesheetGrid] Autosave skipped - timesheet API not available');
      return;
    }
    
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
      
      // Auto-format time inputs and clear invalid entries
      if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal !== oldVal && newVal) {
        const formattedTime = formatTimeInput(String(newVal));
        // If the formatted time is invalid, clear the field immediately
        if (!isValidTime(formattedTime)) {
          next[rowIdx] = { ...currentRow, [propStr]: '' };
        } else {
          next[rowIdx] = { ...currentRow, [propStr]: formattedTime };
        }
        continue;
      }
      
      // Validate and clear invalid date entries
      if (propStr === 'date' && newVal !== oldVal && newVal) {
        // If the date is invalid, clear the field immediately
        if (!isValidDate(String(newVal))) {
          next[rowIdx] = { ...currentRow, [propStr]: '' };
        } else {
          next[rowIdx] = { ...currentRow, [propStr]: newVal };
        }
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

  // Custom state management to replace deprecated PersistentState plugin
  // Save column sorting state
  const handleAfterColumnSort = useCallback((_currentSortConfig: unknown, destinationSortConfigs: unknown) => {
    try {
      localStorage.setItem('sheetpilot_columnSorting', JSON.stringify(destinationSortConfigs));
    } catch (error) {
      console.error('[TimesheetGrid] Could not save column sorting state:', error);
    }
  }, []);

  // Save column width state
  const handleAfterColumnResize = useCallback((newSize: number, column: number) => {
    try {
      const stored = localStorage.getItem('sheetpilot_columnWidths');
      const widths = stored ? JSON.parse(stored) : {};
      widths[column] = newSize;
      localStorage.setItem('sheetpilot_columnWidths', JSON.stringify(widths));
    } catch (error) {
      console.error('[TimesheetGrid] Could not save column width:', error);
    }
  }, []);

  // Save row height state
  const handleAfterRowResize = useCallback((newSize: number, row: number) => {
    try {
      const stored = localStorage.getItem('sheetpilot_rowHeights');
      const heights = stored ? JSON.parse(stored) : {};
      heights[row] = newSize;
      localStorage.setItem('sheetpilot_rowHeights', JSON.stringify(heights));
    } catch (error) {
      console.error('[TimesheetGrid] Could not save row height:', error);
    }
  }, []);

  // Load saved states on initialization (only once) - completely disabled during startup
  useEffect(() => {
    if (!hotTableRef.current?.hotInstance || hasLoadedInitialStateRef.current) return;

    const hot = hotTableRef.current.hotInstance;
    hasLoadedInitialStateRef.current = true;

    // Don't load any state during startup - defer indefinitely until user interaction
    window.logger?.info('[TimesheetGrid] Skipping state loading during startup to prevent performance violations');
    
    // Only load state when user actually interacts with the table
    const loadStateOnInteraction = () => {
      try {
        // Load column sorting state
        const savedSortConfig = localStorage.getItem('sheetpilot_columnSorting');
        if (savedSortConfig) {
          const sortPlugin = hot.getPlugin('columnSorting');
          if (sortPlugin && typeof sortPlugin.setSortConfig === 'function') {
            sortPlugin.setSortConfig(JSON.parse(savedSortConfig));
          }
        }

        // Load column widths
        const savedWidths = localStorage.getItem('sheetpilot_columnWidths');
        if (savedWidths) {
          const widths = JSON.parse(savedWidths);
          const manualColumnResize = hot.getPlugin('manualColumnResize');
          if (manualColumnResize && typeof manualColumnResize.setManualSize === 'function') {
            Object.entries(widths).forEach(([col, width]) => {
              manualColumnResize.setManualSize(Number(col), width as number);
            });
          }
        }

        // Load row heights
        const savedHeights = localStorage.getItem('sheetpilot_rowHeights');
        if (savedHeights) {
          const heights = JSON.parse(savedHeights);
          const manualRowResize = hot.getPlugin('manualRowResize');
          if (manualRowResize && typeof manualRowResize.setManualSize === 'function') {
            Object.entries(heights).forEach(([row, height]) => {
              manualRowResize.setManualSize(Number(row), height as number);
            });
          }
        }
        
        // Single render call after all operations
        hot.render();
      } catch (error) {
        console.error('[TimesheetGrid] Could not load saved state:', error);
      }
    };

    // Load state only when user first interacts with the table
    const handleFirstInteraction = () => {
      loadStateOnInteraction();
      // Remove the event listeners after first interaction
      hot.removeHook('afterSelectionEnd', handleFirstInteraction);
      hot.removeHook('afterColumnResize', handleFirstInteraction);
      hot.removeHook('afterRowResize', handleFirstInteraction);
    };

    // Add event listeners for first interaction
    hot.addHook('afterSelectionEnd', handleFirstInteraction);
    hot.addHook('afterColumnResize', handleFirstInteraction);
    hot.addHook('afterRowResize', handleFirstInteraction);
  }, []); // Only run once on mount

  // Submit timesheet functionality
  const submitTimesheet = async () => {
    console.log('[TimesheetGrid] Submit button clicked');
    window.logger?.info('[TimesheetGrid] Submit button clicked');
    
    // Prevent multiple simultaneous submissions
    if (isProcessing) {
      console.log('[TimesheetGrid] Already processing, ignoring click');
      window.logger?.warn('[TimesheetGrid] Submit ignored - already processing');
      return;
    }
    
    console.log('[TimesheetGrid] Setting processing state to true');
    setIsProcessing(true);
    try {
      if (!window.timesheet?.submit) {
        const errorMsg = '❌ Timesheet API not available';
        window.logger?.warn('[TimesheetGrid] Submit not available');
        window.alert(errorMsg);
        return;
      }
      
      console.log('[TimesheetGrid] Calling window.timesheet.submit()');
      window.logger?.info('[TimesheetGrid] Starting timesheet submission');
      const res = await window.timesheet.submit();
      console.log('[TimesheetGrid] Received response:', res);
      console.log('[TimesheetGrid] Full submitResult:', JSON.stringify(res.submitResult, null, 2));
      
      if (res.error) {
        const errorMsg = `❌ Submission failed: ${res.error}`;
        console.error('[TimesheetGrid] Timesheet submission error:', res.error);
        window.logger?.error('Timesheet submission failed', { error: res.error });
        window.alert(errorMsg);
        return;
      }
      
      // Check if submission was successful
      if (res.submitResult && !res.submitResult.ok) {
        console.log('[TimesheetGrid] Detailed submission result:', JSON.stringify(res.submitResult, null, 2));
        const submitResult = res.submitResult as { ok: boolean; successCount: number; removedCount: number; totalProcessed: number; error?: string };
        const errorMsg = `❌ Submission failed: ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries processed, ${res.submitResult.removedCount} failed. Error: ${submitResult.error || 'Unknown error'}`;
        console.error('[TimesheetGrid] Timesheet submission failed:', res.submitResult);
        window.logger?.error('Timesheet submission failed', { submitResult: res.submitResult });
        window.alert(errorMsg);
        return;
      }
      
      const submitMsg = res.submitResult ? 
        `✅ Submitted ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries to SmartSheet` : 
        '✅ No pending entries to submit';
      window.logger?.info(submitMsg);
      window.alert(submitMsg);
      
      // Refresh data if entries were submitted - use requestAnimationFrame to avoid blocking
      if (res.submitResult && res.submitResult.successCount > 0) {
        window.logger?.info('[TimesheetGrid] Triggering data refresh after successful submission');
        requestAnimationFrame(async () => {
          await refreshTimesheetDraft();
          await refreshArchiveData();
        });
      }
    } catch (error) {
      const errorMsg = `❌ Unexpected error during submission: ${error instanceof Error ? error.message : String(error)}`;
      console.error('[TimesheetGrid] Unexpected error during submission:', error);
      window.logger?.error('Unexpected error during submission', { error: error instanceof Error ? error.message : String(error) });
      window.alert(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cell-level configuration (cascades over column config)
  const cellsFunction = useCallback((row: number, col: number) => {
    const rowData = timesheetDraftData[row];
    
    // Tool column - dynamic dropdown based on selected project
    if (col === 4) {
      const project = rowData?.project;
      if (!project) {
        return { readOnly: true, className: 'htDimmed', placeholder: '' };
      }
      return !projectNeedsTools(project)
        ? { readOnly: true, className: 'htDimmed', placeholder: 'N/A' }
        : { source: getToolOptions(project), placeholder: 'Pick a Tool' };
    }
    
    // Charge code column - conditional based on selected tool
    if (col === 5) {
      const tool = rowData?.tool;
      if (!tool) {
        return { readOnly: true, className: 'htDimmed', placeholder: '' };
      }
      if (!toolNeedsChargeCode(tool)) {
        return { readOnly: true, className: 'htDimmed', placeholder: 'N/A' };
      }
      return { placeholder: 'Pick a Charge Code' };
    }
    
    return {};
  }, [timesheetDraftData]);

  // Column definitions using cascading configuration
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
    { data: 'taskDescription', title: 'Task Description', type: 'text', placeholder: '', className: 'htLeft' }
  ], []);


  if (isTimesheetDraftLoading) {
    console.log('[TimesheetGrid] Rendering loading state');
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large">Loading draft data...</p>
      </div>
    );
  }

  if (timesheetDraftError) {
    console.log('[TimesheetGrid] Rendering error state:', timesheetDraftError);
    return (
      <div className="timesheet-page">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <p className="md-typescale-body-large timesheet-error-message">
          Error loading timesheet data: {timesheetDraftError}
        </p>
      </div>
    );
  }

  console.log('[TimesheetGrid] Rendering main view with submit button');
  return (
    <div className="timesheet-page">
      <div className="timesheet-header">
        <h2 className="md-typescale-headline-medium">Timesheet</h2>
        <Button
          variant="contained"
          size="large"
          className="submit-timesheet-button"
          startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
          onClick={() => {
            console.log('[TimesheetGrid] Button onClick fired, isProcessing:', isProcessing);
            submitTimesheet();
          }}
          disabled={isProcessing}
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
        afterChange={handleAfterChange}
        afterRemoveRow={handleAfterRemoveRow}
        beforeValidate={handleBeforeValidate}
        afterValidate={handleAfterValidate}
        beforePaste={handleBeforePaste}
        afterColumnSort={handleAfterColumnSort}
        afterColumnResize={handleAfterColumnResize}
        afterRowResize={handleAfterRowResize}
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
        autoWrapRow={true}
        autoWrapCol={true}
        fragmentSelection={true}
        disableVisualSelection={false}
        selectionMode="multiple"
        outsideClickDeselects={true}
        columnSorting={{
          initialConfig: [
            { column: 0, sortOrder: 'asc' },  // Date: least recent to most recent
            { column: 1, sortOrder: 'asc' }   // Time In: earliest to latest
          ],
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
  );
};

export default TimesheetGrid;
