/**
 * Material Design 3 Theme Manager
 * Handles dynamic theme switching between light and dark modes
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_STORAGE_KEY = 'sheetpilot-theme-mode';

/**
 * Get the current system theme preference
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/**
 * Get the stored theme preference from localStorage
 */
export function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
  } catch (error) {
    console.error('[ThemeManager] Failed to read stored theme:', error);
  }
  
  return null;
}

/**
 * Store theme preference in localStorage
 */
export function setStoredTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.error('[ThemeManager] Failed to store theme:', error);
  }
}

/**
 * Get the effective theme (resolving 'auto' to actual theme)
 */
export function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    return getSystemTheme();
  }
  return mode;
}

/**
 * Apply theme to the document root
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  
  const effectiveTheme = getEffectiveTheme(mode);
  
  // Set data-theme attribute on root element
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  
  // Update color-scheme for native form controls
  document.documentElement.style.colorScheme = effectiveTheme;
  
  // Dispatch custom event for components that need to react to theme changes
  const themeChangeEvent = new CustomEvent('theme-change', {
    detail: { mode, effectiveTheme }
  });
  window.dispatchEvent(themeChangeEvent);
  
  window.logger?.debug('[ThemeManager] Applied theme', { theme: effectiveTheme, mode });
}

/**
 * Initialize theme system
 * Returns the initial theme mode
 */
export function initializeTheme(): ThemeMode {
  const stored = getStoredTheme();
  const mode = stored || 'auto';
  
  applyTheme(mode);
  
  // Listen for system theme changes when in auto mode
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', () => {
      const currentMode = getStoredTheme() || 'auto';
      if (currentMode === 'auto') {
        applyTheme('auto');
      }
    });
  }
  
  return mode;
}

/**
 * Toggle between light and dark themes
 * (Does not support auto mode for toggle)
 */
export function toggleTheme(): ThemeMode {
  const current = getStoredTheme() || 'auto';
  const effectiveCurrent = getEffectiveTheme(current);
  const newMode: ThemeMode = effectiveCurrent === 'light' ? 'dark' : 'light';
  
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
  return getStoredTheme() || 'auto';
}

/**
 * Get the currently effective theme (light or dark)
 */
export function getCurrentEffectiveTheme(): 'light' | 'dark' {
  const mode = getCurrentTheme();
  return getEffectiveTheme(mode);
}

/**
 * Subscribe to theme changes
 * Returns an unsubscribe function
 */
export function subscribeToThemeChanges(
  callback: (theme: { mode: ThemeMode; effectiveTheme: 'light' | 'dark' }) => void
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };
  
  window.addEventListener('theme-change', handler);
  
  // Return unsubscribe function
  return () => {
    window.removeEventListener('theme-change', handler);
  };
}

