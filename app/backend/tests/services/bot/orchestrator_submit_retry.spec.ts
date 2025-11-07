import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotOrchestrator } from '../../../src/services/bot/src/bot_orchestation';
import { createFormConfig } from '../../../src/services/bot/src/automation_config';

// Mock the automation config to allow test to override SUBMIT_RETRY_ATTEMPTS
vi.mock('../../../src/services/bot/src/automation_config', async () => {
  const actual = await vi.importActual('../../../src/services/bot/src/automation_config');
  return {
    ...actual,
    SUBMIT_RETRY_ATTEMPTS: 3, // Default value, will be overridden in tests
    createFormConfig: (actual as { createFormConfig: unknown }).createFormConfig
  };
});

import * as Cfg from '../../../src/services/bot/src/automation_config';

// Use Q3 2025 form config to match the test dates (07/15/2025)
const dummyFormConfig = createFormConfig(
  'https://app.smartsheet.com/b/form/0197cbae7daf72bdb96b3395b500d414', 
  '0197cbae7daf72bdb96b3395b500d414'
);

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

function buildBotWithFakes(submitSeq: boolean[], totalAttempts: number = 2) {
  // Configure retry attempts: SUBMIT_RETRY_ATTEMPTS is the total number of attempts (not retries)
  process.env['TIME_KNIGHT_SUBMIT_RETRY_ATTEMPTS'] = String(totalAttempts);
  process.env['TIME_KNIGHT_SUBMIT'] = '1';
  
  // Create a custom config object with the desired retry attempts
  const customCfg = {
    ...Cfg,
    SUBMIT_RETRY_ATTEMPTS: totalAttempts
  };

  const bot = new BotOrchestrator(customCfg as typeof Cfg, dummyFormConfig, true, 'chromium');
  // @ts-ignore override collaborators for isolated testing
  (bot as Record<string, unknown>).webform_filler = new FakeFiller(submitSeq);
  // @ts-ignore override login
  (bot as Record<string, unknown>).login_manager = new FakeLoginManager();
  return bot;
}

describe('BotOrchestrator submit retry behavior (one retry only)', () => {
  const dfRow = {
    Project: 'OSC-BBB',
    Date: '07/15/2025',  // Q3 2025 date to match the dummyFormConfig
    Hours: 1.0,
    'Task Description': 'Test task'
  };

  beforeEach(() => {
    // Reset environment variable and mock to default
    delete process.env['TIME_KNIGHT_SUBMIT_RETRY_ATTEMPTS'];
    // Reset the mock value
    vi.doMock('../../../src/services/bot/src/automation_config', async () => {
      const actual = await vi.importActual('../../../src/services/bot/src/automation_config');
      return {
        ...actual,
        SUBMIT_RETRY_ATTEMPTS: 3,
        createFormConfig: (actual as { createFormConfig: unknown }).createFormConfig
      };
    });
  });

  it('succeeds when first submit fails and second succeeds (one retry)', async () => {
    // Build bot with 2 total attempts: first fails, second succeeds
    const bot = buildBotWithFakes([false, true], 2);
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    expect(ok).toBe(true);
    expect(submitted).toEqual([0]);
    expect(errors.length).toBe(0);
  });

  it('fails when both first and retry submissions fail', async () => {
    // Build bot with 2 total attempts: both fail
    const bot = buildBotWithFakes([false, false], 2);
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    expect(ok).toBe(false);
    expect(submitted.length).toBe(0);
    expect(errors.length).toBe(1);
    expect(errors[0][0]).toBe(0);
    // Expect error message to match the configured 2 attempts
    expect(String(errors[0][1])).toMatch(/after 2 attempts/i);
  });
});


