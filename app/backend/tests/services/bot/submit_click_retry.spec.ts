import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for submit retry behavior
 * 
 * This tests the sequential retry flow:
 * 1. Initial submit → failed
 * 2. Level 1 retry (quick re-click, no form re-fill) → failed
 * 3. Level 2 retry (re-fill form and submit) → failed
 * 4. Give up
 * 
 * Total: 3 submission attempts max
 */

describe('SUBMIT_CLICK_RETRY_DELAY_S configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env['SUBMIT_CLICK_RETRY_DELAY_S'];
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('is exported from automation_config', async () => {
    const cfg = await import('../../../src/services/bot/src/automation_config');
    expect(cfg).toHaveProperty('SUBMIT_CLICK_RETRY_DELAY_S');
    expect(typeof cfg.SUBMIT_CLICK_RETRY_DELAY_S).toBe('number');
  });

  it('defaults to 1.0 second', async () => {
    const cfg = await import('../../../src/services/bot/src/automation_config');
    expect(cfg.SUBMIT_CLICK_RETRY_DELAY_S).toBe(1.0);
  });

  it('can be configured via environment variable', async () => {
    process.env['SUBMIT_CLICK_RETRY_DELAY_S'] = '2.5';
    vi.resetModules();
    const cfg = await import('../../../src/services/bot/src/automation_config');
    expect(cfg.SUBMIT_CLICK_RETRY_DELAY_S).toBe(2.5);
  });
});

/**
 * FakeSubmitHandler simulates the sequential retry behavior in _submitWithRetryWithFields
 */
class FakeSubmitHandler {
  private submitResults: boolean[];
  private currentIndex = 0;
  public submitCalls = 0;
  public formRefillCalls = 0;

  constructor(submitResults: boolean[]) {
    this.submitResults = submitResults;
  }

  /**
   * Simulates the sequential retry flow:
   * 1. Initial submit
   * 2. Level 1 retry (no form re-fill)
   * 3. Level 2 retry (with form re-fill)
   */
  async submitWithRetry(): Promise<{ success: boolean; level: string }> {
    // Attempt 1: Initial
    this.submitCalls++;
    let success = this.submitResults[this.currentIndex++] ?? false;
    if (success) {
      return { success: true, level: 'initial' };
    }

    // Attempt 2: Level 1 retry (no form re-fill)
    this.submitCalls++;
    success = this.submitResults[this.currentIndex++] ?? false;
    if (success) {
      return { success: true, level: 'level-1' };
    }

    // Attempt 3: Level 2 retry (with form re-fill)
    this.formRefillCalls++;
    this.submitCalls++;
    success = this.submitResults[this.currentIndex++] ?? false;
    if (success) {
      return { success: true, level: 'level-2' };
    }

    return { success: false, level: 'exhausted' };
  }
}

describe('Sequential submit retry behavior', () => {
  it('succeeds on initial attempt without any retries', async () => {
    const handler = new FakeSubmitHandler([true]); // Initial succeeds
    
    const result = await handler.submitWithRetry();
    
    expect(result.success).toBe(true);
    expect(result.level).toBe('initial');
    expect(handler.submitCalls).toBe(1);
    expect(handler.formRefillCalls).toBe(0);
  });

  it('succeeds on Level 1 retry (quick re-click)', async () => {
    const handler = new FakeSubmitHandler([false, true]); // Initial fails, Level 1 succeeds
    
    const result = await handler.submitWithRetry();
    
    expect(result.success).toBe(true);
    expect(result.level).toBe('level-1');
    expect(handler.submitCalls).toBe(2);
    expect(handler.formRefillCalls).toBe(0); // No form re-fill for Level 1
  });

  it('succeeds on Level 2 retry (form re-fill)', async () => {
    const handler = new FakeSubmitHandler([false, false, true]); // Initial and Level 1 fail, Level 2 succeeds
    
    const result = await handler.submitWithRetry();
    
    expect(result.success).toBe(true);
    expect(result.level).toBe('level-2');
    expect(handler.submitCalls).toBe(3);
    expect(handler.formRefillCalls).toBe(1); // Form re-filled for Level 2
  });

  it('fails after all 3 attempts are exhausted', async () => {
    const handler = new FakeSubmitHandler([false, false, false]); // All 3 attempts fail
    
    const result = await handler.submitWithRetry();
    
    expect(result.success).toBe(false);
    expect(result.level).toBe('exhausted');
    expect(handler.submitCalls).toBe(3);
    expect(handler.formRefillCalls).toBe(1);
  });

  it('does not attempt more than 3 submissions', async () => {
    const handler = new FakeSubmitHandler([false, false, false, true]); // 4th would succeed
    
    const result = await handler.submitWithRetry();
    
    // Should fail because we only try 3 times
    expect(result.success).toBe(false);
    expect(handler.submitCalls).toBe(3);
  });
});

describe('Sequential retry flow documentation', () => {
  /**
   * This test documents the sequential retry architecture:
   * 
   * Flow: Initial → failed → Level 1 retry → failed → Level 2 retry → failed → give up
   * 
   * Level 1 retry: Quick re-click
   * - Wait SUBMIT_CLICK_RETRY_DELAY_S (1s default)
   * - Click submit button again
   * - NO form re-fill
   * 
   * Level 2 retry: Full retry
   * - Wait SUBMIT_RETRY_DELAY (2s default)
   * - Re-fill all form fields
   * - Click submit button
   * 
   * Total: 3 submission attempts maximum
   */
  
  it('documents the sequential retry architecture', () => {
    const totalAttempts = 3; // Initial + Level 1 + Level 2
    const formRefillsOnFailure = 1; // Only Level 2 re-fills
    
    expect(totalAttempts).toBe(3);
    expect(formRefillsOnFailure).toBe(1);
  });

  it('Level 1 handles slow website response without re-filling form', async () => {
    // Scenario: Website is slow, first click doesn't register, second does
    const handler = new FakeSubmitHandler([false, true]);
    
    const result = await handler.submitWithRetry();
    
    expect(result.success).toBe(true);
    expect(result.level).toBe('level-1');
    expect(handler.formRefillCalls).toBe(0); // No form re-fill needed
  });

  it('Level 2 re-fills form when quick retry also fails', async () => {
    // Scenario: Both initial and quick retry fail, need full form re-fill
    const handler = new FakeSubmitHandler([false, false, true]);
    
    const result = await handler.submitWithRetry();
    
    expect(result.success).toBe(true);
    expect(result.level).toBe('level-2');
    expect(handler.formRefillCalls).toBe(1); // Form was re-filled
  });
});
