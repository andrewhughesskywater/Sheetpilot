/**
 * React hook for Material Design 3 theme management
 */

import { useCallback,useEffect, useState } from 'react';

import {
  getEffectiveTheme,
  getStoredTheme,
  initializeTheme,
  setThemeMode as setThemeModeUtil,
  type ThemeMode,
} from '@/utils/theme-manager';

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    // Initialize theme on first render
    return initializeTheme();
  });

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => {
    return getEffectiveTheme(themeMode);
  });

  // Update effective theme when mode changes or system preference changes
  useEffect(() => {
    const updateEffectiveTheme = () => {
      const currentMode = getStoredTheme() || 'auto';
      setEffectiveTheme(getEffectiveTheme(currentMode));
    };

    updateEffectiveTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateEffectiveTheme);

    return () => {
      mediaQuery.removeEventListener('change', updateEffectiveTheme);
    };
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeUtil(mode);
    setThemeModeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    const newMode: ThemeMode = effectiveTheme === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
  }, [effectiveTheme, setThemeMode]);

  return {
    themeMode,
    effectiveTheme,
    setThemeMode,
    toggleTheme,
    isLight: effectiveTheme === 'light',
    isDark: effectiveTheme === 'dark',
  };
}
