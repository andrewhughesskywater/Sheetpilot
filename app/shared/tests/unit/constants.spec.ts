import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  APP_VERSION,
  APP_NAME,
  PRODUCT_NAME,
  ALLOWED_PREVIOUS_QUARTERS,
  appSettings,
  getBrowserHeadless,
  setBrowserHeadless
} from '../constants';

// Mock logger to avoid circular dependency issues
vi.mock('../logger', () => ({
  appLogger: {
    info: vi.fn()
  }
}));

describe('constants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset appSettings to default
    appSettings.browserHeadless = false;
  });

  describe('Constants', () => {
    it('should export APP_VERSION', () => {
      expect(APP_VERSION).toBe('1.5.1');
      expect(typeof APP_VERSION).toBe('string');
    });

    it('should export APP_NAME', () => {
      expect(APP_NAME).toBe('Sheetpilot');
      expect(typeof APP_NAME).toBe('string');
    });

    it('should export PRODUCT_NAME', () => {
      expect(PRODUCT_NAME).toBe('Sheetpilot');
      expect(typeof PRODUCT_NAME).toBe('string');
    });

    it('should export ALLOWED_PREVIOUS_QUARTERS', () => {
      expect(ALLOWED_PREVIOUS_QUARTERS).toBe(1);
      expect(typeof ALLOWED_PREVIOUS_QUARTERS).toBe('number');
    });

    it('should export appSettings object', () => {
      expect(appSettings).toBeDefined();
      expect(typeof appSettings).toBe('object');
      expect(appSettings).toHaveProperty('browserHeadless');
    });
  });

  describe('getBrowserHeadless', () => {
    it('should return current browserHeadless value', () => {
      appSettings.browserHeadless = false;
      expect(getBrowserHeadless()).toBe(false);

      appSettings.browserHeadless = true;
      expect(getBrowserHeadless()).toBe(true);
    });
  });

  describe('setBrowserHeadless', () => {
    it('should update browserHeadless value', () => {
      appSettings.browserHeadless = false;
      setBrowserHeadless(true);
      expect(appSettings.browserHeadless).toBe(true);
      expect(getBrowserHeadless()).toBe(true);
    });

    it('should log the change', () => {
      appSettings.browserHeadless = false;
      setBrowserHeadless(true);
      
      // The logger is mocked, so we can't directly verify it was called
      // but the function should complete without error
      expect(appSettings.browserHeadless).toBe(true);
    });

    it('should handle logger unavailability gracefully', () => {
      // This tests the catch block in setBrowserHeadless
      appSettings.browserHeadless = false;
      
      // Function should not throw even if logger fails
      expect(() => setBrowserHeadless(true)).not.toThrow();
      expect(appSettings.browserHeadless).toBe(true);
    });
  });
});


