/**
 * Helper functions for cell operations
 */

import type { TimesheetRow } from '@/components/timesheet/schema/timesheet.schema';

/**
 * Get date column cell configuration
 */
export function getDateColumnCellConfig(
  rowData: TimesheetRow,
  row: number,
  timesheetDraftData: TimesheetRow[],
  weekdayPattern: boolean,
  getSmartPlaceholder: (previousRow: TimesheetRow | undefined, allRows: TimesheetRow[], weekdayPattern: boolean) => string
): Record<string, unknown> | null {
  if (!rowData.date) {
    const previousRow = row > 0 ? timesheetDraftData[row - 1] : undefined;
    const smartPlaceholder = getSmartPlaceholder(previousRow, timesheetDraftData, weekdayPattern);
    return {
      placeholder: smartPlaceholder
    };
  }
  return null;
}

/**
 * Get tool column cell configuration
 */
export function getToolColumnCellConfig(
  rowData: TimesheetRow,
  doesProjectNeedToolsFn: (project?: string) => boolean,
  getToolsForProjectFn: (project: string) => string[]
): Record<string, unknown> {
  const project = rowData?.project;
  if (!project || !doesProjectNeedToolsFn(project)) {
    return { 
      className: 'htDimmed', 
      placeholder: project ? 'N/A' : '',
      readOnly: false,
      source: []
    };
  }
  return { 
    source: [...getToolsForProjectFn(project)], 
    placeholder: 'Pick a Tool',
    readOnly: false
  };
}

/**
 * Get charge code column cell configuration
 */
export function getChargeCodeColumnCellConfig(
  rowData: TimesheetRow,
  doesToolNeedChargeCodeFn: (tool?: string) => boolean
): Record<string, unknown> {
  const tool = rowData?.tool;
  if (!tool || !doesToolNeedChargeCodeFn(tool)) {
    return { 
      className: 'htDimmed', 
      placeholder: tool ? 'N/A' : '',
      readOnly: false
    };
  }
  return { 
    placeholder: 'Pick a Charge Code',
    readOnly: false
  };
}
