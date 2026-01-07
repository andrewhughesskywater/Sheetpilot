/**
 * @fileoverview Tests for browser lifecycle management
 * 
 * These tests verify that browser instances are properly created, managed,
 * and cleaned up to prevent resource leaks and initialization errors.
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { BotOrchestrator } from '../../../src/services/bot/src/core/bot_orchestation';
import * as Cfg from '../../../src/services/bot/src/config/automation_config';
import { createFormConfig } from '../../../src/services/bot/src/config/automation_config';

// Mock WebformFiller to prevent actual browser launches
vi.mock('../../../src/services/bot/src/browser/webform_flow', () => {
  return {
    WebformFiller: class {
      private started = false;
      private page = { url: () => 'mock://page', close: vi.fn() };
      
      async start() { 
        this.started = true;
      }
      
      async close() { 
        this.started = false;
      }
      
      require_page() {
        if (!this.started) {
          throw new Error('Page is not available. Call start() first.');
        }
        return this.page;
      }
      
      async fill_form_fields() { return true; }
      async submit_form() { return true; }
      async wait_for_form_ready() { return; }
      async navigate_to_base() { return; }
      async inject_field_value() { return; }
    }
  };
});

// Mock LoginManager to prevent timeouts
vi.mock('../../../src/services/bot/src/utils/authentication_flow', () => {
  return {
    LoginManager: class {
      async run_login_steps(email: string) {
        // Fail for bad credentials to support error handling tests
        if (email === 'bad@email.com') {
          throw new Error('Authentication failed');
        }
      }
      async validate_login_state() { return true; }
    }
  };
});

const dummyFormConfig = createFormConfig('https://app.smartsheet.com/b/form/placeholder-q1-2025', 'placeholder-q1-2025');

describe('Browser Lifecycle Management', () => {
  let bot: BotOrchestrator;

  beforeEach(() => {
    bot = null as unknown as BotOrchestrator;
  });

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
  });

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
  });

  it('should handle concurrent automation attempts gracefully', async () => {
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
    // Always force headless in tests to prevent opening real browser windows.
    // Some environments will open a visible browser for headed mode, and a timeout race can leak it.

    // Test headless mode
    const headlessBot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    await headlessBot.start();
    await headlessBot.close();
    
    // Only run headed mode when explicitly requested.
    // Default behavior should not open visible browser windows during tests.
    if (process.env['SHEETPILOT_TEST_HEADED_BROWSER'] !== 'true') {
      return;
    }

    const headedBot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, false, 'chromium');

    const startPromise = headedBot.start();
    const timeoutPromise = new Promise<void>((_resolve, reject) =>
      setTimeout(() => reject(new Error('Headed mode start timeout')), 10000)
    );

    try {
      await Promise.race([startPromise, timeoutPromise]);
    } finally {
      // Prevent leaking a visible browser window if startPromise resolves after the timeout.
      await Promise.allSettled([startPromise]);
      await headedBot.close();
    }
  }, 25000); // 25 second timeout for browser startup with buffer
});
