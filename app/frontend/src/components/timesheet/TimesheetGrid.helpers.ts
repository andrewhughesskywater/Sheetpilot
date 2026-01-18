/**
 * Helper functions for TimesheetGrid component
 */

import {
  getToolsForProject,
  doesToolNeedChargeCode,
  doesProjectNeedTools,
} from "@sheetpilot/shared/business-config";
import type { HotTableRef } from "@handsontable/react-wrapper";
import type { TimesheetRow } from "./schema/timesheet.schema";
import type { ButtonStatus } from "./TimesheetGrid.types";
import { validateTimesheetRows } from "./validation/timesheet.validation";
import {
  getGridContextForShortcuts,
  registerMacroShortcuts,
} from "./TimesheetGrid.shortcut-helpers";

// Wrapper functions to match expected signatures
export const projectNeedsToolsWrapper = (p?: string) => doesProjectNeedTools(p || "");
export const toolNeedsChargeCodeWrapper = (t?: string) =>
  doesToolNeedChargeCode(t || "");
export const getToolsForProjectWrapper = (project: string) => [
  ...getToolsForProject(project),
];

/**
 * Calculate button status based on timesheet validation
 */
export function calculateButtonStatus(
  timesheetDraftData: TimesheetRow[]
): ButtonStatus {
  if (!timesheetDraftData || timesheetDraftData.length === 0) {
    return "neutral";
  }

  const validation = validateTimesheetRows(timesheetDraftData);

  // Log validation errors for debugging
  if (validation.hasErrors) {
    window.logger?.warn("Timesheet validation errors detected", {
      errorCount: validation.errorDetails.length,
      errors: validation.errorDetails,
    });
    return "warning";
  }

  window.logger?.debug(
    "All timesheet validations passed - button is ready"
  );
  return "ready";
}

/**
 * Register keyboard shortcuts for TimesheetGrid
 */
export function registerTimesheetShortcuts(
  hotTableRef: React.RefObject<HotTableRef | null>,
  applyMacro: (index: number) => void,
  duplicateSelectedRow: () => void
): void {
  const hotInstance = hotTableRef.current?.hotInstance;
  if (!hotInstance) {
    window.logger?.warn("Could not register shortcuts - Handsontable instance not available");
    return;
  }

  const gridContext = getGridContextForShortcuts(hotInstance);
  if (!gridContext) {
    return;
  }

  window.logger?.info("Registering keyboard shortcuts for timesheet macros");

  registerMacroShortcuts(gridContext, hotInstance, applyMacro);

  // Register duplicate row shortcut (Ctrl+D)
  // Use 'Control' for Ctrl key (Handsontable uses KeyboardEvent.key values)
  gridContext.addShortcut({
    keys: [["Control", "d"]],
    preventDefault: true,
    callback: () => {
      duplicateSelectedRow();
    },
    group: "timesheet-actions",
  });
}
