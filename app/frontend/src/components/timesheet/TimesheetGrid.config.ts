/**
 * Configuration constants for TimesheetGrid HotTable component
 */

export const HOTTABLE_CONTEXT_MENU = [
  "row_above",
  "row_below",
  "remove_row",
  "---------",
  "undo",
  "redo",
  "---------",
  "copy",
  "cut",
];

export const HOTTABLE_COLUMN_SORTING = {
  indicator: true,
  headerAction: true,
  sortEmptyCells: true,
} as const;
