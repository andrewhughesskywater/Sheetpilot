/**
 * Helper functions for after change handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";


export function scheduleRowSaves(
  changes: Array<[number, string | number, unknown, unknown]>,
  normalized: TimesheetRow[],
  saveTimersRef: {
    get: (key: number) => ReturnType<typeof setTimeout> | undefined;
    set: (key: number, value: ReturnType<typeof setTimeout>) => void;
  },
  saveAndReloadRow: (row: TimesheetRow, rowIdx: number) => Promise<void>
): void {
  const DEBOUNCE_DELAY = 500;
  for (const change of changes) {
    const [rowIdx] = change;
    const row = normalized[rowIdx];
    if (!row) continue;

    const hasAnyData =
      row.date ||
      row.hours !== undefined ||
      row.project ||
      row.taskDescription;
    if (hasAnyData) {
      const existingTimer = saveTimersRef.get(rowIdx);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = setTimeout(() => {
        void (async () => {
          window.logger?.verbose("[TimesheetGrid] Saving individual row", {
            rowIdx,
          });
          await saveAndReloadRow(row, rowIdx);
          saveTimersRef.delete(rowIdx);
        })();
      }, DEBOUNCE_DELAY);

      saveTimersRef.set(rowIdx, timer);
    }
  }
}
