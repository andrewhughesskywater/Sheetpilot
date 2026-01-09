import type { HotTableRef } from '@handsontable/react-wrapper';
import { HotTable } from '@handsontable/react-wrapper';
import { forwardRef } from 'react';

// Handsontable event handler types
type BeforeRemoveRowHandler = (index: number, amount: number) => void;
type AfterChangeHandler = (changes: Array<[number, string | number, unknown, unknown]> | null, source: string) => void;
type AfterRemoveRowHandler = (index: number, amount: number) => void;
type BeforePasteHandler = (data: unknown[][], coords: unknown[]) => boolean | void;
type AfterPasteHandler = (data: unknown[][], coords: unknown[]) => void;
type AfterBeginEditingHandler = (row: number, col: number) => void;
type BeforeKeyDownHandler = (event: KeyboardEvent) => boolean | void;
type AfterSelectionHandler = (row: number, col: number, row2: number, col2: number) => void;
type AfterColumnResizeHandler = (newSize: number, column: number, isDoubleClick: boolean) => void;
type AfterRowResizeHandler = (newSize: number, row: number, isDoubleClick: boolean) => void;

interface TimesheetHotTableProps {
  data: unknown[];
  columns: Array<Record<string, unknown>>;
  cells: (row: number, col: number) => Record<string, unknown> | void;
  handlers: {
    beforeRemoveRow?: BeforeRemoveRowHandler;
    afterChange?: AfterChangeHandler;
    afterRemoveRow?: AfterRemoveRowHandler;
    beforePaste?: BeforePasteHandler;
    afterPaste?: AfterPasteHandler;
    afterBeginEditing?: AfterBeginEditingHandler;
    beforeKeyDown?: BeforeKeyDownHandler;
    afterSelection?: AfterSelectionHandler;
    afterColumnResize?: AfterColumnResizeHandler;
    afterRowResize?: AfterRowResizeHandler;
  };
  rowHeight?: number;
}

export const TimesheetHotTable = forwardRef<HotTableRef | null, TimesheetHotTableProps>((
  { data, columns, cells, handlers, rowHeight },
  ref
) => {
  // Extract column headers from column definitions as strings
  const colHeaders =
    columns?.map((col: Record<string, unknown>) => {
      const title = col['title'];
      const dataKey = col['data'];
      return typeof title === 'string' ? title : typeof dataKey === 'string' ? dataKey : '';
    }) || true;

  return (
    <HotTable
      ref={ref}
      id="sheetpilot-timesheet-grid"
      data={data}
      columns={columns}
      cells={cells}
      beforeRemoveRow={handlers.beforeRemoveRow}
      afterChange={handlers.afterChange}
      afterRemoveRow={handlers.afterRemoveRow}
      beforePaste={handlers.beforePaste}
      afterPaste={handlers.afterPaste}
      afterBeginEditing={handlers.afterBeginEditing}
      beforeKeyDown={handlers.beforeKeyDown}
      afterSelection={handlers.afterSelection}
      afterColumnResize={handlers.afterColumnResize}
      afterRowResize={handlers.afterRowResize}
      rowHeights={rowHeight ? () => rowHeight : undefined}
      colHeaders={colHeaders as unknown as boolean | string[] | ((index: number) => string)}
      themeName="ht-theme-horizon"
      width="100%"
      rowHeaders={true}
      customBorders={[]}
      contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo', '---------', 'copy', 'cut']}
      manualColumnResize={true}
      manualRowResize={true}
      stretchH="all"
      licenseKey="non-commercial-and-evaluation"
      minSpareRows={1}
      readOnly={false}
      fillHandle={true}
      autoWrapRow={false}
      autoWrapCol={false}
      fragmentSelection={true}
      disableVisualSelection={false}
      selectionMode="range"
      outsideClickDeselects={true}
      viewportRowRenderingOffset={24}
      columnSorting={{ indicator: true, headerAction: true, sortEmptyCells: true }}
      tabNavigation={true}
      navigableHeaders={true}
      copyPaste={true}
      search={true}
      enterMoves={{ row: 1, col: 0 }}
      tabMoves={{ row: 0, col: 1 }}
      invalidCellClassName="htInvalid"
    />
  );
});
