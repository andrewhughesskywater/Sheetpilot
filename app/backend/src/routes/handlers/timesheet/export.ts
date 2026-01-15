import { ipcMain } from "electron";
import { ipcLogger } from "@sheetpilot/shared/logger";
import { getSubmittedTimesheetEntriesForExport } from "@/models";
import { isTrustedIpcSender } from "./main-window";

export function registerTimesheetExportHandlers(): void {
  ipcMain.handle("timesheet:exportToCSV", async (event) => {
    if (!isTrustedIpcSender(event)) {
      return {
        success: false,
        error: "Could not export CSV: unauthorized request",
      };
    }
    ipcLogger.verbose("Exporting timesheet data to CSV");
    try {
      const entries = getSubmittedTimesheetEntriesForExport() as Array<{
        date: string;
        hours: number | null;
        project: string;
        tool?: string;
        detail_charge_code?: string;
        task_description: string;
        status: string;
        submitted_at: string;
      }>;

      if (entries.length === 0) {
        return {
          success: false,
          error: "No submitted timesheet entries found to export",
        };
      }

      const headers = [
        "Date",
        "Hours",
        "Project",
        "Tool",
        "Charge Code",
        "Task Description",
        "Status",
        "Submitted At",
      ];

      const csvRows = [headers.join(",")];

      for (const entry of entries) {
        const row = [
          entry.date,
          entry.hours !== null && entry.hours !== undefined
            ? entry.hours.toFixed(2)
            : "",
          `"${entry.project.replace(/"/g, '""')}"`,
          `"${(entry.tool || "").replace(/"/g, '""')}"`,
          `"${(entry.detail_charge_code || "").replace(/"/g, '""')}"`,
          `"${entry.task_description.replace(/"/g, '""')}"`,
          entry.status,
          entry.submitted_at,
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");

      ipcLogger.info("CSV export completed", {
        entryCount: entries.length,
        csvSize: csvContent.length,
      });

      return {
        success: true,
        csvData: csvContent,
        csvContent,
        entryCount: entries.length,
        filename: `timesheet_export_${new Date().toISOString().split("T")[0]}.csv`,
      };
    } catch (err: unknown) {
      ipcLogger.error("Could not export CSV", err);
      const errorMessage =
        err instanceof Error ? err.message : "Could not export timesheet data";
      return { success: false, error: errorMessage };
    }
  });

  ipcLogger.verbose("Timesheet export handlers registered");
}
