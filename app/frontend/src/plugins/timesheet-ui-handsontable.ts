import type { TimesheetUIPlugin } from '@sheetpilot/shared/plugin-types';
import type { TimesheetRow } from '@/components/timesheet/timesheet.schema';
import { loadColumnWidths } from '@/components/timesheet/utils/columnWidthStorage';

/**
 * Default Handsontable-based Timesheet UI plugin
 * Provides grid configuration with proper column definitions, headers, and placeholders.
 */
export class HandsontableTimesheetUIPlugin implements TimesheetUIPlugin<TimesheetRow, unknown> {
  readonly metadata = {
    name: 'handsontable-timesheet-ui',
    version: '1.0.0',
    author: 'Sheetpilot',
    description: 'Handsontable-backed UI plugin for timesheet grid'
  };

  initialize(): void {}
  dispose(): void {}

  buildColumns(_rows: TimesheetRow[]) {
    // Load saved column widths from localStorage
    const savedWidths = loadColumnWidths();
    
    // Define explicit column configuration with proper headers and placeholders
    const columns = [
      {
        data: 'date',
        type: 'text',
        title: 'Date',
        placeholder: 'MM/DD/YYYY',
        width: savedWidths?.['date'] ?? undefined
      },
      {
        data: 'timeIn',
        type: 'text',
        title: 'Start Time',
        placeholder: 'HH:MM',
        width: savedWidths?.['timeIn'] ?? undefined
      },
      {
        data: 'timeOut',
        type: 'text',
        title: 'End Time',
        placeholder: 'HH:MM',
        width: savedWidths?.['timeOut'] ?? undefined
      },
      {
        data: 'project',
        type: 'text',
        title: 'Project',
        placeholder: 'Select project',
        width: savedWidths?.['project'] ?? undefined
      },
      {
        data: 'tool',
        type: 'text',
        title: 'Tool',
        placeholder: 'Tool (if required)',
        width: savedWidths?.['tool'] ?? undefined
      },
      {
        data: 'chargeCode',
        type: 'text',
        title: 'Charge Code',
        placeholder: 'Charge code (if required)',
        width: savedWidths?.['chargeCode'] ?? undefined
      },
      {
        data: 'taskDescription',
        type: 'text',
        title: 'What You Did',
        placeholder: 'Task description',
        width: savedWidths?.['taskDescription'] ?? undefined
      }
    ];
    
    return columns as unknown as unknown[];
  }

  buildCellsMeta() {
    // Return a function that provides meta information for specific cells
    return () => ({
      // Keep default cell behavior; validation and styling handled elsewhere
    });
  }

  handlers = {
    // Event handlers can be added here as needed; left as no-ops for now
  } as Record<string, unknown>;
}
