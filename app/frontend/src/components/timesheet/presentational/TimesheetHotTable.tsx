import { forwardRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import type { HotTableRef } from '@handsontable/react-wrapper';

interface TimesheetHotTableProps {
  data: unknown[];
  columns: any;
  cells: any;
  handlers: {
    beforeRemoveRow?: any;
    afterChange?: any;
    afterRemoveRow?: any;
    beforePaste?: any;
    afterPaste?: any;
    afterBeginEditing?: any;
    beforeKeyDown?: any;
    afterSelection?: any;
  };
}

export const TimesheetHotTable = forwardRef<HotTableRef | null, TimesheetHotTableProps>(function TimesheetHotTable(
  { data, columns, cells, handlers },
  ref
) {
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
      themeName="ht-theme-horizon"
      width="100%"
      rowHeaders={true}
      colHeaders={true}
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
