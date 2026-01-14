/**
 * Helper functions for keyboard handler
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";

function handleCtrlTab(
  timesheetDraftData: TimesheetRow[],
  row: number,
  weekdayPattern: boolean,
  incrementDate: (
    date: string,
    days: number,
    weekdayPattern: boolean
  ) => string
): string | null {
  const lastEntryWithDate = timesheetDraftData
    .slice(0, row)
    .reverse()
    .find((r) => r.date);

  if (lastEntryWithDate?.date) {
    return incrementDate(lastEntryWithDate.date, 1, weekdayPattern);
  }
  return null;
}

function handleShiftTab(
  rowData: TimesheetRow,
  smartPlaceholder: string,
  weekdayPattern: boolean,
  incrementDate: (
    date: string,
    days: number,
    weekdayPattern: boolean
  ) => string
): string | null {
  if (!rowData.date && smartPlaceholder) {
    return incrementDate(smartPlaceholder, 1, weekdayPattern);
  }
  return null;
}

function handleTab(
  rowData: TimesheetRow,
  smartPlaceholder: string
): string | null {
  if (!rowData.date && smartPlaceholder) {
    return smartPlaceholder;
  }
  return null;
}

function handleCtrlT(
  formatDateForDisplay: (date: Date) => string
): string {
  return formatDateForDisplay(new Date());
}

export function handleKeyCombination(
  event: globalThis.KeyboardEvent,
  rowData: TimesheetRow,
  smartPlaceholder: string,
  timesheetDraftData: TimesheetRow[],
  row: number,
  weekdayPattern: boolean,
  incrementDate: (
    date: string,
    days: number,
    weekdayPattern: boolean
  ) => string,
  formatDateForDisplay: (date: Date) => string
): {
  dateToInsert: string | null;
  shouldPreventDefault: boolean;
} {
  let dateToInsert: string | null = null;
  let shouldPreventDefault = false;

  // Handle different key combinations
  if (event.key === "Tab" && event.ctrlKey) {
    dateToInsert = handleCtrlTab(
      timesheetDraftData,
      row,
      weekdayPattern,
      incrementDate
    );
    if (dateToInsert) {
      shouldPreventDefault = true;
    }
  } else if (event.key === "Tab" && event.shiftKey) {
    dateToInsert = handleShiftTab(
      rowData,
      smartPlaceholder,
      weekdayPattern,
      incrementDate
    );
    if (dateToInsert) {
      shouldPreventDefault = true;
    }
  } else if (event.key === "Tab") {
    dateToInsert = handleTab(rowData, smartPlaceholder);
    if (dateToInsert) {
      shouldPreventDefault = true;
    }
  } else if (event.ctrlKey && event.key === "t") {
    dateToInsert = handleCtrlT(formatDateForDisplay);
    shouldPreventDefault = true;
  }

  return { dateToInsert, shouldPreventDefault };
}
