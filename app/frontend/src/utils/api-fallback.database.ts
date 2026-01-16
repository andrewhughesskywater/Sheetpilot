import type { Credential, TimesheetEntry } from "./api-fallback.types";
import { mockArchiveData, mockCredentials } from "./api-fallback.data";

export const mockDatabaseAPI = {
  getAllTimesheetEntries: async (
    token: string
  ): Promise<{
    success: boolean;
    entries?: TimesheetEntry[];
    error?: string;
  }> => {
    console.log("[MockAPI] Getting all timesheet entries");
    if (!token) {
      return {
        success: false,
        error: "Session token is required",
        entries: [],
      };
    }
    return {
      success: true,
      entries: mockArchiveData,
    };
  },

  getAllArchiveData: async (
    token: string
  ): Promise<{
    success: boolean;
    timesheet?: TimesheetEntry[];
    credentials?: Credential[];
    error?: string;
  }> => {
    console.log("[MockAPI] Getting all archive data");
    if (!token) {
      return {
        success: false,
        error: "Session token is required",
        timesheet: [],
        credentials: [],
      };
    }

    return {
      success: true,
      timesheet: mockArchiveData,
      credentials: mockCredentials,
    };
  },
};
