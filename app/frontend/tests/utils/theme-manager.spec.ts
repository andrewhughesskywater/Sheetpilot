import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSystemTheme,
  getStoredTheme,
  setStoredTheme,
  getEffectiveTheme,
  applyTheme,
  initializeTheme,
  toggleTheme,
  setThemeMode,
  getCurrentTheme,
  getCurrentEffectiveTheme,
  subscribeToThemeChanges
} from '../../src/utils/theme-manager';

describe('theme-manager', () => {
  let mockWindow: Window & typeof globalThis;
  let mockDocument: Document;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    // Create mock localStorage storage
    mockStorage = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
      clear: vi.fn(() => { mockStorage = {}; }),
      length: 0,
      key: vi.fn(() => null)
    };
    vi.stubGlobal('localStorage', mockLocalStorage);

    // Create mocks
    mockWindow = {
      ...globalThis.window,
      matchMedia: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    } as unknown as Window & typeof globalThis;

    mockDocument = {
      ...globalThis.document,
      documentElement: {
        setAttribute: vi.fn(),
        style: {
          colorScheme: ''
        }
      } as unknown as HTMLElement
    } as unknown as Document;

    // Replace globals
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('document', mockDocument);

    // Mock logger
    (mockWindow as unknown as { logger?: { error: (msg: string, data?: unknown) => void; debug: (msg: string, data?: unknown) => void; warn: (msg: string, data?: unknown) => void } }).logger = {
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getSystemTheme', () => {
    it('should return light when window is undefined', () => {
      delete (globalThis as { window?: typeof window }).window;
      expect(getSystemTheme()).toBe('light');
    });

    it('should return light when matchMedia is not available', () => {
      mockWindow.matchMedia = undefined as unknown as typeof window.matchMedia;
      expect(getSystemTheme()).toBe('light');
    });

    it('should return dark when system prefers dark', () => {
      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: true
      } as MediaQueryList);
      expect(getSystemTheme()).toBe('dark');
    });

    it('should return light when system prefers light', () => {
      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: false
      } as MediaQueryList);
      expect(getSystemTheme()).toBe('light');
    });

    it('should return light when matchMedia throws', () => {
      vi.mocked(mockWindow.matchMedia).mockImplementation(() => {
        throw new Error('matchMedia failed');
      });
      expect(getSystemTheme()).toBe('light');
    });
  });

  describe('getStoredTheme', () => {
    it('should return null when window is undefined', () => {
      delete (globalThis as { window?: typeof window }).window;
      expect(getStoredTheme()).toBeNull();
    });

    it('should return null when localStorage is empty', () => {
      expect(getStoredTheme()).toBeNull();
    });

    it('should return stored theme when valid', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'dark');
      expect(getStoredTheme()).toBe('dark');

      localStorage.setItem('sheetpilot-theme-mode', 'light');
      expect(getStoredTheme()).toBe('light');

      localStorage.setItem('sheetpilot-theme-mode', 'auto');
      expect(getStoredTheme()).toBe('auto');
    });

    it('should return null when stored value is invalid', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'invalid');
      expect(getStoredTheme()).toBeNull();
    });

    it('should return null when localStorage throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage failed');
      });
      expect(getStoredTheme()).toBeNull();
      getItemSpy.mockRestore();
    });
  });

  describe('setStoredTheme', () => {
    it('should store theme in localStorage', () => {
      setStoredTheme('dark');
      expect(localStorage.getItem('sheetpilot-theme-mode')).toBe('dark');

      setStoredTheme('light');
      expect(localStorage.getItem('sheetpilot-theme-mode')).toBe('light');
    });

    it('should not throw when window is undefined', () => {
      delete (globalThis as { window?: typeof window }).window;
      expect(() => setStoredTheme('dark')).not.toThrow();
    });

    it('should log error when localStorage fails', () => {
      // Override the stubbed localStorage's setItem to throw
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('localStorage failed');
      });
      const logger = (mockWindow as unknown as { logger?: { error: (msg: string, data?: unknown) => void } }).logger;

      setStoredTheme('dark');

      expect(logger?.error).toHaveBeenCalledWith(
        'Failed to store theme',
        { error: 'localStorage failed' }
      );
    });
  });

  describe('getEffectiveTheme', () => {
    it('should return theme directly when not auto', () => {
      expect(getEffectiveTheme('light')).toBe('light');
      expect(getEffectiveTheme('dark')).toBe('dark');
    });

    it('should return system theme when auto', () => {
      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: true
      } as MediaQueryList);
      expect(getEffectiveTheme('auto')).toBe('dark');

      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: false
      } as MediaQueryList);
      expect(getEffectiveTheme('auto')).toBe('light');
    });
  });

  describe('applyTheme', () => {
    it('should set data-theme attribute', () => {
      applyTheme('dark');
      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should set color-scheme style', () => {
      applyTheme('light');
      expect(mockDocument.documentElement.style.colorScheme).toBe('light');
    });

    it('should dispatch theme-change event', () => {
      applyTheme('dark');
      expect(mockWindow.dispatchEvent).toHaveBeenCalled();
      const event = vi.mocked(mockWindow.dispatchEvent).mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('theme-change');
      expect(event.detail).toEqual({ mode: 'dark', effectiveTheme: 'dark' });
    });

    it('should not throw when document is undefined', () => {
      delete (globalThis as { document?: typeof document }).document;
      expect(() => applyTheme('dark')).not.toThrow();
    });

    it('should handle auto mode by resolving to system theme', () => {
      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: true
      } as MediaQueryList);
      applyTheme('auto');
      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
  });

  describe('initializeTheme', () => {
    it('should return stored theme when available', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'dark');
      const result = initializeTheme();
      expect(result).toBe('dark');
      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should return auto when no stored theme', () => {
      const result = initializeTheme();
      expect(result).toBe('auto');
    });

    it('should set up system theme change listener when in auto mode', () => {
      const mockMediaQuery = {
        matches: false,
        addEventListener: vi.fn()
      };
      vi.mocked(mockWindow.matchMedia).mockReturnValue(mockMediaQuery as unknown as MediaQueryList);

      initializeTheme();

      expect(mockMediaQuery.addEventListener).toHaveBeenCalled();
    });

    it('should handle media query listener setup failure', () => {
      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: false,
        addEventListener: undefined
      } as unknown as MediaQueryList);

      expect(() => initializeTheme()).not.toThrow();
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'light');
      const result = toggleTheme();
      expect(result).toBe('dark');
      expect(localStorage.getItem('sheetpilot-theme-mode')).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'dark');
      const result = toggleTheme();
      expect(result).toBe('light');
      expect(localStorage.getItem('sheetpilot-theme-mode')).toBe('light');
    });

    it('should toggle from auto (dark system) to light', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'auto');
      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: true
      } as MediaQueryList);
      const result = toggleTheme();
      expect(result).toBe('light');
    });
  });

  describe('setThemeMode', () => {
    it('should set and apply theme', () => {
      setThemeMode('dark');
      expect(localStorage.getItem('sheetpilot-theme-mode')).toBe('dark');
      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
  });

  describe('getCurrentTheme', () => {
    it('should return stored theme', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'dark');
      expect(getCurrentTheme()).toBe('dark');
    });

    it('should return auto when no stored theme', () => {
      expect(getCurrentTheme()).toBe('auto');
    });
  });

  describe('getCurrentEffectiveTheme', () => {
    it('should return effective theme', () => {
      localStorage.setItem('sheetpilot-theme-mode', 'dark');
      expect(getCurrentEffectiveTheme()).toBe('dark');
    });

    it('should resolve auto to system theme', () => {
      vi.mocked(mockWindow.matchMedia).mockReturnValue({
        matches: true
      } as MediaQueryList);
      expect(getCurrentEffectiveTheme()).toBe('dark');
    });
  });

  describe('subscribeToThemeChanges', () => {
    it('should add event listener and return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToThemeChanges(callback);

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('theme-change', expect.any(Function));

      // Trigger event
      const handler = vi.mocked(mockWindow.addEventListener).mock.calls[0][1] as EventListener;
      const event = new CustomEvent('theme-change', { detail: { mode: 'dark', effectiveTheme: 'dark' } });
      handler(event);

      expect(callback).toHaveBeenCalledWith({ mode: 'dark', effectiveTheme: 'dark' });

      // Unsubscribe
      unsubscribe();
      expect(mockWindow.removeEventListener).toHaveBeenCalled();
    });
  });
});


