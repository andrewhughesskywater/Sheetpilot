/**
 * Material Design 3 Theme Manager
 * Handles dynamic theme switching between light and dark modes
 */

export type ThemeMode = "light" | "dark" | "auto";

const THEME_STORAGE_KEY = "sheetpilot-theme-mode";

type WindowLogger = {
  logger?: {
    error?: (msg: string, data?: unknown) => void;
    warn?: (msg: string, data?: unknown) => void;
    debug?: (msg: string, data?: unknown) => void;
  };
};

function getWindowLogger(): WindowLogger["logger"] {
  return (window as unknown as WindowLogger).logger;
}

/**
 * Get the current system theme preference
 */
export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Get the stored theme preference from localStorage
 */
export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "auto" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Store theme preference in localStorage
 */
export function setStoredTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    getWindowLogger()?.error?.("Failed to store theme", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get the effective theme (resolving 'auto' to actual theme)
 */
export function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") {
    return getSystemTheme();
  }
  return mode;
}

/**
 * Apply theme to the document root
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;

  const effectiveTheme = getEffectiveTheme(mode);

  // Set data-theme attribute on root element
  document.documentElement.setAttribute("data-theme", effectiveTheme);

  // Update color-scheme for native form controls
  document.documentElement.style.colorScheme = effectiveTheme;

  // Dispatch custom event for components that need to react to theme changes
  window.dispatchEvent(
    new CustomEvent("theme-change", { detail: { mode, effectiveTheme } })
  );
  getWindowLogger()?.debug?.("[ThemeManager] Applied theme", {
    theme: effectiveTheme,
    mode,
  });
}

/**
 * Set up listener for system theme changes
 */
export function setupSystemThemeListener(): void {
  if (typeof window === "undefined" || !window.matchMedia) return;

  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    if (mediaQuery && typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", () => {
        const currentMode = getStoredTheme() || "auto";
        if (currentMode === "auto") {
          applyTheme("auto");
        }
      });
    }
  } catch (error) {
    getWindowLogger()?.warn?.("Could not set up theme change listener", {
      error: String(error),
    });
  }
}

/**
 * Initialize theme system
 * Returns the initial theme mode
 */
export function initializeTheme(): ThemeMode {
  const stored = getStoredTheme();
  const mode = stored || "auto";

  applyTheme(mode);
  setupSystemThemeListener();

  return mode;
}

/**
 * Toggle between light and dark themes
 * (Does not support auto mode for toggle)
 */
export function toggleTheme(): ThemeMode {
  const current = getStoredTheme() || "auto";
  const effectiveCurrent = getEffectiveTheme(current);
  const newMode: ThemeMode = effectiveCurrent === "light" ? "dark" : "light";

  setStoredTheme(newMode);
  applyTheme(newMode);

  return newMode;
}

/**
 * Set specific theme mode
 */
export function setThemeMode(mode: ThemeMode): void {
  setStoredTheme(mode);
  applyTheme(mode);
}

/**
 * Get the current active theme mode
 */
export function getCurrentTheme(): ThemeMode {
  return getStoredTheme() || "auto";
}

/**
 * Get the currently effective theme (light or dark)
 */
export function getCurrentEffectiveTheme(): "light" | "dark" {
  const mode = getCurrentTheme();
  return getEffectiveTheme(mode);
}

/**
 * Subscribe to theme changes
 * Returns an unsubscribe function
 */
export function subscribeToThemeChanges(
  callback: (theme: {
    mode: ThemeMode;
    effectiveTheme: "light" | "dark";
  }) => void
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  window.addEventListener("theme-change", handler);

  // Return unsubscribe function
  return () => {
    window.removeEventListener("theme-change", handler);
  };
}

/**
 * Load theme from backend settings
 * Falls back to localStorage if backend is unavailable
 */
export async function loadThemeFromSettings(): Promise<ThemeMode> {
  try {
    // Try to load from backend settings
    if (window.settings?.get) {
      const response = await window.settings.get("themeMode");
      if (response?.success && response.value) {
        const mode = response.value as ThemeMode;
        if (mode === "auto" || mode === "light" || mode === "dark") {
          // Cache in localStorage for fast initial load
          setStoredTheme(mode);
          applyTheme(mode);
          return mode;
        }
      }
    }
  } catch (error) {
    getWindowLogger()?.warn?.("Could not load theme from backend settings", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fall back to localStorage
  const stored = getStoredTheme();
  if (stored) {
    applyTheme(stored);
    return stored;
  }

  // Default to auto
  const defaultMode: ThemeMode = "auto";
  applyTheme(defaultMode);
  return defaultMode;
}

/**
 * Save theme to backend settings
 * Also caches in localStorage for fast initial load
 */
export async function saveThemeToSettings(mode: ThemeMode): Promise<void> {
  // Save to localStorage immediately for fast access
  setStoredTheme(mode);
  applyTheme(mode);

  // Save to backend settings
  try {
    if (window.settings?.set) {
      const response = await window.settings.set("themeMode", mode);
      if (!response?.success) {
        getWindowLogger()?.error?.("Could not save theme to backend settings", {
          error: response?.error,
        });
      }
    }
  } catch (error) {
    getWindowLogger()?.error?.("Could not save theme to backend settings", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
