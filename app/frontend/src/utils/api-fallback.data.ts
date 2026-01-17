import type { Credential, TimesheetEntry, TimesheetRow } from "./api-fallback.types";

export const mockTimesheetData: TimesheetRow[] = [
  {
    id: 1,
    date: "10/25/2024",
    hours: 8.0,
    project: "SheetPilot Development",
    tool: "VS Code",
    chargeCode: "DEV-001",
    taskDescription: "Working on application features",
  },
  {
    id: 2,
    date: "10/24/2024",
    hours: 8.0,
    project: "Bug Fixes",
    tool: "Debugger",
    chargeCode: "BUG-002",
    taskDescription: "Fixed rendering issues",
  },
];

export const mockArchiveData: TimesheetEntry[] = [
  {
    id: 1,
    date: "2024-10-25",
    hours: 8.0,
    project: "SheetPilot Development",
    tool: "VS Code",
    detail_charge_code: "DEV-001",
    task_description: "Working on application features",
    status: "Complete",
    submitted_at: "2024-10-25T17:00:00Z",
  },
];

export const mockCredentials: Credential[] = [
  {
    id: 1,
    service: "smartsheet",
    email: "developer@company.com",
    created_at: "2024-10-25T10:00:00Z",
    updated_at: "2024-10-25T10:00:00Z",
  },
];
