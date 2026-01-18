/**
 * Helper functions for cell operations
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";

/**
 * Get date column cell configuration
 */
export function getDateColumnCellConfig(
  rowData: TimesheetRow,
  row: number,
  timesheetDraftData: TimesheetRow[],
  weekdayPattern: boolean,
  getSmartPlaceholder: (
    previousRow: TimesheetRow | undefined,
    allRows: TimesheetRow[],
    weekdayPattern: boolean
  ) => string
): Record<string, unknown> | null {
  if (!rowData.date) {
    const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
    const smartPlaceholder = getSmartPlaceholder(
      previousRow,
      timesheetDraftData,
      weekdayPattern
    );
    return {
      placeholder: smartPlaceholder,
    };
  }
  return null;
}

/**
 * Get tool column cell configuration
 * Tool cell is locked when:
 * - Project doesn't need tools (N/A case)
 * When project needs tools, tool cell is unlocked to allow tool selection
 */
export function getToolColumnCellConfig(
  rowData: TimesheetRow,
  doesProjectNeedToolsFn: (project?: string) => boolean,
  getToolsForProjectFn: (project: string) => string[]
): Record<string, unknown> {
  const project = rowData?.project;
  if (!project || !doesProjectNeedToolsFn(project)) {
    return {
      className: "htDimmed",
      placeholder: project ? "N/A" : "",
      readOnly: true,
      source: [],
    };
  }
  // Project is set and needs tools - unlock cell to allow tool selection
  return {
    source: [...getToolsForProjectFn(project)],
    placeholder: "Pick a Tool",
    readOnly: false,
  };
}

/**
 * Get charge code column cell configuration
 * Charge code cell is locked when:
 * - Tool doesn't need charge code (N/A case)
 * 
 * Note: When tool needs charge code, the cell must NOT be readOnly so the dropdown can be opened
 */
export function getChargeCodeColumnCellConfig(
  rowData: TimesheetRow,
  doesToolNeedChargeCodeFn: (tool?: string) => boolean
): Record<string, unknown> {
  const tool = rowData?.tool;
  if (!tool || !doesToolNeedChargeCodeFn(tool)) {
    return {
      className: "htDimmed",
      placeholder: tool ? "N/A" : "",
      readOnly: true,
    };
  }
  // Tool is set and needs charge code - cell must be editable to allow dropdown selection
  return {
    placeholder: "Pick a Charge Code",
    readOnly: false, // Must be editable so dropdown can be opened
  };
}
