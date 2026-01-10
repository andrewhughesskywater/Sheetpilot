import type { TimesheetValidationPlugin } from '@sheetpilot/shared/plugin-types';

import type { TimesheetRow } from '@/components/timesheet/timesheet.schema';

/**
 * Basic timesheet validation plugin
 * Currently returns no errors; can be expanded to use detailed rules.
 */
export class BasicTimesheetValidationPlugin implements TimesheetValidationPlugin<TimesheetRow, unknown> {
  readonly metadata = {
    name: 'basic-timesheet-validation',
    version: '1.0.0',
    author: 'Sheetpilot',
    description: 'Basic validation for timesheet rows',
  };

  initialize(): void {}
  dispose(): void {}

  validate(_rows: TimesheetRow[]): unknown[] {
    // No-op validation for now; preserve existing behavior
    return [] as unknown[];
  }
}
