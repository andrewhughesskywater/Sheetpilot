import { useCallback } from 'react';

interface SelectionData {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export function useSelectionHandler() {
  const updateSelectedRows = useCallback(
    (selection: SelectionData, setSelectedRows: (rows: Set<number>) => void): void => {
      const rows = new Set<number>();
      const startRow = Math.min(selection.r1, selection.r2);
      const endRow = Math.max(selection.r1, selection.r2);

      for (let r = startRow; r <= endRow; r++) {
        rows.add(r);
      }

      setSelectedRows(rows);
    },
    []
  );

  const handleAfterSelection = useCallback(
    (
      selection: SelectionData,
      setSelectedRows: (rows: Set<number>) => void,
      setSelectedColumn: (col: number | null) => void
    ): void => {
      // Single cell selection
      if (selection.r1 === selection.r2 && selection.c1 === selection.c2) {
        setSelectedRows(new Set([selection.r1]));
        setSelectedColumn(selection.c1);
        return;
      }

      // Row-wise selection
      if (selection.c1 === 0 && selection.c2 === 6) {
        updateSelectedRows(selection, setSelectedRows);
        setSelectedColumn(null);
        return;
      }

      // Column-wise selection
      if (selection.r1 === 0 && selection.c1 === selection.c2) {
        setSelectedColumn(selection.c1);
        setSelectedRows(new Set());
        return;
      }

      // Range selection
      updateSelectedRows(selection, setSelectedRows);
      setSelectedColumn(null);
    },
    [updateSelectedRows]
  );

  return { handleAfterSelection, updateSelectedRows };
}
