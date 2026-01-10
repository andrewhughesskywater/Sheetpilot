import type { TimesheetUIPlugin } from '@sheetpilot/shared/plugin-types';

import type { TimesheetRow } from '@/components/timesheet/timesheet.schema';
import { loadColumnWidths } from '@/components/timesheet/utils/columnWidthStorage';

type ColumnConfig = {
  data: string;
  type: string;
  title: string;
  placeholder: string;
};

const baseColumnConfigs: ColumnConfig[] = [
  {
    data: 'date',
    type: 'text',
    title: 'Date',
    placeholder: 'MM/DD/YYYY',
  },
  {
    data: 'timeIn',
    type: 'text',
    title: 'Start Time',
    placeholder: 'HH:MM',
  },
  {
    data: 'timeOut',
    type: 'text',
    title: 'End Time',
    placeholder: 'HH:MM',
  },
  {
    data: 'project',
    type: 'text',
    title: 'Project',
    placeholder: 'Select project',
  },
  {
    data: 'tool',
    type: 'text',
    title: 'Tool',
    placeholder: 'Tool (if required)',
  },
  {
    data: 'chargeCode',
    type: 'text',
    title: 'Charge Code',
    placeholder: 'Charge code (if required)',
  },
  {
    data: 'taskDescription',
    type: 'text',
    title: 'What You Did',
    placeholder: 'Task description',
  },
];

function applySavedWidths(
  configs: ColumnConfig[],
  savedWidths: Record<string, number | undefined> | null
): Array<ColumnConfig & { width?: number | undefined }> {
  return configs.map((config) => ({
    ...config,
    width: savedWidths?.[config.data] ?? undefined,
  }));
}

/**
 * Default Handsontable-based Timesheet UI plugin
 * Provides grid configuration with proper column definitions, headers, and placeholders.
 */
export class HandsontableTimesheetUIPlugin implements TimesheetUIPlugin<TimesheetRow, unknown> {
  readonly metadata = {
    name: 'handsontable-timesheet-ui',
    version: '1.0.0',
    author: 'Sheetpilot',
    description: 'Handsontable-backed UI plugin for timesheet grid',
  };

  initialize(): void {}
  dispose(): void {}

  buildColumns(_rows: TimesheetRow[]): unknown[] {
    const savedWidths = loadColumnWidths();
    return applySavedWidths(baseColumnConfigs, savedWidths) as unknown[];
  }

  buildCellsMeta(): () => Record<string, never> {
    // Return a function that provides meta information for specific cells
    return () => ({});
  }

  handlers = {
    // Event handlers can be added here as needed; left as no-ops for now
  } as Record<string, unknown>;
}
