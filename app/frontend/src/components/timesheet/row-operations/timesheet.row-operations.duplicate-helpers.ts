/**
 * Helper functions for row duplication operations
 */

import type { HotTableRef } from "@handsontable/react-wrapper";

/**
 * Validate duplication prerequisites
 */
export function validateDuplication(
  hotInstance: HotTableRef["hotInstance"] | null
):
  | { valid: false }
  | { valid: true; hotInstance: NonNullable<HotTableRef["hotInstance"]> } {
  if (!hotInstance) {
    window.logger?.warn(
      "Cannot duplicate row - Handsontable instance not available"
    );
    return { valid: false };
  }

  return { valid: true, hotInstance };
}

/**
 * Get selected row for duplication
 */
export function getSelectedRowForDuplication(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): { valid: false } | { valid: true; selectedRow: number; rowData: unknown[] } {
  const selected = hotInstance.getSelected();
  if (!selected || selected.length === 0) {
    window.logger?.verbose("No row selected for duplication");
    return { valid: false };
  }

  const firstSelection = selected[0];
  const selectedRow = firstSelection?.[0];
  if (typeof selectedRow !== "number") return { valid: false };
  const rowData = hotInstance.getDataAtRow(selectedRow);

  if (!rowData || rowData.every((cell) => !cell)) {
    window.logger?.verbose("Selected row is empty, skipping duplication");
    return { valid: false };
  }

  return { valid: true, selectedRow, rowData };
}

/**
 * Perform row duplication
 */
export function performRowDuplication(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>,
  selectedRow: number,
  rowData: unknown[]
): void {
  window.logger?.info("Duplicating row", { selectedRow });

  hotInstance.alter("insert_row_below", selectedRow, 1);

  const newRow = selectedRow + 1;
  hotInstance.populateFromArray(
    newRow,
    0,
    [rowData],
    undefined,
    undefined,
    "overwrite"
  );

  hotInstance.selectCell(newRow, 1);
}
