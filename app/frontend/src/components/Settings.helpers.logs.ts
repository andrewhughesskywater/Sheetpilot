import { exportLogs as exportLogsIpc } from "@/services/ipc/logs";
import { logError, logInfo, logWarn } from "@/services/ipc/logger";

const validateExportLogsInputs = (
  token: string | null,
  logFiles: string[],
  logPath: string,
  setError: (error: string) => void
): boolean => {
  if (!token) {
    const errorMsg = "Session token not available";
    setError(errorMsg);
    logWarn("Export logs attempted without session token");
    return false;
  }

  // Use the latest log file if available
  if (!logFiles || logFiles.length === 0) {
    const errorMsg = "No log files available";
    setError(errorMsg);
    logWarn("Export logs attempted with no log files available");
    return false;
  }

  if (!logPath) {
    const errorMsg = "Log path not available";
    setError(errorMsg);
    logWarn("Export logs attempted with no log path");
    return false;
  }

  return true;
};

const validateExportLogsResponse = (
  response: {
    success: boolean;
    error?: string;
    content?: string;
    filename?: string;
  } | null,
  logPath: string,
  setError: (error: string) => void
): { content: string; filename: string; mimeType?: string } | null => {
  if (!response) {
    const errorMsg = "Logs API returned no response";
    setError(errorMsg);
    logError("Export logs returned no response", { logPath });
    return null;
  }

  if (!response.success) {
    const errorMsg = response.error || "Failed to export logs";
    setError(errorMsg);
    logError("Could not export logs", { error: errorMsg });
    return null;
  }

  if (!response.content) {
    const errorMsg = "Log file content is empty";
    setError(errorMsg);
    logError("Export logs returned empty content");
    return null;
  }

  if (!response.filename) {
    const errorMsg = "Log filename not provided";
    setError(errorMsg);
    logError("Export logs missing filename");
    return null;
  }

  const result: { content: string; filename: string; mimeType?: string } = {
    content: response.content,
    filename: response.filename,
  };
  const mimeType = (response as { mimeType?: string }).mimeType;
  if (mimeType !== undefined) {
    result.mimeType = mimeType;
  }
  return result;
};

const downloadLogFile = (
  content: string,
  filename: string,
  mimeType: string | undefined,
  setError: (error: string) => void
): string | null => {
  try {
    const blob = new Blob([content], { type: mimeType || "text/plain" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    logInfo("Logs exported successfully", { filename });
    return downloadUrl;
  } catch (blobError) {
    const errorMsg = `Failed to create download: ${blobError instanceof Error ? blobError.message : String(blobError)}`;
    setError(errorMsg);
    logError("Export logs failed - blob creation error", {
      error: blobError instanceof Error ? blobError.message : String(blobError),
    });
    return null;
  }
};

const tryExportLogs = async (
  token: string,
  logPath: string,
  setError: (error: string) => void
): Promise<string | null> => {
  try {
    // logPath is already the full path to the latest log file from the backend
    const response = await exportLogsIpc(token, logPath, "txt");

    const validatedData = validateExportLogsResponse(
      response,
      logPath,
      setError
    );
    if (!validatedData) {
      return null;
    }

    return downloadLogFile(
      validatedData.content,
      validatedData.filename,
      validatedData.mimeType,
      setError
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    setError(errorMsg);
    logError("Export logs error", {
      error: errorMsg,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return null;
  }
};

const cleanupDownloadUrl = (downloadUrl: string): void => {
  try {
    URL.revokeObjectURL(downloadUrl);
  } catch (revokeError) {
    logWarn("Could not revoke blob URL", {
      error:
        revokeError instanceof Error ? revokeError.message : String(revokeError),
    });
  }
};

export const exportLogs = async (
  token: string | null,
  logFiles: string[],
  logPath: string,
  setIsExporting: (exporting: boolean) => void,
  setError: (error: string) => void
) => {
  if (!validateExportLogsInputs(token, logFiles, logPath, setError)) {
    return;
  }

  setIsExporting(true);
  setError("");

  // token is validated as non-null by validateExportLogsInputs
  const downloadUrl = await tryExportLogs(token!, logPath, setError);
  if (downloadUrl) {
    cleanupDownloadUrl(downloadUrl);
  }
  setIsExporting(false);
};
