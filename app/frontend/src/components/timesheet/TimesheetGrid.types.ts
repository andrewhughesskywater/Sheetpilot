/**
 * Type definitions for TimesheetGrid component
 */

export type ButtonStatus = "neutral" | "ready" | "warning";

/**
 * Date picker options interface for Handsontable date editor
 */
export interface DatePickerOptions {
  onSelect?: (this: DatePickerOptions, date: Date) => void;
  [key: string]: unknown;
}

/**
 * Date editor interface for Handsontable date editor
 * Extends the base editor with date picker specific properties
 */
export interface DateEditor {
  $datePicker?: {
    _o?: DatePickerOptions;
  };
  isOpened?: () => boolean;
  finishEditing: (restoreOriginalValue: boolean, ctrlDown: boolean) => void;
}
