/**
 * Helper functions for remove row handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import { deleteDraftRows } from "@/components/timesheet/persistence/timesheet.persistence";

export async function deleteRowsFromDatabase(
  removedRows: TimesheetRow[],
  amount: number
): Promise<void> {
  const rowIds = removedRows
    .filter((row) => row?.id !== undefined && row?.id !== null)
    .map((row) => row.id!);

  if (rowIds.length > 0) {
    const deletedCount = await deleteDraftRows(rowIds);
    window.logger?.info("Rows removed from database successfully", {
      count: deletedCount,
      requested: amount,
    });
  }
}

export function syncStateWithHandsontable(
  hotTableRef: {
    current: {
      hotInstance: {
        getSourceData: () => TimesheetRow[];
      };
    } | null;
  },
  timesheetDraftData: TimesheetRow[],
  amount: number,
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined
): void {
  if (!hotTableRef.current?.hotInstance) {
    window.logger?.warn(
      "Cannot sync state - Handsontable instance not available"
    );
    return;
  }

  const hotData =
    hotTableRef.current.hotInstance.getSourceData() as TimesheetRow[];
  window.logger?.verbose("Syncing state with Handsontable", {
    hotDataLength: hotData.length,
    oldStateLength: timesheetDraftData.length,
    deletedRowsCount: amount,
  });

  setTimesheetDraftData(hotData);
  onChange?.(hotData);
}
