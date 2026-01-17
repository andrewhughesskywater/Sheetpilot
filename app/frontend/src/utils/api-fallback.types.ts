export interface TimesheetRow {
  id?: number;
  date?: string;
  hours?: number;
  project?: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription?: string;
}

export interface TimesheetEntry {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string;
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
}

export interface Credential {
  id: number;
  service: string;
  email: string;
  created_at: string;
  updated_at: string;
}
