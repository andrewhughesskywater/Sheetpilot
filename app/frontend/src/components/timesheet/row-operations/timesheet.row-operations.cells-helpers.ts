/**
 * Helper functions for cells configuration
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import {
  getDateColumnCellConfig,
  getToolColumnCellConfig,
  getChargeCodeColumnCellConfig,
} from "./timesheet.row-operations.cell-helpers";

/**
 * Get cell configuration for a specific column
 */
export function getCellConfigForColumn(
  col: number,
  rowData: TimesheetRow,
  row: number,
  timesheetDraftData: TimesheetRow[],
  weekdayPatternRef: MutableRefObject<boolean>,
  getSmartPlaceholder: (
    previousRow: TimesheetRow | undefined,
    allRows: TimesheetRow[],
    weekdayPattern: boolean
  ) => string,
  doesProjectNeedToolsFn: (project?: string) => boolean,
  getToolsForProjectFn: (project: string) => string[],
  doesToolNeedChargeCodeFn: (tool?: string) => boolean
): Record<string, unknown> {
  // Date column (col 1, after hidden ID at col 0) - smart placeholder
  if (col === 1) {
    const dateConfig = getDateColumnCellConfig(
      rowData,
      row,
      timesheetDraftData,
      weekdayPatternRef.current,
      getSmartPlaceholder
    );
    if (dateConfig) return dateConfig;
  }

  // Tool column (col 4, after ID/Date/Hours/Project) - dynamic dropdown based on selected project
  if (col === 4) {
    return getToolColumnCellConfig(
      rowData,
      doesProjectNeedToolsFn,
      getToolsForProjectFn
    );
  }

  // Charge code column (col 5) - conditional based on selected tool
  if (col === 5) {
    return getChargeCodeColumnCellConfig(rowData, doesToolNeedChargeCodeFn);
  }

  return {};
}
