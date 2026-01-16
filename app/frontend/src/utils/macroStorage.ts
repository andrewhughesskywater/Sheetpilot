/**
 * @fileoverview Macro Storage Utility
 * 
 * Handles storage and retrieval of timesheet macros in localStorage.
 * Macros allow users to quickly fill timesheet rows with frequently-used data patterns.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

const MACRO_STORAGE_KEY = 'sheetpilot-macros';
const MACRO_COUNT = 5;

/**
 * Macro row data structure (excludes date field)
 */
/**
 * @fileoverview Macro Storage Utilities
 * 
 * Manages persistent storage of user-defined macros in localStorage.
 * Macros allow quick data entry by pre-filling common time entries with Ctrl+1-5.
 */

/**
 * Macro data structure for quick time entry
 */
export interface MacroRow {
  name?: string;
  hours?: number;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

/**
 * Create an empty macro row
 */
function createEmptyMacro(): MacroRow {
  return {
    name: '',
    project: '',
    tool: null,
    chargeCode: null,
    taskDescription: ''
  };
}

/**
 * Load macros from localStorage
 * Returns array of 5 macro rows, initializing with empty macros if not found
 */
export function loadMacros(): MacroRow[] {
  if (typeof window === 'undefined') {
    return Array(MACRO_COUNT).fill(null).map(() => createEmptyMacro());
  }

  try {
    const stored = localStorage.getItem(MACRO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as MacroRow[];
      // Ensure we always have exactly 5 macros
      if (Array.isArray(parsed) && parsed.length === MACRO_COUNT) {
        // Ensure each macro has a name field (for backward compatibility)
        return parsed.map((macro) => ({
          ...macro,
          name: macro.name ?? ''
        }));
      }
    }
  } catch (error) {
    window.logger?.error('Could not load macros', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }

  // Return empty macros if loading failed or not found
  return Array(MACRO_COUNT).fill(null).map(() => createEmptyMacro());
}

function canPersistMacros(macros: MacroRow[]): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!Array.isArray(macros) || macros.length !== MACRO_COUNT) {
    window.logger?.error('Invalid macros array - must have exactly 5 items', { 
      receivedLength: macros?.length 
    });
    return false;
  }

  return true;
}

function persistMacros(macros: MacroRow[]): void {
  try {
    const serialized = JSON.stringify(macros);
    localStorage.setItem(MACRO_STORAGE_KEY, serialized);
    window.logger?.debug('Macros saved successfully', { count: macros.length });
  } catch (error) {
    window.logger?.error('Could not save macros', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Save macros to localStorage
 * @param macros Array of exactly 5 macro rows
 */
export function saveMacros(macros: MacroRow[]): void {
  if (!canPersistMacros(macros)) {
    return;
  }

  persistMacros(macros);
}

/**
 * Check if a macro row has any data
 */
export function isMacroEmpty(macro: MacroRow): boolean {
  return macro.hours === undefined && 
         !macro.project && 
         !macro.tool && 
         !macro.chargeCode && 
         !macro.taskDescription;
}

/**
 * Check if a macro row has minimum required data to be applied
 * (at least project and task description)
 */
export function isMacroValid(macro: MacroRow): boolean {
  return Boolean(macro.project && macro.taskDescription);
}

