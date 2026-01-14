/**
 * Helper functions for processing a single cell change
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type {
  HandsontableChange,
  ValidationError,
} from "@/components/timesheet/cell-processing/timesheet.cell-processing";

function processSingleChange(
  change: HandsontableChange,
  next: TimesheetRow[],
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
  },
  processCellChangeFn: (
    change: HandsontableChange,
    currentRow: TimesheetRow,
    hotInstance: {
      propToCol: (prop: string) => number | unknown;
      setDataAtCell: (
        row: number,
        col: number,
        value: unknown,
        source?: string
      ) => void;
      setCellMeta: (
        row: number,
        col: number,
        key: string,
        value: unknown
      ) => void;
    }
  ) => {
    updatedRow: TimesheetRow;
    isValid: boolean;
    error: ValidationError | null;
    shouldSkip: boolean;
  }
): {
  error: ValidationError | null;
  colIdx: number;
  needsUpdate: boolean;
} {
  const [rowIdx] = change;
  if (!next[rowIdx]) {
    return { error: null, colIdx: -1, needsUpdate: false };
  }

  const currentRow = next[rowIdx];
  const result = processCellChangeFn(change, currentRow, hotInstance);

  if (result.shouldSkip) {
    if (result.error) {
      window.logger?.verbose("Auto-cleared invalid data", {
        rowIdx,
        field: result.error.field,
        oldVal: result.updatedRow[result.error.field as keyof TimesheetRow],
      });
    }
    return { error: result.error, colIdx: -1, needsUpdate: false };
  }

  next[rowIdx] = result.updatedRow;
  const [_, prop] = change;
  const propStr =
    typeof prop === "string"
      ? prop
      : typeof prop === "number"
        ? String(prop)
        : "";
  const colIdxRaw = hotInstance.propToCol(propStr);
  const colIdx = typeof colIdxRaw === "number" ? colIdxRaw : -1;
  return { error: null, colIdx, needsUpdate: true };
}

export function processCellChanges(
  changes: HandsontableChange[],
  timesheetDraftData: TimesheetRow[],
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
  },
  processCellChangeFn: (
    change: HandsontableChange,
    currentRow: TimesheetRow,
    hotInstance: {
      propToCol: (prop: string) => number | unknown;
      setDataAtCell: (
        row: number,
        col: number,
        value: unknown,
        source?: string
      ) => void;
      setCellMeta: (
        row: number,
        col: number,
        key: string,
        value: unknown
      ) => void;
    }
  ) => {
    updatedRow: TimesheetRow;
    isValid: boolean;
    error: ValidationError | null;
    shouldSkip: boolean;
  }
): {
  next: TimesheetRow[];
  newErrors: ValidationError[];
  cellsToClearErrors: Array<{ row: number; col: number }>;
  needsUpdate: boolean;
} {
  const next = [...timesheetDraftData];
  const newErrors: ValidationError[] = [];
  const cellsToClearErrors: Array<{ row: number; col: number }> = [];
  let needsUpdate = false;
  for (const change of changes) {
    const [rowIdx] = change;
    const result = processSingleChange(change, next, hotInstance, processCellChangeFn);
    if (result.error) {
      newErrors.push(result.error);
    }
    if (result.needsUpdate) {
      needsUpdate = true;
      if (result.colIdx >= 0) {
        cellsToClearErrors.push({ row: rowIdx, col: result.colIdx });
      }
    }
  }
  return { next, newErrors, cellsToClearErrors, needsUpdate };
}
