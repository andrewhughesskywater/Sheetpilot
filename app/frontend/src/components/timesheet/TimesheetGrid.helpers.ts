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
  if (!hotInstance) return;

  const gridContext = hotInstance.getShortcutManager().getContext("grid");
  if (!gridContext) {
    window.logger?.warn("Could not get grid context for shortcuts");
    return;
  }

  // Register macro shortcuts (Ctrl+1-5)
  for (let i = 1; i <= 5; i++) {
    gridContext.addShortcut({
      keys: [["Ctrl", i.toString()]],
      callback: () => {
        const macroIndex = i - 1;
        applyMacro(macroIndex);
      },
      group: "timesheet-macros",
    });
  }

  // Register duplicate row shortcut (Ctrl+D)
  gridContext.addShortcut({
    keys: [["Ctrl", "d"]],
    callback: () => {
      duplicateSelectedRow();
    },
    group: "timesheet-actions",
  });
}
