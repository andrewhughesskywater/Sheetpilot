import { describe, it, expect, beforeEach } from 'vitest';
import * as Cfg from '../../../src/services/bot/src/automation_config';
import { BotOrchestrator } from '../../../src/services/bot/src/bot_orchestation';
import { createFormConfig } from '../../../src/services/bot/src/automation_config';

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

function buildBotWithFakes(submitSeq: boolean[], retryAttempts: number = 1) {
  // Configure retry attempts: total_attempts = 1 initial + retryAttempts retries
  process.env['TIME_KNIGHT_SUBMIT_RETRY_ATTEMPTS'] = String(retryAttempts);
  process.env['TIME_KNIGHT_SUBMIT'] = '1';

  const bot = new BotOrchestrator(Cfg as typeof Cfg, dummyFormConfig, true, 'chromium');
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
    // Ensure deterministic retry limit: 1 retry = 2 total attempts (1 initial + 1 retry)
    process.env['TIME_KNIGHT_SUBMIT_RETRY_ATTEMPTS'] = '1';
  });

  it('succeeds when first submit fails and second succeeds (one retry)', async () => {
    const bot = buildBotWithFakes([false, true]);
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    expect(ok).toBe(true);
    expect(submitted).toEqual([0]);
    expect(errors.length).toBe(0);
  });

  it('fails when both first and retry submissions fail', async () => {
    // Build bot with only 1 retry attempt = 2 total attempts
    const bot = buildBotWithFakes([false, false], 1);
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    expect(ok).toBe(false);
    expect(submitted.length).toBe(0);
    expect(errors.length).toBe(1);
    expect(errors[0][0]).toBe(0);
    // Note: maxRetries defaults to 3 from Cfg.SUBMIT_RETRY_ATTEMPTS, so we expect 3 attempts
    expect(String(errors[0][1])).toMatch(/after 3 attempts/i);
  });
});


