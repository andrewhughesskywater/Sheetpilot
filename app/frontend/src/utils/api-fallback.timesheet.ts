import type { TimesheetRow } from "./api-fallback.types";
import { mockTimesheetData } from "./api-fallback.data";

export const mockTimesheetAPI = {
  loadDraft: async (): Promise<{
    success: boolean;
    entries?: TimesheetRow[];
    error?: string;
  }> => {
    console.log("[MockAPI] Loading timesheet draft data");
    return {
      success: true,
      entries: mockTimesheetData,
    };
  },

  saveDraft: async (
    row: TimesheetRow & { id?: number }
  ): Promise<{ success: boolean; changes?: number; error?: string }> => {
    console.log("[MockAPI] Saving timesheet draft:", row);
    return {
      success: true,
      changes: 1,
    };
  },

  deleteDraft: async (
    id: number
  ): Promise<{ success: boolean; error?: string }> => {
    console.log("[MockAPI] Deleting timesheet draft:", id);
    return {
      success: true,
    };
  },

  submit: async (): Promise<{
    submitResult?: {
      ok: boolean;
      successCount: number;
      removedCount: number;
      totalProcessed: number;
    };
    dbPath?: string;
    error?: string;
  }> => {
    console.log("[MockAPI] Submitting timesheet");
    return {
      submitResult: {
        ok: true,
        successCount: 1,
        removedCount: 0,
        totalProcessed: 1,
      },
    };
  },

  exportToCSV: async (): Promise<{
    success: boolean;
    csvContent?: string;
    entryCount?: number;
    filename?: string;
    error?: string;
  }> => {
    console.log("[MockAPI] Exporting to CSV");
    return {
      success: true,
      csvContent: "Date,Hours,Project\n2024-10-25,8.00,SheetPilot Development",
      entryCount: 1,
      filename: "timesheet_export_2024-10-25.csv",
    };
  },
};
