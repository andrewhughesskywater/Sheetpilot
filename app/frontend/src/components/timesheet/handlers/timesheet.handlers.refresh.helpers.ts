/**
 * Helper functions for refresh handler
 */

export async function handleResetInProgress(
  resetInProgressIpcFn: () => Promise<{
    success: boolean;
    count?: number;
    error?: string;
  }>,
  logInfoFn: (message: string, meta?: Record<string, unknown>) => void,
  logWarnFn: (message: string, meta?: Record<string, unknown>) => void
): Promise<void> {
  const resetResult = await resetInProgressIpcFn();
  if (resetResult.success) {
    logInfoFn("Reset in-progress entries", {
      count: resetResult.count || 0,
    });
    if (resetResult.count && resetResult.count > 0) {
      window.alert(
        `✅ Reset ${resetResult.count} in-progress ${resetResult.count === 1 ? "entry" : "entries"} to pending status.`
      );
    }
  } else if (resetResult.error) {
    logWarnFn("Could not reset in-progress entries", {
      error: resetResult.error,
    });
  }
}

export async function handleLoadDraftData(
  loadDraftIpcFn: () => Promise<{
    success: boolean;
    entries?: unknown[];
    error?: string;
  }>,
  setTimesheetDraftData: (data: unknown[]) => void,
  logInfoFn: (message: string, meta?: Record<string, unknown>) => void,
  logWarnFn: (message: string, meta?: Record<string, unknown>) => void
): Promise<void> {
  const response = await loadDraftIpcFn();
  if (response?.success) {
    const draftData = response.entries || [];
    const rowsWithBlank =
      draftData.length > 0 && Object.keys(draftData[0] || {}).length > 0
        ? [...draftData, {}]
        : [{}];
    setTimesheetDraftData(rowsWithBlank);
    logInfoFn("Table refreshed successfully", { count: draftData.length });
  } else {
    logWarnFn("Refresh failed", { error: response?.error });
    window.alert(
      `⚠️ Could not load table data: ${response?.error || "Unknown error"}`
    );
  }
}
