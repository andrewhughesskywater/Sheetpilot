import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotOrchestrator } from '../../../src/services/bot/src/bot_orchestation';
import { createFormConfig } from '../../../src/services/bot/src/automation_config';

// Mock the automation config
vi.mock('../../../src/services/bot/src/automation_config', async () => {
  const actual = await vi.importActual('../../../src/services/bot/src/automation_config');
  return {
    ...actual,
    SUBMIT_CLICK_RETRY_DELAY_S: 0.01, // Fast for tests
    SUBMIT_RETRY_DELAY: 0.01, // Fast for tests
    createFormConfig: (actual as { createFormConfig: unknown }).createFormConfig
  };
});

import * as Cfg from '../../../src/services/bot/src/automation_config';

// Use Q3 2025 form config to match the test dates (07/15/2025)
const dummyFormConfig = createFormConfig(
  'https://app.smartsheet.com/b/form/0197cbae7daf72bdb96b3395b500d414', 
  '0197cbae7daf72bdb96b3395b500d414'
);

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
  constructor(seq: boolean[]) { this.submitSequence = seq; }
  async wait_for_form_ready(): Promise<void> { /* no-op */ }
  async inject_field_value(_spec: Record<string, unknown>, _v: string): Promise<void> { /* no-op */ }
  require_page(): { waitForTimeout: (ms: number) => Promise<void> } { 
    return {
      waitForTimeout: async (_ms: number) => { /* no-op */ }
    }; 
  }
  getPage(_contextIndex: number): { waitForTimeout: (ms: number) => Promise<void> } {
    return {
      waitForTimeout: async (_ms: number) => { /* no-op */ }
    };
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

function buildBotWithFakes(submitSeq: boolean[]) {
  process.env['SUBMIT'] = '1';

  const bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
  // @ts-ignore override collaborators for isolated testing
  (bot as Record<string, unknown>).webform_filler = new FakeFiller(submitSeq);
  // @ts-ignore override login
  (bot as Record<string, unknown>).login_manager = new FakeLoginManager();
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
    const bot = buildBotWithFakes([true]); // Initial succeeds
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    
    expect(ok).toBe(true);
    expect(submitted).toEqual([0]);
    expect(errors.length).toBe(0);
  });

  it('succeeds on Level 1 retry (quick re-click)', async () => {
    const bot = buildBotWithFakes([false, true]); // Initial fails, Level 1 succeeds
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    
    expect(ok).toBe(true);
    expect(submitted).toEqual([0]);
    expect(errors.length).toBe(0);
  });

  it('succeeds on Level 2 retry (form re-fill)', async () => {
    const bot = buildBotWithFakes([false, false, true]); // Initial and Level 1 fail, Level 2 succeeds
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    
    expect(ok).toBe(true);
    expect(submitted).toEqual([0]);
    expect(errors.length).toBe(0);
  });

  it('fails when all 3 attempts fail', async () => {
    const bot = buildBotWithFakes([false, false, false]); // All 3 attempts fail
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    
    expect(ok).toBe(false);
    expect(submitted.length).toBe(0);
    expect(errors.length).toBe(1);
    expect(errors[0][0]).toBe(0); // Row index
    expect(String(errors[0][1])).toMatch(/after 3 attempts/i);
  });
});
