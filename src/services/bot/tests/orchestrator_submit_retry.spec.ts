import { describe, it, expect, beforeEach } from 'vitest';
import * as Cfg from '../src/automation_config';
import { BotOrchestrator } from '../src/bot_orchestation';

class FakeFiller {
  submitSequence: boolean[];
  submissions: number = 0;
  constructor(seq: boolean[]) { this.submitSequence = seq; }
  async wait_for_form_ready(): Promise<void> { /* no-op */ }
  async inject_field_value(_spec: Record<string, any>, _v: string): Promise<void> { /* no-op */ }
  require_page(): any { 
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

function buildBotWithFakes(submitSeq: boolean[]) {
  // Configure one retry (2 attempts total) using environment variables
  process.env['TIME_KNIGHT_SUBMIT_RETRY_ATTEMPTS'] = '2';
  process.env['TIME_KNIGHT_SUBMIT'] = '1';

  const bot = new BotOrchestrator(Cfg as any, true, 'chromium');
  // @ts-ignore override collaborators for isolated testing
  (bot as any).webform_filler = new FakeFiller(submitSeq);
  // @ts-ignore override login
  (bot as any).login_manager = new FakeLoginManager();
  return bot;
}

describe('BotOrchestrator submit retry behavior (one retry only)', () => {
  const dfRow = {
    Project: 'OSC-BBB',
    Date: '01/15/2025',
    Hours: 1.0,
    'Task Description': 'Test task'
  };

  beforeEach(() => {
    // Ensure deterministic retry limit using environment variable
    process.env['TIME_KNIGHT_SUBMIT_RETRY_ATTEMPTS'] = '2';
  });

  it('succeeds when first submit fails and second succeeds (one retry)', async () => {
    const bot = buildBotWithFakes([false, true]);
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    expect(ok).toBe(true);
    expect(submitted).toEqual([0]);
    expect(errors.length).toBe(0);
  });

  it('fails when both first and retry submissions fail', async () => {
    const bot = buildBotWithFakes([false, false]);
    const [ok, submitted, errors] = await bot.run_automation([dfRow], ['user@test', 'pw']);
    expect(ok).toBe(false);
    expect(submitted.length).toBe(0);
    expect(errors.length).toBe(1);
    expect(errors[0][0]).toBe(0);
    expect(String(errors[0][1])).toMatch(/after 3 attempts/i);
  });
});


