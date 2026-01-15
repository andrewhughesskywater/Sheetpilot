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
 * Get and validate target row from selection
 */
export function getMacroTargetRow(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): { valid: false } | { valid: true; targetRow: number } {
  const selected = hotInstance.getSelected();
  if (!selected || selected.length === 0) {
    window.logger?.warn("Cannot apply macro - no cell selected");
    return { valid: false };
  }

  const firstSelection = selected[0];
  if (!firstSelection || typeof firstSelection[0] !== "number") {
    window.logger?.warn("Cannot apply macro - invalid selection");
    return { valid: false };
  }

  const targetRow = firstSelection[0];
  return { valid: true, targetRow };
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
