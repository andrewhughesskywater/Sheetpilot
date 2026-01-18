/**
 * Helper functions for DatabaseViewer component
 * Extracted to reduce complexity and file size
 */

import { exportToCSV as exportToCSVIpc } from "@/services/ipc/timesheet";

interface ExportResponse {
  success: boolean;
  error?: string;
  csvContent?: string;
  filename?: string;
  entryCount?: number;
}

/**
 * Download CSV content as a file
 */
function downloadCSVFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Generate default filename for CSV export
 */
function getDefaultFilename(): string {
  const today = new Date().toISOString().split("T")[0];
  return `timesheet_export_${today}.csv`;
}

/**
 * Handle CSV export with validation and error handling
 */
export async function handleCSVExport(): Promise<void> {
  window.logger?.userAction("export-to-csv-clicked");

  const response: ExportResponse = await exportToCSVIpc();

  if (!response.success) {
    const errorMsg = response.error || "Could not export CSV";
    window.alert(errorMsg);
    window.logger?.error("CSV export error", { error: errorMsg });
    throw new Error(errorMsg);
  }

  if (!response.csvContent) {
    const errorMsg = "CSV content not available";
    window.alert(errorMsg);
    window.logger?.error("CSV export missing content");
    throw new Error(errorMsg);
  }

  const filename = response.filename || getDefaultFilename();
  downloadCSVFile(response.csvContent, filename);

  window.logger?.info("CSV exported successfully", {
    filename,
    entryCount: response.entryCount,
  });

  window.alert(`Successfully exported ${response.entryCount || 0} entries to ${filename}`);
}
