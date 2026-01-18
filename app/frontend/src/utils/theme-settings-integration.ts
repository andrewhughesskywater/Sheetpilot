/**
 * Theme Settings Backend Integration
 * Handles loading and saving theme preferences to backend settings
 * Extracted from theme-manager.ts to reduce complexity
 */

import {
  type ThemeMode,
  setStoredTheme,
  getStoredTheme,
  applyTheme,
} from "./theme-manager";

type WindowLogger = {
  logger?: {
    error?: (msg: string, data?: unknown) => void;
    warn?: (msg: string, data?: unknown) => void;
  };
};

function getWindowLogger(): WindowLogger["logger"] {
  return (window as unknown as WindowLogger).logger;
}

/**
 * Validate theme mode value
 */
function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

/**
 * Load theme from backend settings API
 */
async function loadFromBackend(): Promise<ThemeMode | null> {
  if (!window.settings?.get) {
    return null;
  }

  const response = await window.settings.get("themeMode");
  if (response?.success && response.value && isValidThemeMode(response.value)) {
    return response.value;
  }

  return null;
}

/**
 * Save theme to backend settings API
 */
async function saveToBackend(mode: ThemeMode): Promise<boolean> {
  if (!window.settings?.set) {
    return false;
  }

  const response = await window.settings.set("themeMode", mode);
  return response?.success === true;
}

/**
 * Load theme from backend settings
 * Falls back to localStorage if backend is unavailable
 */
export async function loadThemeFromSettings(): Promise<ThemeMode> {
  try {
    const backendMode = await loadFromBackend();
    if (backendMode) {
      setStoredTheme(backendMode);
      applyTheme(backendMode);
      return backendMode;
    }
  } catch (error) {
    getWindowLogger()?.warn?.("Could not load theme from backend settings", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const stored = getStoredTheme();
  if (stored) {
    applyTheme(stored);
    return stored;
  }

  const defaultMode: ThemeMode = "auto";
  applyTheme(defaultMode);
  return defaultMode;
}

/**
 * Save theme to backend settings
 * Also caches in localStorage for fast initial load
 */
export async function saveThemeToSettings(mode: ThemeMode): Promise<void> {
  setStoredTheme(mode);
  applyTheme(mode);

  try {
    const success = await saveToBackend(mode);
    if (!success) {
      getWindowLogger()?.error?.("Could not save theme to backend settings", {
        error: "Backend save failed",
      });
    }
  } catch (error) {
    getWindowLogger()?.error?.("Could not save theme to backend settings", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
