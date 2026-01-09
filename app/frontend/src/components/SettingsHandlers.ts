/**
 * @fileoverview Async handler functions for Settings operations
 */

import { logError, logInfo, logUserAction, logWarn } from '@/services/ipc/logger';
import { clearCredentials as clearCredentialsIpc, rebuildDatabase as rebuildDatabaseIpc } from '@/services/ipc/admin';
import { storeCredentials as storeCredentialsIpc } from '@/services/ipc/credentials';
import { exportLogs as exportLogsIpc } from '@/services/ipc/logs';
import { setSetting } from '@/services/ipc/settings';

export async function toggleHeadlessMode(
  checked: boolean,
  setHeadlessModeState: (value: boolean) => void,
  setErrorState: (value: string) => void,
  setIsLoadingSettingsState: (value: boolean) => void
): Promise<void> {
  setIsLoadingSettingsState(true);
  try {
    const response = await setSetting('browserHeadless', checked);
    if (response?.success) {
      setHeadlessModeState(checked);
      logInfo('Headless mode setting updated', { headlessMode: checked });
      return;
    }

    setErrorState('Could not save headless mode setting');
    logError('Could not save headless mode setting', { error: response?.error });
  } catch (err) {
    setErrorState(err instanceof Error ? err.message : 'Unknown error');
    logError('Headless mode toggle error', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    setIsLoadingSettingsState(false);
  }
}

export async function updateSmartsheetCredentials(
  token: string | null,
  { email, password, setError, setIsUpdating, onSuccess }: {
    email: string;
    password: string;
    setError: (value: string) => void;
    setIsUpdating: (value: boolean) => void;
    onSuccess: () => Promise<void>;
  }
): Promise<void> {
  if (!email || !password) {
    setError('Please enter both email and password');
    return;
  }

  if (!token) {
    setError('Credentials API not available');
    return;
  }

  setIsUpdating(true);
  setError('');

  try {
    logUserAction('update-credentials', { email });
    const result = await storeCredentialsIpc('smartsheet', email, password);

    if (result.success) {
      logInfo('Credentials updated successfully', { email });
      await onSuccess();
      return;
    }

    setError(result.message || 'Failed to update credentials');
    logError('Could not update credentials', { error: result.message });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
    setError(errorMsg);
    logError('Update credentials error', { error: errorMsg });
  } finally {
    setIsUpdating(false);
  }
}

export async function adminClearCredentials(
  token: string | null,
  setErrorState: (value: string) => void,
  setIsAdminActionLoadingState: (value: boolean) => void,
  onSuccess: () => Promise<void>
): Promise<void> {
  if (!token) {
    setErrorState('Admin API not available');
    return;
  }

  setIsAdminActionLoadingState(true);
  setErrorState('');

  try {
    logInfo('Admin clearing all credentials');
    const result = await clearCredentialsIpc(token);

    if (result.success) {
      logInfo('All credentials cleared by admin');
      await onSuccess();
      return;
    }

    setErrorState(result.error || 'Failed to clear credentials');
    logError('Could not clear credentials', { error: result.error });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
    setErrorState(errorMsg);
    logError('Clear credentials error', { error: errorMsg });
  } finally {
    setIsAdminActionLoadingState(false);
  }
}

export async function adminRebuildDatabase(
  token: string | null,
  setErrorState: (value: string) => void,
  setIsAdminActionLoadingState: (value: boolean) => void,
  onSuccess: () => Promise<void>
): Promise<void> {
  if (!token) {
    setErrorState('Admin API not available');
    return;
  }

  setIsAdminActionLoadingState(true);
  setErrorState('');

  try {
    logWarn('Admin rebuilding database');
    const result = await rebuildDatabaseIpc(token);

    if (result.success) {
      logInfo('Database rebuilt by admin');
      await onSuccess();
      return;
    }

    setErrorState(result.error || 'Failed to rebuild database');
    logError('Could not rebuild database', { error: result.error });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
    setErrorState(errorMsg);
    logError('Rebuild database error', { error: errorMsg });
  } finally {
    setIsAdminActionLoadingState(false);
  }
}

export async function exportLogsToFile(
  token: string | null,
  { logFiles, logPath, setError, setIsExporting }: {
    logFiles: string[];
    logPath: string;
    setError: (value: string) => void;
    setIsExporting: (value: boolean) => void;
  }
): Promise<void> {
  if (!token) {
    const errorMsg = 'Session token not available';
    setError(errorMsg);
    logWarn('Export logs attempted without session token');
    return;
  }

  if (!logFiles || logFiles.length === 0) {
    const errorMsg = 'No log files available';
    setError(errorMsg);
    logWarn('Export logs attempted with no log files available');
    return;
  }

  if (!logPath) {
    const errorMsg = 'Log path not available';
    setError(errorMsg);
    logWarn('Export logs attempted with no log path');
    return;
  }

  setIsExporting(true);
  setError('');

  let downloadUrl: string | null = null;

  try {
    const response = await exportLogsIpc(token, logPath, 'txt');
    if (!response) {
      const errorMsg = 'Logs API returned no response';
      setError(errorMsg);
      logError('Export logs returned no response', { logPath });
      return;
    }

    if (!response.success) {
      const errorMsg = response.error || 'Failed to export logs';
      setError(errorMsg);
      logError('Could not export logs', { error: errorMsg });
      return;
    }

    if (!response.content) {
      const errorMsg = 'Log file content is empty';
      setError(errorMsg);
      logError('Export logs returned empty content');
      return;
    }

    if (!response.filename) {
      const errorMsg = 'Log filename not provided';
      setError(errorMsg);
      logError('Export logs missing filename');
      return;
    }

    try {
      const blob = new Blob([response.content], { type: response.mimeType || 'text/plain' });
      downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = response.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      logInfo('Logs exported successfully', { filename: response.filename });
    } catch (blobError) {
      const errorMsg = `Failed to create download: ${blobError instanceof Error ? blobError.message : String(blobError)}`;
      setError(errorMsg);
      logError('Export logs failed - blob creation error', {
        error: blobError instanceof Error ? blobError.message : String(blobError)
      });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    setError(errorMsg);
    logError('Export logs error', { error: errorMsg, stack: err instanceof Error ? err.stack : undefined });
  } finally {
    if (downloadUrl) {
      try {
        URL.revokeObjectURL(downloadUrl);
      } catch (revokeError) {
        logWarn('Could not revoke blob URL', {
          error: revokeError instanceof Error ? revokeError.message : String(revokeError)
        });
      }
    }
    setIsExporting(false);
  }
}
