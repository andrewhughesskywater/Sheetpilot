import { ipcRenderer } from "electron";

export const databaseBridge = {
  getAllTimesheetEntries: (
    token: string
  ): Promise<{
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
  }> => ipcRenderer.invoke("database:getAllTimesheetEntries", token),
  getAllArchiveData: (
    token: string
  ): Promise<{
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
  }> => ipcRenderer.invoke("database:getAllArchiveData", token),
};
