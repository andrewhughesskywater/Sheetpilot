/**
 * Helper functions for inserting dates in keyboard handler
 */

export function insertDateAndMoveFocus(
  hotInstance: {
    getActiveEditor: () => {
      isOpened: () => boolean;
      finishEditing: (restoreOriginalValue: boolean, ctrlDown: boolean) => void;
    } | null;
    setDataAtCell: (row: number, col: number, value: string) => void;
    selectCell: (row: number, col: number) => void;
  },
  row: number,
  dateToInsert: string,
  isEditorOpen: boolean,
  editor: {
    isOpened: () => boolean;
    finishEditing: (restoreOriginalValue: boolean, ctrlDown: boolean) => void;
  } | null
): void {
  // If editor is open, close it first
  if (isEditorOpen && editor) {
    editor.finishEditing(false, false);
  }

  // Insert the date (column 1)
  hotInstance.setDataAtCell(row, 1, dateToInsert);

  // Move focus to next column (timeIn at column 2)
  setTimeout(() => {
    hotInstance.selectCell(row, 2);
  }, 10);
}
