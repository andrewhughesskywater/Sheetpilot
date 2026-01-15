/**
 * @fileoverview Window API - Database archive access
 */

export {};

declare global {
  interface Window {
    /**
     * Database archive access
     *
     * Read-only access to submitted timesheet entries and credentials.
     * Requires authentication token.
     */
    database?: {
      /** Get all submitted timesheet entries */
      getAllTimesheetEntries: (token: string) => Promise<{
        success: boolean;
        entries?: Array<{
          id: number;
          date: string;
          hours: number | null;
          project: string;
          tool?: string;
          detail_charge_code?: string;
          task_description: string;
          status?: string;
          submitted_at?: string;
        }>;
        error?: string;
      }>;
      /** Get all archive data in single batched call (timesheet + credentials) */
      getAllArchiveData: (token: string) => Promise<{
        success: boolean;
        timesheet?: Array<{
          id: number;
          date: string;
          hours: number | null;
          project: string;
          tool?: string;
          detail_charge_code?: string;
          task_description: string;
          status?: string;
          submitted_at?: string;
        }>;
        credentials?: Array<{
          id: number;
          service: string;
          email: string;
          created_at: string;
          updated_at: string;
        }>;
        error?: string;
      }>;
    };
  }
}
