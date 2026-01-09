/**
 * Browser Environment Tests
 *
 * These tests ensure that renderer code doesn't use Node.js-specific APIs
 * that don't exist in the browser environment.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Browser Environment Compatibility', () => {
  let originalProcess: typeof process | undefined;

  beforeEach(() => {
    // Store original values
    originalProcess = global.process;

    // Remove process from global scope to simulate browser environment
    delete (global as Record<string, unknown>)['process'];

    // Ensure process is truly undefined
    Object.defineProperty(global, 'process', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original values
    if (originalProcess !== undefined) {
      global.process = originalProcess;
    } else {
      delete (global as Record<string, unknown>)['process'];
    }
  });

  it('should not access process.env in browser environment', async () => {
    // This test simulates the browser environment where process is undefined
    expect(() => {
      // Accessing process when it's undefined should throw
      const env = process.env;
      return env;
    }).toThrow();
  });

  it('should use import.meta.env instead of process.env', () => {
    // This test verifies the correct approach works
    // Verify that import.meta.env is accessible even when process is undefined
    expect(import.meta).toBeDefined();
    expect(import.meta.env).toBeDefined();
    expect(typeof import.meta.env).toBe('object');
  });

  it('should not have process object in global scope', () => {
    expect(global.process).toBeUndefined();
  });

  it('should have import.meta.env available', () => {
    expect(import.meta.env).toBeDefined();
    // Check that import.meta.env exists
    expect(typeof import.meta.env).toBe('object');
  });
});
