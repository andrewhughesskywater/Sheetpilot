export interface ArchiveResponse {
  success: boolean;
  timesheet?: Array<{
    id: number;
    date: string;
    time_in: number;
    time_out: number;
    hours: number;
    project: string;
    tool?: string;
    detail_charge_code?: string;
    task_description: string;
    status?: string;
    submitted_at?: string;
  }>;
  credentials?: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>;
  error?: string;
}

export async function getAllArchiveData(token: string): Promise<ArchiveResponse | null> {
  if (!window.database?.getAllArchiveData) {
    return null;
  }
  return window.database.getAllArchiveData(token);
}


