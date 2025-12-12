import { ipcMain } from 'electron';
import { ipcLogger } from '../../../../../shared/logger';
import { getSubmittedTimesheetEntriesForExport } from '../../../repositories';
import { isTrustedIpcSender } from './main-window';

export function registerTimesheetExportHandlers(): void {
  ipcMain.handle('timesheet:exportToCSV', async (event) => {
    if (!isTrustedIpcSender(event)) {
      return { success: false, error: 'Could not export CSV: unauthorized request' };
    }
    ipcLogger.verbose('Exporting timesheet data to CSV');
    try {
      const entries = getSubmittedTimesheetEntriesForExport() as Array<{
        date: string;
        time_in: number;
        time_out: number;
        hours: number;
        project: string;
        tool?: string;
        detail_charge_code?: string;
        task_description: string;
        status: string;
        submitted_at: string;
      }>;

      if (entries.length === 0) {
        return {
          success: false,
          error: 'No submitted timesheet entries found to export'
        };
      }

      const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      };

      const headers = [
        'Date',
        'Start Time',
        'End Time',
        'Hours',
        'Project',
        'Tool',
        'Charge Code',
        'Task Description',
        'Status',
        'Submitted At'
      ];

      const csvRows = [headers.join(',')];

      for (const entry of entries) {
        const row = [
          entry.date,
          formatTime(entry.time_in),
          formatTime(entry.time_out),
          entry.hours,
          `"${entry.project.replace(/"/g, '""')}"`,
          `"${(entry.tool || '').replace(/"/g, '""')}"`,
          `"${(entry.detail_charge_code || '').replace(/"/g, '""')}"`,
          `"${entry.task_description.replace(/"/g, '""')}"`,
          entry.status,
          entry.submitted_at
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');

      ipcLogger.info('CSV export completed', {
        entryCount: entries.length,
        csvSize: csvContent.length
      });

      return {
        success: true,
        csvData: csvContent,
        csvContent,
        entryCount: entries.length,
        filename: `timesheet_export_${new Date().toISOString().split('T')[0]}.csv`
      };
    } catch (err: unknown) {
      ipcLogger.error('Could not export CSV', err);
      const errorMessage = err instanceof Error ? err.message : 'Could not export timesheet data';
      return { success: false, error: errorMessage };
    }
  });

  ipcLogger.verbose('Timesheet export handlers registered');
}


