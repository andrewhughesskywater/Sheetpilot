import type { TimesheetUIPlugin } from '@sheetpilot/shared/plugin-types';
import type { TimesheetRow } from '@/components/timesheet/timesheet.schema';

/**
 * Default Handsontable-based Timesheet UI plugin
 * Provides minimal, framework-compatible hooks to keep current behavior.
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
    // Let Handsontable infer columns by returning undefined
    return undefined as unknown as unknown[];
  }

  buildCellsMeta() {
    // Return empty cells meta to use grid defaults
    return () => ({
      // Intentionally empty; keep default behavior
    });
  }

  handlers = {
    // Event handlers can be added here as needed; left as no-ops for now
  } as Record<string, unknown>;
}
