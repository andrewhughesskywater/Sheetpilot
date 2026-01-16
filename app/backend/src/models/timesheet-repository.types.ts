export interface TimesheetDedupKey {
  date: string;
  project: string;
  taskDescription: string;
}

export interface TimesheetBulkInsertEntry {
  date: string;
  hours: number;
  project: string;
  tool?: string | null;
  detailChargeCode?: string | null;
  taskDescription: string;
}

export interface TimesheetDbRow {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string | null;
  detail_charge_code?: string | null;
  task_description: string;
  status?: string | null;
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}
