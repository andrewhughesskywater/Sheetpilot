import { describe, it, expect } from 'vitest';
import * as Cfg from '../../../src/services/bot/src/automation_config';
import { BotOrchestrator } from '../../../src/services/bot/src/bot_orchestation';
import { createFormConfig } from '../../../src/services/bot/src/automation_config';

const dummyFormConfig = createFormConfig('https://test.forms.smartsheet.com/test', 'test-form-id');

describe('BotOrchestrator small logic', () => {
  it('validate required fields logic', async () => {
    const bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    // @ts-ignore access private for test via any
    const ok1 = (bot as Record<string, unknown>)._validate_required_fields({ hours: 1, project_code: 'P', date: '01/01/2025' }, 0);
    expect(ok1).toBe(true);
    // missing project_code
    const ok2 = (bot as Record<string, unknown>)._validate_required_fields({ hours: 1, date: '01/01/2025' }, 0);
    expect(ok2).toBe(false);
  });

  it('project-specific tool locator resolution', async () => {
    const bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    // @ts-ignore private
    const selKnown = (bot as Record<string, unknown>).get_project_specific_tool_locator('OSC-BBB');
    expect(typeof selKnown === 'string' || selKnown === null).toBe(true);
  });

  it('should return error when run_automation is called without start()', async () => {
    const bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    // Attempt to run automation without calling start() first
    const testRows = [
      { 
        Project: 'TestProject', 
        Date: '01/15/2025', 
        Hours: 1, 
        'Task Description': 'Test task' 
      }
    ];
    
    // This should fail because browser is not started
    const [success, submitted, errors] = await bot.run_automation(testRows, ['test@example.com', 'password123']);
    
    expect(success).toBe(false);
    expect(submitted).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0][1]).toMatch(/Page is not available|start/i);
  }, 30000); // 30 second timeout for DOM-based waits

  it('should work when start() is called before run_automation()', async () => {
    const bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
    
    try {
      // Start the browser first
      await bot.start();
      
      // This should not throw "Page is not available" error
      // It will fail later during authentication (expected), but proves browser was started
      const testRows = [
        { 
          Project: 'TestProject', 
          Date: '01/15/2025', 
          Hours: 1, 
          'Task Description': 'Test task' 
        }
      ];
      
      const [success, _submitted, errors] = await bot.run_automation(
        testRows, 
        ['test@example.com', 'password123']
      );
      
      // Should fail authentication, but not with "Page is not available"
      expect(success).toBe(false);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0][1]).not.toContain('Page is not available');
      expect(errors[0][1]).not.toContain('call start() first');
    } finally {
      // Always clean up
      await bot.close();
    }
  }, 45000); // 45 second timeout for DOM-based waits
});


