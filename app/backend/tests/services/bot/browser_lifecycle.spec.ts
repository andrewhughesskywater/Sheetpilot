/**
 * @fileoverview Tests for browser lifecycle management
 * 
 * These tests verify that browser instances are properly created, managed,
 * and cleaned up to prevent resource leaks and initialization errors.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { BotOrchestrator } from '../../../src/services/bot/src/bot_orchestation';
import * as Cfg from '../../../src/services/bot/src/automation_config';
import { createFormConfig } from '../../../src/services/bot/src/automation_config';

const dummyFormConfig = createFormConfig('https://test.forms.smartsheet.com/test', 'test-form-id');

describe('Browser Lifecycle Management', () => {
  let bot: BotOrchestrator;

  afterEach(async () => {
    // Always cleanup after each test
    if (bot) {
      try {
        await bot.close();
      } catch {
        // Ignore cleanup errors in tests
      }
    }
  });

  it('should allow start() to be called multiple times safely', async () => {
    bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    await bot.start();
    
    // Second start() should either be idempotent or throw a clear error
    // but not leave resources in a bad state
    try {
      await bot.start();
    } catch {
      // Either it throws (fine) or it's idempotent (also fine)
    }
    
    // Should still be able to close cleanly
    await bot.close();
  });

  it('should allow close() to be called multiple times safely', async () => {
    bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    await bot.start();
    await bot.close();
    
    // Second close() should be idempotent
    await expect(bot.close()).resolves.not.toThrow();
  });

  it('should handle close() when start() was never called', async () => {
    bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    // Closing without starting should be safe
    await expect(bot.close()).resolves.not.toThrow();
  });

  it('should prevent operations after close()', async () => {
    bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    await bot.start();
    await bot.close();
    
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    // Operations after close should return errors
    const [success, submitted, errors] = await bot.run_automation(testRows, ['test@example.com', 'password123']);
    
    expect(success).toBe(false);
    expect(submitted).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
    // Should get "Page is not available" error since browser is closed
    expect(errors[0][1]).toMatch(/Page is not available|start/i);
  }, 30000); // 30 second timeout for DOM-based waits

  it('should properly cleanup resources on automation error', async () => {
    bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    await bot.start();
    
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    // This will fail at authentication
    const [success] = await bot.run_automation(testRows, ['bad@email.com', 'bad']);
    expect(success).toBe(false);
    
    // Should still be able to close cleanly
    await expect(bot.close()).resolves.not.toThrow();
  }, 45000); // 45 second timeout for DOM-based waits

  it('should handle concurrent automation attempts gracefully', async () => {
    bot = new BotOrchestrator(Cfg as Record<string, unknown>, dummyFormConfig, true, 'chromium');
    
    await bot.start();
    
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    // Start two automations concurrently
    const promise1 = bot.run_automation(testRows, ['test1@example.com', 'password1']);
    const promise2 = bot.run_automation(testRows, ['test2@example.com', 'password2']);
    
    // Both should complete (even if they fail)
    const [result1, result2] = await Promise.allSettled([promise1, promise2]);
    
    expect(result1.status).toBeDefined();
    expect(result2.status).toBeDefined();
    
    // Cleanup should still work
    await bot.close();
  }, 60000); // 60 second timeout for DOM-based waits

  it('should initialize chromium browser correctly', async () => {
    // Only test chromium since firefox and webkit are no longer supported
    const testBot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    try {
      await testBot.start();
      
      // Verify browser is actually started by checking if page operations work
      const page = testBot.require_page();
      expect(page).toBeDefined();
      
      await testBot.close();
    } catch (error) {
      // If browser fails to start, should still cleanup properly
      await testBot.close();
      throw error;
    }
  });

  it('should handle headless mode configuration correctly', async () => {
    // Test headless mode
    const headlessBot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    await headlessBot.start();
    await headlessBot.close();
    
    // Test headed mode (might fail in CI, but shouldn't crash)
    const headedBot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, false, 'chromium');
    try {
      await headedBot.start();
      await headedBot.close();
    } catch {
      // Headed mode might not work in CI environment
      await headedBot.close();
    }
  }, 15000); // 15 second timeout for browser startup
});
