export type DraftRowEntry = {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string | null;
  detail_charge_code?: string | null;
  task_description: string;
};
