/**
 * Handler for before key down callback
 */

import type { TimesheetRow } from "@/components/timesheet/schema/timesheet.schema";
import type { MutableRefObject } from "react";
import type { HotTableRef } from "@handsontable/react-wrapper";
import { handleKeyCombination } from "./timesheet.handlers.keyboard.helpers";
import { insertDateAndMoveFocus } from "./timesheet.handlers.keyboard.insert";
import { validateKeyboardInput } from "./timesheet.handlers.keyboard.validate";

/**
 * Create handle before key down callback
 */
export function createHandleBeforeKeyDown(
  hotTableRef: MutableRefObject<HotTableRef | null>,
  timesheetDraftData: TimesheetRow[],
  weekdayPatternRef: MutableRefObject<boolean>,
  getSmartPlaceholder: (
    previousRow: TimesheetRow | undefined,
    allRows: TimesheetRow[],
    weekdayPattern: boolean
  ) => string,
  incrementDate: (
    date: string,
    days: number,
    weekdayPattern: boolean
  ) => string,
  formatDateForDisplay: (date: Date) => string
): (event: globalThis.KeyboardEvent) => void {
  return (event: globalThis.KeyboardEvent) => {
    const hotInstance = hotTableRef.current?.hotInstance;
    if (!hotInstance) return;

    const selected = hotInstance.getSelected();
    const selectedArray: Array<[number, number]> | null = selected
      ? selected.map((sel) => [sel[0], sel[1]] as [number, number])
      : null;
    const validation = validateKeyboardInput(
      { getSelected: () => selectedArray },
      timesheetDraftData
    );
    if (!validation.isValid || !validation.rowData) return;

    const { row, rowData } = validation;

    // Get the smart placeholder for this cell
    const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
    const smartPlaceholder = getSmartPlaceholder(
      previousRow,
      timesheetDraftData,
      weekdayPatternRef.current
    );

    // Check if the date editor is currently open
    const editor = hotInstance.getActiveEditor();
    const editorWrapper =
      editor && editor.isOpened
        ? {
            isOpened: () => editor.isOpened(),
            finishEditing: (restoreOriginalValue: boolean, ctrlDown: boolean) => {
              editor.finishEditing(restoreOriginalValue, ctrlDown);
            },
          }
        : null;
    const isEditorOpen = editorWrapper?.isOpened() ?? false;

    const { dateToInsert, shouldPreventDefault } = handleKeyCombination(
      event,
      rowData,
      smartPlaceholder,
      timesheetDraftData,
      row,
      weekdayPatternRef.current,
      incrementDate,
      formatDateForDisplay
    );

    if (dateToInsert && shouldPreventDefault) {
      event.preventDefault();
      event.stopPropagation();

      insertDateAndMoveFocus(
        {
          getActiveEditor: () => editorWrapper,
          setDataAtCell: (row: number, col: number, value: string) => {
            hotInstance.setDataAtCell(row, col, value);
          },
          selectCell: (row: number, col: number) => {
            hotInstance.selectCell(row, col);
          },
        },
        row,
        dateToInsert,
        isEditorOpen,
        editorWrapper
      );
    }
  };
}
