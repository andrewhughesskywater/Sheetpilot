/**
 * Handler for refresh function
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import {
  handleResetInProgress,
  handleLoadDraftData,
} from "./timesheet.handlers.refresh.helpers";

/**
 * Create handle refresh function
 */
export function createHandleRefresh(
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  logInfoFn: (message: string, meta?: Record<string, unknown>) => void,
  logWarnFn: (message: string, meta?: Record<string, unknown>) => void,
  logErrorFn: (message: string, meta?: Record<string, unknown>) => void,
  resetInProgressIpcFn: () => Promise<{
    success: boolean;
    count?: number;
    error?: string;
  }>,
  loadDraftIpcFn: () => Promise<{
    success: boolean;
    entries?: TimesheetRow[];
    error?: string;
  }>
): () => Promise<void> {
  return async () => {
    logInfoFn(
      "Refresh button clicked - resetting in-progress entries and reloading table"
    );
    try {
      // First, explicitly reset in-progress entries
      await handleResetInProgress(resetInProgressIpcFn, logInfoFn, logWarnFn);

      // Then refresh the table data
      await handleLoadDraftData(
        loadDraftIpcFn,
        setTimesheetDraftData,
        logInfoFn,
        logWarnFn
      );
    } catch (error) {
      logErrorFn("Could not refresh table", {
        error: error instanceof Error ? error.message : String(error),
      });
      window.alert(
        `❌ Could not refresh table: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}
