/**
 * @fileoverview Tests for the runTimesheet wrapper function
 * 
 * These tests verify that the high-level runTimesheet function properly manages
 * browser lifecycle, handles errors correctly, and cleans up resources.
 * 
 * NOTE: These tests use mocked authentication to avoid hitting real production URLs.
 */

import { describe, it, expect, vi } from 'vitest';
import { runTimesheet } from '../../../src/services/bot/src/index';
import { createFormConfig } from '../../../src/services/bot/src/automation_config';

// Mock LoginManager to fail authentication immediately to prevent timeouts
vi.mock('../../../src/services/bot/src/authentication_flow', () => {
  return {
    LoginManager: class {
      async run_login_steps() { throw new Error('Authentication failed (mock)'); }
      async validate_login_state() { return false; }
    }
  };
});

describe('runTimesheet wrapper function', () => {
  const testFormConfig = createFormConfig(
    'https://app.smartsheet.com/b/form/q1-2025-placeholder',
    'q1-2025-placeholder'
  );

  it('should handle empty rows array gracefully', async () => {
    const result = await runTimesheet([], 'test@example.com', 'password123', testFormConfig, undefined, true);
    
    expect(result).toBeDefined();
    expect(result.submitted).toHaveLength(0);
    // Should complete successfully with no rows to process
    expect(result.ok).toBe(true);
  }, 45000); // 45 second timeout for DOM-based waits

  it('should return proper error structure when authentication fails', async () => {
    // This test verifies that the function returns proper error structure
    // when authentication fails (which is expected with test credentials)
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    const result = await runTimesheet(testRows, 'test@example.com', 'password123', testFormConfig, undefined, true);
    
    // Should return proper error structure, not throw
    expect(result).toBeDefined();
    expect(result.ok).toBeDefined();
    expect(Array.isArray(result.submitted)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    
    // Should fail at authentication (expected with test credentials)
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  }, 45000); // 45 second timeout for DOM-based waits

  it('should handle invalid credentials gracefully', async () => {
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    const result = await runTimesheet(testRows, '', '', testFormConfig, undefined, true);
    
    expect(result).toBeDefined();
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  }, 45000); // 45 second timeout for DOM-based waits

  it('should process multiple rows and report individual failures', async () => {
    const testRows = [
      { 
        Project: 'TestProject1', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Task 1' 
      },
      { 
        Project: 'TestProject2', 
        Date: '01/16/2025', 
        Hours: 2, 
        'Task Description': 'Task 2' 
      }
    ];
    
    const result = await runTimesheet(testRows, 'test@example.com', 'password123', testFormConfig, undefined, true);
    
    expect(result).toBeDefined();
    expect(result.errors).toBeDefined();
    // Errors should be an array of tuples [index, message]
    result.errors.forEach(error => {
      expect(Array.isArray(error)).toBe(true);
      expect(error).toHaveLength(2);
      expect(typeof error[0]).toBe('number');
      expect(typeof error[1]).toBe('string');
    });
  }, 45000); // 45 second timeout for DOM-based waits
});
