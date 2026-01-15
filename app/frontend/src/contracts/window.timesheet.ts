/**
 * @fileoverview Window API - Timesheet operations
 */

export {};

declare global {
  interface Window {
    /**
     * Timesheet draft and submission operations
     *
     * Handles CRUD operations for draft entries and submission workflow.
     */
    timesheet?: {
      submit: (
        token: string,
        useMockWebsite?: boolean
      ) => Promise<{
        submitResult?: {
          ok: boolean;
          successCount: number;
          removedCount: number;
          totalProcessed: number;
        };
        dbPath?: string;
        error?: string;
      }>;
      cancel: () => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
      devSimulateSuccess: () => Promise<{
        success: boolean;
        count?: number;
        error?: string;
      }>;
      saveDraft: (row: {
        id?: number;
        date?: string;
        hours?: number;
        project?: string;
        tool?: string | null;
        chargeCode?: string | null;
        taskDescription?: string;
      }) => Promise<{
        success: boolean;
        changes?: number;
        id?: number;
        entry?: {
          id: number;
          date: string;
          hours: number;
          project: string;
          tool?: string | null;
          chargeCode?: string | null;
          taskDescription: string;
        };
        error?: string;
      }>;
      loadDraft: () => Promise<{
        success: boolean;
        entries?: Array<{
          id?: number;
          date?: string;
          hours?: number;
          project?: string;
          tool?: string | null;
          chargeCode?: string | null;
          taskDescription?: string;
        }>;
        error?: string;
      }>;
      loadDraftById: (id: number) => Promise<{
        success: boolean;
        entry?: {
          id: number;
          date: string;
          hours: number;
          project: string;
          tool?: string | null;
          chargeCode?: string | null;
          taskDescription: string;
        };
        error?: string;
      }>;
      deleteDraft: (
        id: number
      ) => Promise<{ success: boolean; error?: string }>;
      resetInProgress: () => Promise<{
        success: boolean;
        count?: number;
        error?: string;
      }>;
      exportToCSV: () => Promise<{
        success: boolean;
        csvContent?: string;
        entryCount?: number;
        filename?: string;
        error?: string;
      }>;
      /** Subscribe to submission progress updates */
      onSubmissionProgress: (
        callback: (progress: {
          percent: number;
          current: number;
          total: number;
          message: string;
        }) => void
      ) => void;
      /** Unsubscribe from progress updates */
      removeProgressListener: () => void;
    };
  }
}
