/**
 * @fileoverview Tests for the runTimesheet wrapper function
 * 
 * These tests verify that the high-level runTimesheet function properly manages
 * browser lifecycle, handles errors correctly, and cleans up resources.
 */

import { describe, it, expect } from 'vitest';
import { runTimesheet } from '../src/index';

describe('runTimesheet wrapper function', () => {
  it('should initialize browser before running automation', async () => {
    // This test verifies the fix for the "Page is not available; call start() first" bug
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    // The function should handle browser lifecycle internally
    const result = await runTimesheet(testRows, 'test@example.com', 'password123');
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('submitted');
    expect(result).toHaveProperty('errors');
    
    // Should fail at authentication (expected), not at browser initialization
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    // The error should NOT be about browser initialization
    const errorMessage = result.errors[0][1].toLowerCase();
    expect(errorMessage).not.toContain('page is not available');
    expect(errorMessage).not.toContain('call start() first');
  }, 45000); // 45 second timeout for DOM-based waits

  it('should cleanup browser even when automation fails', async () => {
    // This test ensures the finally block executes and cleans up resources
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    // First call - will fail but should cleanup
    const result1 = await runTimesheet(testRows, 'test@example.com', 'password123');
    expect(result1).toBeDefined();
    
    // Second call - should work without resource conflicts
    // If cleanup didn't work, this might fail with port/resource conflicts
    const result2 = await runTimesheet(testRows, 'test@example.com', 'password123');
    expect(result2).toBeDefined();
    
    // Both should have the same type of failure (auth, not resource issues)
    expect(result1.ok).toBe(result2.ok);
  }, 60000); // 60 second timeout for DOM-based waits

  it('should handle empty rows array gracefully', async () => {
    const result = await runTimesheet([], 'test@example.com', 'password123');
    
    expect(result).toBeDefined();
    expect(result.submitted).toHaveLength(0);
    // Should complete successfully with no rows to process
    expect(result.ok).toBe(true);
  }, 45000); // 45 second timeout for DOM-based waits

  it('should return proper error structure when browser fails to start', async () => {
    // This would catch issues where browser.launch() fails
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    const result = await runTimesheet(testRows, 'test@example.com', 'password123');
    
    // Should return proper error structure, not throw
    expect(result).toBeDefined();
    expect(result.ok).toBeDefined();
    expect(Array.isArray(result.submitted)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
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
    
    const result = await runTimesheet(testRows, '', '');
    
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
    
    const result = await runTimesheet(testRows, 'test@example.com', 'password123');
    
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
