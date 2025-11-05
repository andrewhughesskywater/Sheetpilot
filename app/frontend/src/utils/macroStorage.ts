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
export interface MacroRow {
  timeIn?: string;
  timeOut?: string;
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
    timeIn: '',
    timeOut: '',
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
        return parsed;
      }
    }
  } catch (error) {
    console.error('[MacroStorage] Could not load macros', error);
  }

  // Return empty macros if loading failed or not found
  return Array(MACRO_COUNT).fill(null).map(() => createEmptyMacro());
}

/**
 * Save macros to localStorage
 * @param macros Array of exactly 5 macro rows
 */
export function saveMacros(macros: MacroRow[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!Array.isArray(macros) || macros.length !== MACRO_COUNT) {
    console.error('[MacroStorage] Invalid macros array - must have exactly 5 items');
    return;
  }

  try {
    const serialized = JSON.stringify(macros);
    localStorage.setItem(MACRO_STORAGE_KEY, serialized);
    console.log('[MacroStorage] Macros saved successfully');
  } catch (error) {
    console.error('[MacroStorage] Could not save macros', error);
  }
}

/**
 * Check if a macro row has any data
 */
export function isMacroEmpty(macro: MacroRow): boolean {
  return !macro.timeIn && 
         !macro.timeOut && 
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

