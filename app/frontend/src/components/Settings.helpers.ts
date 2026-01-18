import {
  clearCredentials as clearCredentialsIpc,
  rebuildDatabase as rebuildDatabaseIpc,
} from "@/services/ipc/admin";
import {
  listCredentials as listCredentialsIpc,
  storeCredentials as storeCredentialsIpc,
} from "@/services/ipc/credentials";
import { getLogPath as getLogPathIpc } from "@/services/ipc/logs";
import { getSetting, setSetting } from "@/services/ipc/settings";
import {
  logError,
  logInfo,
  logUserAction,
  logWarn,
} from "@/services/ipc/logger";
import {
  type ThemeMode,
  loadThemeFromSettings as loadThemeFromSettingsUtil,
  saveThemeToSettings as saveThemeToSettingsUtil,
} from "@/utils/theme-manager";

export const loadStoredCredentials = async (
  setStoredCredentials: (
    credentials: Array<{
      id: number;
      service: string;
      email: string;
      created_at: string;
      updated_at: string;
    }>
  ) => void
) => {
  try {
    const response = await listCredentialsIpc();
    if (response?.success) {
      setStoredCredentials(response.credentials || []);
    }
  } catch (err) {
    logError("Could not load credentials", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't set error state here as it's not critical
  }
};

export const loadLogFiles = async (
  token: string | null,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string) => void,
  setLogPath: (path: string) => void,
  setLogFiles: (files: string[]) => void
) => {
  setIsLoading(true);
  setError("");

  try {
    const response = token ? await getLogPathIpc(token) : null;
    if (!response) {
      logWarn("Logs API not available");
    } else if (response.success) {
      setLogPath(response.logPath || "");
      setLogFiles(response.logFiles || []);
    } else {
      logError("Could not load log files", { error: response.error });
    }
  } catch (err) {
    logError("Error loading log files", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    setIsLoading(false);
  }
};

export const loadSettings = async (
  setHeadlessMode: (mode: boolean) => void
) => {
  try {
    const response = await getSetting("browserHeadless");
    if (response?.success && response.value !== undefined) {
      setHeadlessMode(Boolean(response.value));
    }
  } catch (err) {
    logError("Could not load settings", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const loadThemeSettings = async (
  setThemeMode: (mode: ThemeMode) => void
) => {
  try {
    const mode = await loadThemeFromSettingsUtil();
    setThemeMode(mode);
  } catch (err) {
    logError("Could not load theme settings", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const handleHeadlessModeToggle = async (
  checked: boolean,
  setIsLoadingSettings: (loading: boolean) => void,
  setHeadlessMode: (mode: boolean) => void,
  setError: (error: string) => void
) => {
  setIsLoadingSettings(true);
  try {
    const response = await setSetting("browserHeadless", checked);
    if (response?.success) {
      setHeadlessMode(checked);
      logInfo("Headless mode setting updated", { headlessMode: checked });
    } else {
      setError("Could not save headless mode setting");
      logError("Could not save headless mode setting", {
        error: response?.error,
      });
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
    logError("Headless mode toggle error", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    setIsLoadingSettings(false);
  }
};

export const handleThemeModeChange = async (
  mode: ThemeMode,
  setIsLoadingSettings: (loading: boolean) => void,
  setThemeMode: (mode: ThemeMode) => void,
  setError: (error: string) => void
) => {
  setIsLoadingSettings(true);
  try {
    await saveThemeToSettingsUtil(mode);
    setThemeMode(mode);
    logInfo("Theme mode setting updated", { themeMode: mode });
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
    logError("Theme mode change error", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    setIsLoadingSettings(false);
  }
};

export const handleUpdateCredentials = async (
  updateEmail: string,
  updatePassword: string,
  token: string | null,
  setIsUpdatingCredentials: (updating: boolean) => void,
  setError: (error: string) => void,
  setShowUpdateCredentialsDialog: (show: boolean) => void,
  setUpdateEmail: (email: string) => void,
  setUpdatePassword: (password: string) => void,
  loadStoredCredentials: () => Promise<void>
) => {
  if (!updateEmail || !updatePassword) {
    setError("Please enter both email and password");
    return;
  }

  if (!token) {
    setError("Credentials API not available");
    return;
  }

  setIsUpdatingCredentials(true);
  setError("");

  try {
    logUserAction("update-credentials", { email: updateEmail });
    const result = await storeCredentialsIpc(
      "smartsheet",
      updateEmail,
      updatePassword
    );

    if (result.success) {
      logInfo("Credentials updated successfully", { email: updateEmail });
      setShowUpdateCredentialsDialog(false);
      setUpdateEmail("");
      setUpdatePassword("");
      await loadStoredCredentials();
    } else {
      setError(result.message || "Failed to update credentials");
      logError("Could not update credentials", { error: result.message });
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error occurred";
    setError(errorMsg);
    logError("Update credentials error", { error: errorMsg });
  } finally {
    setIsUpdatingCredentials(false);
  }
};

export const handleLogout = async (
  sessionLogout: () => Promise<void>,
  setError: (error: string) => void
) => {
  try {
    await sessionLogout();
    logInfo("User logged out from Settings page");
  } catch (err) {
    logError("Could not logout", {
      error: err instanceof Error ? err.message : String(err),
    });
    setError("Could not logout");
  }
};

export const handleAdminClearCredentials = async (
  token: string | null,
  setIsAdminActionLoading: (loading: boolean) => void,
  setError: (error: string) => void,
  setShowClearCredentialsDialog: (show: boolean) => void,
  loadStoredCredentials: () => Promise<void>
) => {
  if (!token) {
    setError("Admin API not available");
    return;
  }

  setIsAdminActionLoading(true);
  setError("");

  try {
    logInfo("Admin clearing all credentials");
    const result = await clearCredentialsIpc(token);

    if (result.success) {
      logInfo("All credentials cleared by admin");
      setShowClearCredentialsDialog(false);
      await loadStoredCredentials();
    } else {
      setError(result.error || "Failed to clear credentials");
      logError("Could not clear credentials", { error: result.error });
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error occurred";
    setError(errorMsg);
    logError("Clear credentials error", { error: errorMsg });
  } finally {
    setIsAdminActionLoading(false);
  }
};

export const handleAdminRebuildDatabase = async (
  token: string | null,
  setIsAdminActionLoading: (loading: boolean) => void,
  setError: (error: string) => void,
  setShowRebuildDatabaseDialog: (show: boolean) => void,
  loadStoredCredentials: () => Promise<void>
) => {
  if (!token) {
    setError("Admin API not available");
    return;
  }

  setIsAdminActionLoading(true);
  setError("");

  try {
    logWarn("Admin rebuilding database");
    const result = await rebuildDatabaseIpc(token);

    if (result.success) {
      logInfo("Database rebuilt by admin");
      setShowRebuildDatabaseDialog(false);
      await loadStoredCredentials();
    } else {
      setError(result.error || "Failed to rebuild database");
      logError("Could not rebuild database", { error: result.error });
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error occurred";
    setError(errorMsg);
    logError("Rebuild database error", { error: errorMsg });
  } finally {
    setIsAdminActionLoading(false);
  }
};

export { exportLogs } from "./Settings.helpers.logs";
