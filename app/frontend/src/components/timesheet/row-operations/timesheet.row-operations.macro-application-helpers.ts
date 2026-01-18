/**
 * Helper functions for macro application operations
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MacroRow } from "@/utils/macroStorage";
import type { HotTableRef } from "@handsontable/react-wrapper";
import { applyMacroToRow } from "./timesheet.row-operations.macro-helpers";

/**
 * Validate macro application prerequisites
 */
export function validateMacroApplication(
  hotInstance: HotTableRef["hotInstance"] | null,
  macro: MacroRow | undefined,
  isMacroEmptyFn: (macro: MacroRow) => boolean,
  macroIndex: number
):
  | { valid: false }
  | {
      valid: true;
      hotInstance: NonNullable<HotTableRef["hotInstance"]>;
      macro: MacroRow;
    } {
  if (!hotInstance) {
    window.logger?.warn(
      "Cannot apply macro - Handsontable instance not available"
    );
    return { valid: false };
  }

  if (!macro || isMacroEmptyFn(macro)) {
    window.logger?.verbose("Macro is empty, skipping application", {
      macroIndex,
    });
    return { valid: false };
  }

  return { valid: true, hotInstance, macro };
}

/**
 * Try to get target row using getSelectedLast() method
 * More reliable for keyboard shortcuts - handles cases where keyboard shortcuts 
 * trigger before selection is fully updated
 */
function tryGetSelectedLastRow(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): { valid: false } | { valid: true; targetRow: number } {
  if (typeof hotInstance.getSelectedLast === "function") {
    try {
      const selectedLast = hotInstance.getSelectedLast();
      if (selectedLast && selectedLast.length >= 1 && typeof selectedLast[0] === "number") {
        const targetRow = selectedLast[0];
        if (targetRow >= 0) {
          return { valid: true, targetRow };
        }
      }
    } catch {
      // getSelectedLast() may not work as expected, fall through to getSelected()
      window.logger?.verbose("getSelectedLast() failed, trying getSelected()");
    }
  }
  return { valid: false };
}

/**
 * Try to get target row using getSelected() method
 * Primary method - works for most cases
 */
function tryGetSelectedRow(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): { valid: false } | { valid: true; targetRow: number } {
  const selected = hotInstance.getSelected();
  if (selected && selected.length > 0) {
    const firstSelection = selected[0];
    if (firstSelection && typeof firstSelection[0] === "number") {
      const targetRow = firstSelection[0];
      if (targetRow >= 0) {
        return { valid: true, targetRow };
      }
    }
  }
  return { valid: false };
}

/**
 * Validate and extract row number from a value
 */
function isValidRow(row: unknown): row is number {
  return typeof row === "number" && row >= 0;
}

/**
 * Try to get row from edited cell info
 */
function tryGetRowFromEditedCellInfo(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): number | null {
  const editedCellInfo = (hotInstance as { getEditedCellInfo?: () => { row?: number; col?: number } | null }).getEditedCellInfo?.();
  if (editedCellInfo && isValidRow(editedCellInfo.row)) {
    return editedCellInfo.row;
  }
  return null;
}

/**
 * Try to get row from editor properties
 */
function tryGetRowFromEditorProperties(
  activeEditor: NonNullable<ReturnType<NonNullable<HotTableRef["hotInstance"]>["getActiveEditor"]>>
): number | null {
  const editorRow = (activeEditor as { row?: number }).row;
  if (isValidRow(editorRow)) {
    return editorRow;
  }
  return null;
}

/**
 * Try to get row from active editor if a cell is currently being edited
 */
function tryGetRowFromActiveEditor(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): { valid: false } | { valid: true; targetRow: number } {
  const activeEditor = hotInstance.getActiveEditor();
  if (!activeEditor) {
    return { valid: false };
  }

  try {
    const rowFromCellInfo = tryGetRowFromEditedCellInfo(hotInstance);
    if (rowFromCellInfo !== null) {
      return { valid: true, targetRow: rowFromCellInfo };
    }
    
    const rowFromEditor = tryGetRowFromEditorProperties(activeEditor);
    if (rowFromEditor !== null) {
      return { valid: true, targetRow: rowFromEditor };
    }
  } catch (error) {
    // Editor might not expose row in expected way
    window.logger?.verbose("Could not extract row from active editor", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  
  return { valid: false };
}

/**
 * Extract row from selection manager's last selected value
 */
function extractRowFromLastSelected(lastSelected: number[] | null): number | null {
  if (!lastSelected || lastSelected.length < 1) {
    return null;
  }
  const targetRow = lastSelected[0];
  if (isValidRow(targetRow)) {
    return targetRow;
  }
  return null;
}

/**
 * Last resort: try to get the last focused/active cell by checking if 
 * Handsontable has stored the last selected coordinates
 */
function tryGetRowFromSelectionManager(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): { valid: false } | { valid: true; targetRow: number } {
  try {
    // Try accessing Handsontable's internal selection state
    const selectionManager = (hotInstance as { selection?: { getSelectedLast?: () => number[] | null } }).selection;
    if (!selectionManager?.getSelectedLast) {
      return { valid: false };
    }

    const lastSelected = selectionManager.getSelectedLast();
    const targetRow = extractRowFromLastSelected(lastSelected);
    
    if (targetRow !== null) {
      window.logger?.verbose("Using last selected cell from selection manager", { targetRow });
      return { valid: true, targetRow };
    }
  } catch (error) {
    // Selection manager might not be accessible in this way
    window.logger?.verbose("Could not access selection manager", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  
  return { valid: false };
}

/**
 * Get and validate target row from selection
 * 
 * Tries multiple methods to get the target row:
 * 1. getSelectedLast() - more reliable for keyboard shortcuts (if available)
 * 2. getSelected() - primary method for getting selection
 * 3. Active editor coordinates - if cell is being edited
 * 4. Selection manager - last resort fallback
 */
export function getMacroTargetRow(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): { valid: false } | { valid: true; targetRow: number } {
  const result = tryGetSelectedLastRow(hotInstance);
  if (result.valid) {
    return result;
  }

  const selectedResult = tryGetSelectedRow(hotInstance);
  if (selectedResult.valid) {
    return selectedResult;
  }

  const editorResult = tryGetRowFromActiveEditor(hotInstance);
  if (editorResult.valid) {
    return editorResult;
  }

  const managerResult = tryGetRowFromSelectionManager(hotInstance);
  if (managerResult.valid) {
    return managerResult;
  }

  window.logger?.warn("Cannot apply macro - no cell selected");
  return { valid: false };
}

/**
 * Initialize row if it doesn't exist
 */
export function ensureRowExists(
  sourceData: TimesheetRow[],
  targetRow: number
): void {
  if (!sourceData[targetRow]) {
    sourceData[targetRow] = {
      date: "",
      project: "",
      tool: null,
      chargeCode: null,
      taskDescription: "",
    };
  }
}

/**
 * Apply macro to row and normalize
 */
export function applyMacroAndNormalize(
  sourceData: TimesheetRow[],
  targetRow: number,
  macro: MacroRow,
  normalizeRowDataFn: (
    row: TimesheetRow,
    projectNeedsTools: (p?: string) => boolean,
    toolNeedsChargeCode: (t?: string) => boolean
  ) => TimesheetRow,
  projectNeedsToolsWrapper: (p?: string) => boolean,
  toolNeedsChargeCodeWrapper: (t?: string) => boolean
): void {
  const existingRow = sourceData[targetRow];
  if (!existingRow) {
    window.logger?.warn("Cannot apply macro to undefined row", { targetRow });
    return;
  }
  const updatedRow = applyMacroToRow(existingRow, macro);

  const normalizedRow = normalizeRowDataFn(
    updatedRow,
    projectNeedsToolsWrapper,
    toolNeedsChargeCodeWrapper
  );

  sourceData[targetRow] = normalizedRow;
}
