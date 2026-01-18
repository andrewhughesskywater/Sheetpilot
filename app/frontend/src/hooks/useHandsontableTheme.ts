/**
 * Hook for managing Handsontable theme based on app theme mode
 * 
 * Returns the appropriate Handsontable Horizon theme variant:
 * - 'ht-theme-horizon' for light mode
 * - 'ht-theme-horizon-dark' for dark mode
 */

import { useState, useEffect } from 'react';
import { getCurrentEffectiveTheme, subscribeToThemeChanges } from '@/utils/theme-manager';

/**
 * Get the appropriate Handsontable theme name based on effective theme
 */
export function useHandsontableTheme(): string {
  const [themeName, setThemeName] = useState(() => {
    const effectiveTheme = getCurrentEffectiveTheme();
    return effectiveTheme === 'dark' ? 'ht-theme-horizon-dark' : 'ht-theme-horizon';
  });

  useEffect(() => {
    // Subscribe to theme changes
    const unsubscribe = subscribeToThemeChanges(({ effectiveTheme }) => {
      const newTheme = effectiveTheme === 'dark' ? 'ht-theme-horizon-dark' : 'ht-theme-horizon';
      setThemeName(newTheme);
    });

    return unsubscribe;
  }, []);

  return themeName;
}
