import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';
import * as themeManager from '@/utils/theme-manager';

// Mock theme-manager
vi.mock('@/utils/theme-manager', () => ({
  initializeTheme: vi.fn(() => 'auto'),
  setThemeMode: vi.fn(),
  getStoredTheme: vi.fn(() => 'auto'),
  getEffectiveTheme: vi.fn((mode: string) => (mode === 'dark' ? 'dark' : 'light')),
}));

describe('useTheme', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let mockMatchMedia: (query: string) => MediaQueryList;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock matchMedia
    originalMatchMedia = window.matchMedia;
    mockMatchMedia = vi.fn((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
    window.matchMedia = mockMatchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('should initialize theme on mount', () => {
    const { result } = renderHook(() => useTheme());

    expect(themeManager.initializeTheme).toHaveBeenCalled();
    expect(result.current.themeMode).toBe('auto');
  });

  it('should return effective theme', () => {
    vi.mocked(themeManager.getEffectiveTheme).mockReturnValue('dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.effectiveTheme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(result.current.isLight).toBe(false);
  });

  it('should return light theme when effective theme is light', () => {
    vi.mocked(themeManager.getEffectiveTheme).mockReturnValue('light');

    const { result } = renderHook(() => useTheme());

    expect(result.current.effectiveTheme).toBe('light');
    expect(result.current.isLight).toBe(true);
    expect(result.current.isDark).toBe(false);
  });

  it('should set theme mode', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setThemeMode('dark');
    });

    expect(themeManager.setThemeMode).toHaveBeenCalledWith('dark');
    expect(result.current.themeMode).toBe('dark');
  });

  it('should toggle theme', () => {
    vi.mocked(themeManager.getEffectiveTheme).mockReturnValue('light');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(themeManager.setThemeMode).toHaveBeenCalledWith('dark');
  });

  it('should toggle from dark to light', () => {
    vi.mocked(themeManager.getEffectiveTheme).mockReturnValue('dark');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(themeManager.setThemeMode).toHaveBeenCalledWith('light');
  });

  it('should listen for system theme changes', () => {
    const addEventListenerSpy = vi.fn();
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    const { unmount } = renderHook(() => useTheme());

    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
  });

  it('should update effective theme when system preference changes', () => {
    let changeHandler: (() => void) | null = null;
    const addEventListenerSpy = vi.fn((event: string, handler: () => void) => {
      if (event === 'change') {
        changeHandler = handler;
      }
    });

    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    vi.mocked(themeManager.getStoredTheme).mockReturnValue('auto');
    vi.mocked(themeManager.getEffectiveTheme).mockReturnValue('light');

    const { result } = renderHook(() => useTheme());

    // Simulate system theme change
    vi.mocked(themeManager.getEffectiveTheme).mockReturnValue('dark');
    act(() => {
      if (changeHandler) {
        changeHandler();
      }
    });

    expect(result.current.effectiveTheme).toBe('dark');
  });
});
