/**
 * Handler for after remove row callback
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import {
  deleteRowsFromDatabase,
  syncStateWithHandsontable,
} from "./timesheet.handlers.remove-row.helpers";

/**
 * Create handle after remove row callback
 */
export function createHandleAfterRemoveRow(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  timesheetDraftData: TimesheetRow[],
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined,
  rowsPendingRemovalRef: MutableRefObject<TimesheetRow[]>
): (index: number, amount: number) => Promise<void> {
  return async (index: number, amount: number) => {
    const removedRows = rowsPendingRemovalRef.current || [];
    rowsPendingRemovalRef.current = [];

    /**
     * WHY: Handsontable sometimes calls afterRemoveRow without beforeRemoveRow hook,
     * causing missing row capture. This safety check prevents data loss by detecting
     * the edge case, though it means we skip DB deletion for those rows.
     */
    if (removedRows.length === 0) {
      const start = Math.max(0, index);
      window.logger?.warn(
        "No captured rows before deletion; skipping DB delete",
        { index: start, amount }
      );
      return;
    }

    // Delete from database
    await deleteRowsFromDatabase(removedRows, amount);

    /**
     * WHY: Handsontable has already removed rows from its internal data at this point.
     * We need to sync React state to match, otherwise the state becomes stale and causes
     * inconsistencies in other operations.
     */
    syncStateWithHandsontable(
      hotTableRef,
      timesheetDraftData,
      amount,
      setTimesheetDraftData,
      onChange
    );
  };
}
