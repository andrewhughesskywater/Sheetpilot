import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotOrchestrator } from '../../../src/services/bot/src/bot_orchestation';
import { createFormConfig } from '../../../src/services/bot/src/automation_config';

// Mock the automation config with all required exports
vi.mock('../../../src/services/bot/src/automation_config', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/bot/src/automation_config')>('../../../src/services/bot/src/automation_config');
  return {
    // Spread all actual exports first
    ...actual,
    // Add properties accessed by BotOrchestrator that don't exist in the real config
    STATUS_COLUMN_NAME: undefined,
    STATUS_COMPLETE: undefined,
    // Override timing constants for fast tests
    SUBMIT_CLICK_RETRY_DELAY_S: 0.01,
    SUBMIT_RETRY_DELAY: 0.01,
    SUBMIT_DELAY_AFTER_FILLING: 0.01,
    SUBMIT_FORM_AFTER_FILLING: true,
    DYNAMIC_WAIT_BASE_TIMEOUT: 0.01,
    DYNAMIC_WAIT_MAX_TIMEOUT: 0.01,
    GLOBAL_TIMEOUT: 0.1,
    // Mock page-dependent functions to be no-ops for testing
    wait_for_dom_stability: vi.fn().mockResolvedValue(true),
    dynamic_wait_for_element: vi.fn().mockResolvedValue(true),
    dynamic_wait_for_page_load: vi.fn().mockResolvedValue(true),
    dynamic_wait_for_network_idle: vi.fn().mockResolvedValue(true),
    dynamic_wait: vi.fn().mockResolvedValue(true),
    wait_for_dropdown_options: vi.fn().mockResolvedValue(true),
    wait_for_validation_stability: vi.fn().mockResolvedValue(true),
    smart_wait_or_proceed: vi.fn().mockResolvedValue(true),
    wait_for_submission_network_idle: vi.fn().mockResolvedValue(true),
    sleep: vi.fn().mockResolvedValue(undefined)
  };
});

import * as Cfg from '../../../src/services/bot/src/automation_config';

// Use Q3 2025 form config to match the test dates (07/15/2025)
const dummyFormConfig = createFormConfig(
  'https://app.smartsheet.com/b/form/0197cbae7daf72bdb96b3395b500d414', 
  '0197cbae7daf72bdb96b3395b500d414'
);

/**
 * Mock page object for testing
 * Provides minimal Playwright Page interface required by the bot
 */
const createMockPage = () => {
  const submitButtonLocator = {
    first: vi.fn().mockReturnValue({
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true)
    })
  };
  
  return {
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockImplementation((selector: string) => {
      // Return submit button locator for submit button selector
      // Check for the actual locator pattern: button[data-client-id='form_submit_btn']
      if (selector && (selector.includes('form_submit_btn') || selector.includes('submit') || selector.includes('Submit'))) {
        return submitButtonLocator;
      }
      return {
        count: vi.fn().mockResolvedValue(0),
        first: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          isEnabled: vi.fn().mockResolvedValue(true)
        }),
        nth: vi.fn().mockReturnValue({
          isVisible: vi.fn().mockResolvedValue(false),
          isEnabled: vi.fn().mockResolvedValue(true)
        }),
        fill: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        press: vi.fn().mockResolvedValue(undefined),
        getAttribute: vi.fn().mockResolvedValue(null),
        evaluate: vi.fn().mockResolvedValue(null),
        isVisible: vi.fn().mockResolvedValue(true),
        isEnabled: vi.fn().mockResolvedValue(true),
        boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),
        waitFor: vi.fn().mockResolvedValue(undefined)
      };
    }),
    evaluate: vi.fn().mockResolvedValue('complete'),
    goto: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn()
  };
};

/**
 * FakeFiller simulates WebformFiller behavior for testing
 * 
 * The sequential retry flow is:
 * 1. Initial submit
 * 2. Level 1 retry (no form re-fill)
 * 3. Level 2 retry (with form re-fill)
 * 
 * Total: 3 submit_form() calls max
 */
class FakeFiller {
  submitSequence: boolean[];
  submissions: number = 0;
  mockPage = createMockPage();
  
  constructor(seq: boolean[]) { this.submitSequence = seq; }
  async wait_for_form_ready(): Promise<void> { /* no-op */ }
  async inject_field_value(_spec: Record<string, unknown>, _v: string): Promise<void> { /* no-op */ }
  require_page() { 
    return this.mockPage;
  }
  getPage(_contextIndex: number) {
    return this.mockPage;
  }
  /**
   * Mock submit_form returns the next result in the sequence
   * Each call represents one submission attempt
   */
  async submit_form(): Promise<boolean> {
    const idx = Math.min(this.submissions, this.submitSequence.length - 1);
    const val = this.submitSequence[idx];
    this.submissions += 1;
    return val;
  }
  async start(): Promise<void> { /* no-op */ }
  async close(): Promise<void> { /* no-op */ }
  async navigate_to_base(): Promise<void> { /* no-op */ }
}

class FakeLoginManager { async run_login_steps(): Promise<void> { /* no-op */ } }

async function buildBotWithFakes(submitSeq: boolean[]) {
  process.env['SUBMIT'] = '1';

  const bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
  // @ts-ignore override collaborators for isolated testing
  (bot as Record<string, unknown>).webform_filler = new FakeFiller(submitSeq);
  // @ts-ignore override login
  (bot as Record<string, unknown>).login_manager = new FakeLoginManager();
  
  // Start the bot before running automation
  await bot.start();
  
  return bot;
}

describe('BotOrchestrator sequential submit retry behavior', () => {
  const dfRow = {
    Project: 'OSC-BBB',
    Date: '07/15/2025',  // Q3 2025 date to match the dummyFormConfig
    Hours: 1.0,
    'Task Description': 'Test task'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on initial submission', async () => {
    const bot = await buildBotWithFakes([true]); // Initial succeeds
    try {
      const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
      
      expect(ok).toBe(true);
      expect(submitted).toEqual([0]);
      expect(errors.length).toBe(0);
    } finally {
      await bot.close();
    }
  });

  it('succeeds on Level 1 retry (quick re-click)', async () => {
    const bot = await buildBotWithFakes([false, true]); // Initial fails, Level 1 succeeds
    try {
      const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
      
      expect(ok).toBe(true);
      expect(submitted).toEqual([0]);
      expect(errors.length).toBe(0);
    } finally {
      await bot.close();
    }
  });

  it('succeeds on Level 2 retry (form re-fill)', async () => {
    const bot = await buildBotWithFakes([false, false, true]); // Initial and Level 1 fail, Level 2 succeeds
    try {
      const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
      
      expect(ok).toBe(true);
      expect(submitted).toEqual([0]);
      expect(errors.length).toBe(0);
    } finally {
      await bot.close();
    }
  });

  it('fails when all 3 attempts fail', async () => {
    const bot = await buildBotWithFakes([false, false, false]); // All 3 attempts fail
    try {
      const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
      
      expect(ok).toBe(false);
      expect(submitted.length).toBe(0);
      expect(errors.length).toBe(1);
      expect(errors[0][0]).toBe(0); // Row index
      expect(String(errors[0][1])).toMatch(/after 3 attempts/i);
    } finally {
      await bot.close();
    }
  });
});
