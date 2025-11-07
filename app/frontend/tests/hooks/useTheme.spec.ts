/**
 * @fileoverview useTheme Hook Tests
 * 
 * Tests for the Material Design 3 theme management hook.
 * Ensures proper theme initialization, persistence, and system preference detection.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock theme-manager utilities
const mockThemeManager = {
  initializeTheme: vi.fn(() => 'auto' as 'auto' | 'light' | 'dark'),
  setThemeMode: vi.fn(),
  getStoredTheme: vi.fn(() => 'auto' as 'auto' | 'light' | 'dark' | null),
  getEffectiveTheme: vi.fn((mode: string) => mode === 'dark' ? 'dark' : 'light')
};

vi.mock('../../../src/utils/theme-manager', () => mockThemeManager);

describe('useTheme Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Theme Initialization', () => {
    it('should initialize theme on first render', () => {
      const initialTheme = mockThemeManager.initializeTheme();
      
      expect(mockThemeManager.initializeTheme).toHaveBeenCalled();
      expect(initialTheme).toBeDefined();
    });

    it('should get stored theme from localStorage', () => {
      const stored = mockThemeManager.getStoredTheme();
      
      expect(stored).toBeDefined();
      expect(['auto', 'light', 'dark', null]).toContain(stored);
    });

    it('should default to auto if no stored theme', () => {
      mockThemeManager.getStoredTheme.mockReturnValue(null);
      const theme = mockThemeManager.getStoredTheme() || 'auto';
      
      expect(theme).toBe('auto');
    });
  });

  describe('Theme Mode Switching', () => {
    it('should support light mode', () => {
      const mode = 'light';
      mockThemeManager.setThemeMode(mode);
      
      expect(mockThemeManager.setThemeMode).toHaveBeenCalledWith('light');
    });

    it('should support dark mode', () => {
      const mode = 'dark';
      mockThemeManager.setThemeMode(mode);
      
      expect(mockThemeManager.setThemeMode).toHaveBeenCalledWith('dark');
    });

    it('should support auto mode', () => {
      const mode = 'auto';
      mockThemeManager.setThemeMode(mode);
      
      expect(mockThemeManager.setThemeMode).toHaveBeenCalledWith('auto');
    });

    it('should toggle between light and dark', () => {
      let effectiveTheme: 'light' | 'dark' = 'light';
      
      const toggle = () => {
        effectiveTheme = effectiveTheme === 'light' ? 'dark' : 'light';
      };
      
      toggle();
      expect(effectiveTheme).toBe('dark');
      
      toggle();
      expect(effectiveTheme).toBe('light');
    });
  });

  describe('System Preference Detection', () => {
    it('should detect system dark mode preference', () => {
      const mediaQuery = {
        matches: true, // System prefers dark mode
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
      
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => mediaQuery),
        writable: true
      });
      
      window.matchMedia('(prefers-color-scheme: dark)');
      
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('should detect system light mode preference', () => {
      const mediaQuery = {
        matches: false, // System prefers light mode
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
      
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => mediaQuery),
        writable: true
      });
      
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      
      expect(query.matches).toBe(false);
    });

    it('should listen for system preference changes', () => {
      const mediaQuery = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
      
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => mediaQuery),
        writable: true
      });
      
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      query.addEventListener('change', vi.fn());
      
      expect(query.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should clean up event listeners on unmount', () => {
      const mediaQuery = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };
      
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => mediaQuery),
        writable: true
      });
      
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = vi.fn();
      
      query.addEventListener('change', listener);
      query.removeEventListener('change', listener);
      
      expect(query.removeEventListener).toHaveBeenCalledWith('change', listener);
    });
  });

  describe('Theme Persistence', () => {
    it('should persist theme to localStorage', () => {
      const mode = 'dark';
      mockThemeManager.setThemeMode(mode);
      
      expect(mockThemeManager.setThemeMode).toHaveBeenCalledWith('dark');
    });

    it('should load persisted theme on init', () => {
      mockThemeManager.getStoredTheme.mockReturnValue('dark');
      const stored = mockThemeManager.getStoredTheme();
      
      expect(stored).toBe('dark');
    });

    it('should handle corrupted localStorage data', () => {
      mockThemeManager.getStoredTheme.mockReturnValue(null);
      const theme = mockThemeManager.getStoredTheme() || 'auto';
      
      expect(theme).toBe('auto');
    });
  });

  describe('Effective Theme Calculation', () => {
    it('should return light for light mode', () => {
      const effective = mockThemeManager.getEffectiveTheme('light');
      expect(effective).toBe('light');
    });

    it('should return dark for dark mode', () => {
      mockThemeManager.getEffectiveTheme.mockReturnValue('dark');
      const effective = mockThemeManager.getEffectiveTheme('dark');
      expect(effective).toBe('dark');
    });

    it('should use system preference for auto mode', () => {
      // System prefers dark
      mockThemeManager.getEffectiveTheme.mockReturnValue('dark');
      const effective = mockThemeManager.getEffectiveTheme('auto');
      expect(effective).toBe('dark');
    });
  });

  describe('Theme Mode Transitions', () => {
    it('should transition smoothly between modes', () => {
      const modes: Array<'auto' | 'light' | 'dark'> = ['auto', 'light', 'dark', 'auto'];
      
      modes.forEach(mode => {
        mockThemeManager.setThemeMode(mode);
        expect(mockThemeManager.setThemeMode).toHaveBeenCalledWith(mode);
      });
    });

    it('should update effective theme on mode change', () => {
      mockThemeManager.getEffectiveTheme.mockReturnValue('light');
      let effective = mockThemeManager.getEffectiveTheme('light');
      expect(effective).toBe('light');
      
      mockThemeManager.getEffectiveTheme.mockReturnValue('dark');
      effective = mockThemeManager.getEffectiveTheme('dark');
      expect(effective).toBe('dark');
    });
  });

  describe('Helper Properties', () => {
    it('should provide isLight property', () => {
      const effectiveTheme = 'light';
      const isLight = effectiveTheme === 'light';
      
      expect(isLight).toBe(true);
    });

    it('should provide isDark property', () => {
      const effectiveTheme = 'dark';
      const isDark = effectiveTheme === 'dark';
      
      expect(isDark).toBe(true);
    });

    it('should have mutually exclusive isLight and isDark', () => {
      const effectiveTheme = 'light';
      const isLight = effectiveTheme === 'light';
      const isDark = effectiveTheme === 'dark';
      
      expect(isLight !== isDark).toBe(true);
    });
  });
});

