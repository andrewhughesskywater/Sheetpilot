/**
 * Handler for after selection callback
 */

import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type { ValidationError } from "@/components/timesheet/cell-processing/timesheet.cell-processing";

function clearInvalidCell(
  hotInstance: {
    getCellMeta: (
      row: number,
      col: number
    ) => { className?: string | string[] };
    setDataAtCell: (
      row: number,
      col: number,
      value: string,
      source?: string
    ) => void;
    setCellMeta: (row: number, col: number, key: string, value: string) => void;
    render: () => void;
  },
  row: number,
  col: number,
  setValidationErrors: (
    updater: (prev: ValidationError[]) => ValidationError[]
  ) => void
): void {
  setTimeout(() => {
    hotInstance.setDataAtCell(row, col, "", "clearInvalid");

    // Clear the validation error styling
    hotInstance.setCellMeta(row, col, "className", "");
    hotInstance.render();

    // Remove the error from state
    setValidationErrors((prev) =>
      prev.filter((err) => !(err.row === row && err.col === col))
    );

    window.logger?.verbose("Cleared invalid entry", {
      row,
      col,
    });
  }, 100);
}

function isValidCoordinate(row: number, col: number): boolean {
  return row >= 0 && col >= 0 && Number.isInteger(row) && Number.isInteger(col);
}

/**
 * Create handle after selection callback
 */
export function createHandleAfterSelection(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  previousSelectionRef: MutableRefObject<{ row: number; col: number } | null>,
  setValidationErrors: (
    updater: (prev: ValidationError[]) => ValidationError[]
  ) => void
): (row: number, col: number) => void {
  return (row: number, col: number) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    // Validate row and col are valid unsigned integers (Handsontable can pass -1 for headers)
    if (!isValidCoordinate(row, col)) {
      return;
    }

    const prevSelection = previousSelectionRef.current;

    // If user moved away from a cell
    if (
      prevSelection &&
      (prevSelection.row !== row || prevSelection.col !== col)
    ) {
      // Validate previous selection coordinates before using them
      if (!isValidCoordinate(prevSelection.row, prevSelection.col)) {
        // Update current selection and skip invalid cell cleanup
        previousSelectionRef.current = { row, col };
        return;
      }

      // Check if previous cell was invalid
      const cellMeta = hotInstance.getCellMeta(
        prevSelection.row,
        prevSelection.col
      );
      if (cellMeta.className === "htInvalid") {
        clearInvalidCell(
          hotInstance,
          prevSelection.row,
          prevSelection.col,
          setValidationErrors
        );
      }
    }

    // Update previous selection
    previousSelectionRef.current = { row, col };
  };
}
