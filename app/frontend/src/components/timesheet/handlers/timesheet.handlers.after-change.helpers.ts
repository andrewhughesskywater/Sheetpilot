/**
 * Helper functions for after change handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { HandsontableChange } from "@/components/timesheet/cell-processing/timesheet.cell-processing";

/**
 * Check if changes should be skipped and log if needed
 */
export function shouldSkipChanges(
  changes: HandsontableChange[] | null,
  source: string
): boolean {
  // WHY: Filter out updateData source immediately to prevent infinite loops.
  // Handsontable's React wrapper calls updateData when props change, which triggers
  // afterChange with source "updateData". If we process these, it can create a loop
  // where updateData -> afterChange -> state update -> prop change -> updateData.
  if (
    !changes ||
    source === "loadData" ||
    source === "updateData" ||
    source === "internal"
  ) {
    // Log only occasionally to reduce log spam during loops
    if (!window.__afterChangeSkipCount) {
      window.__afterChangeSkipCount = 0;
    }
    window.__afterChangeSkipCount++;
    if (window.__afterChangeSkipCount % 100 === 0) {
      window.logger?.verbose("[TimesheetGrid] afterChange: skipping (many times)", {
        reason: !changes ? "no changes" : "source filter",
        source,
        skipCount: window.__afterChangeSkipCount,
      });
    }
    return true;
  }
  return false;
}

/**
 * Update timesheet data if it has actually changed
 */
export function updateTimesheetDataIfChanged(
  normalized: TimesheetRow[],
  timesheetDraftData: TimesheetRow[],
  source: string,
  setTimesheetDraftData: (data: TimesheetRow[]) => void,
  onChange: ((rows: TimesheetRow[]) => void) | undefined
): void {
  // Only update state if data has actually changed to prevent infinite update loops
  // Compare normalized data with current data using JSON stringify for deep comparison
  const currentDataStr = JSON.stringify(timesheetDraftData);
  const normalizedDataStr = JSON.stringify(normalized);
  
  if (currentDataStr !== normalizedDataStr) {
    window.logger?.verbose("[TimesheetGrid] afterChange: data changed, calling setTimesheetDraftData", {
      currentLength: timesheetDraftData.length,
      normalizedLength: normalized.length,
      source,
    });
    setTimesheetDraftData(normalized);
    onChange?.(normalized);
  } else {
    window.logger?.verbose("[TimesheetGrid] afterChange: data unchanged, skipping setTimesheetDraftData", {
      source,
    });
  }
}


export function scheduleRowSaves(
  changes: HandsontableChange[],
  normalized: TimesheetRow[],
  saveTimersRef: {
    get: (key: number) => ReturnType<typeof setTimeout> | undefined;
    set: (key: number, value: ReturnType<typeof setTimeout>) => void;
    delete: (key: number) => boolean;
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
