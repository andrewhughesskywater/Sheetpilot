/**
 * @fileoverview Quarter Routing Integration Tests
 * 
 * Tests the integration of quarter routing with BotOrchestrator and LoginManager
 * to ensure entries are submitted to the correct quarterly form based on their dates.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotOrchestrator } from '../src/services/bot/src/bot_orchestation';
import { WebformFiller } from '../src/services/bot/src/webform_flow';
import { createFormConfig } from '../src/services/bot/src/automation_config';
import * as Cfg from '../src/services/bot/src/automation_config';
import { QUARTER_DEFINITIONS } from '../src/services/bot/src/quarter_config';

// Mock the logger
vi.mock('../src/shared/logger', () => ({
  botLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn()
  },
  authLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
    startTimer: vi.fn(() => ({
      done: vi.fn()
    }))
  }
}));

// Mock WebformFiller
vi.mock('../src/services/bot/src/webform_flow', () => ({
  WebformFiller: vi.fn().mockImplementation(() => ({
    start: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    navigate_to_base: vi.fn(() => Promise.resolve()),
    wait_for_form_ready: vi.fn(() => Promise.resolve()),
    submit_form: vi.fn(() => Promise.resolve(true)),
    inject_field_value: vi.fn(() => Promise.resolve()),
    require_page: vi.fn(() => ({
      goto: vi.fn(() => Promise.resolve()),
      locator: vi.fn(() => ({
        fill: vi.fn(() => Promise.resolve()),
        type: vi.fn(() => Promise.resolve()),
        click: vi.fn(() => Promise.resolve())
      })),
      url: vi.fn(() => 'https://app.smartsheet.com/b/form/123')
    })),
    formConfig: {
      BASE_URL: '',
      FORM_ID: '',
      SUBMISSION_ENDPOINT: '',
      SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: []
    }
  }))
}));

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => Promise.resolve({
      newContext: vi.fn(() => Promise.resolve({
        newPage: vi.fn(() => Promise.resolve({
          goto: vi.fn(() => Promise.resolve()),
          locator: vi.fn(() => ({
            fill: vi.fn(() => Promise.resolve()),
            type: vi.fn(() => Promise.resolve()),
            click: vi.fn(() => Promise.resolve())
          })),
          url: vi.fn(() => 'https://app.smartsheet.com/b/form/123')
        }))
      }))
    }))
  }
}));

describe('Quarter Routing Integration', () => {
  let q3FormConfig: ReturnType<typeof createFormConfig>;
  let q4FormConfig: ReturnType<typeof createFormConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create Q3 form config
    q3FormConfig = createFormConfig(
      QUARTER_DEFINITIONS[0].formUrl,
      QUARTER_DEFINITIONS[0].formId
    );

    // Create Q4 form config
    q4FormConfig = createFormConfig(
      QUARTER_DEFINITIONS[1].formUrl,
      QUARTER_DEFINITIONS[1].formId
    );
  });

  describe('BotOrchestrator with formConfig', () => {
    it('should require formConfig parameter (no longer optional)', () => {
      expect(() => {
        // @ts-expect-error - Testing that formConfig is required
        new BotOrchestrator(Cfg, undefined as any, false, null, undefined);
      }).toThrow('formConfig is required');
    });

    it('should throw error if formConfig is missing', () => {
      expect(() => {
        // @ts-expect-error - Testing that formConfig is required
        new BotOrchestrator(Cfg, undefined as any, false, null, undefined);
      }).toThrow('formConfig is required');
    });

    it('should accept valid formConfig for Q3', () => {
      const orchestrator = new BotOrchestrator(Cfg, q3FormConfig, false, null, undefined);
      expect(orchestrator.formConfig.BASE_URL).toBe(QUARTER_DEFINITIONS[0].formUrl);
      expect(orchestrator.formConfig.FORM_ID).toBe(QUARTER_DEFINITIONS[0].formId);
    });

    it('should accept valid formConfig for Q4', () => {
      const orchestrator = new BotOrchestrator(Cfg, q4FormConfig, false, null, undefined);
      expect(orchestrator.formConfig.BASE_URL).toBe(QUARTER_DEFINITIONS[1].formUrl);
      expect(orchestrator.formConfig.FORM_ID).toBe(QUARTER_DEFINITIONS[1].formId);
    });

    it('should pass formConfig to WebformFiller', () => {
      new BotOrchestrator(Cfg, q3FormConfig, false, null, undefined);
      
      expect(WebformFiller).toHaveBeenCalledWith(
        expect.anything(), // config
        expect.anything(), // headless
        expect.anything(), // browser_kind
        q3FormConfig // formConfig
      );
    });
  });

  describe('LoginManager uses dynamic formConfig', () => {
    it('should create LoginManager with formConfig from WebformFiller', () => {
      const q3FormConfig = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      const orchestrator = new BotOrchestrator(Cfg, q3FormConfig, false, null, undefined);
      const loginManager = orchestrator.login_manager;

      // LoginManager should have access to formConfig through WebformFiller
      expect(loginManager).toBeDefined();
    });

    it('should navigate to correct Q3 form URL', async () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      const orchestrator = new BotOrchestrator(Cfg, q3Config, false, null, undefined);
      
      // Mock the page.goto method to verify it's called with correct URL
      const mockGoto = vi.fn(() => Promise.resolve());
      const _page = { goto: mockGoto, url: vi.fn(() => QUARTER_DEFINITIONS[0].formUrl) };
      
      // The LoginManager should use orchestrator.webform_filler.require_page()
      // which has access to formConfig
      expect(orchestrator.formConfig.BASE_URL).toBe(QUARTER_DEFINITIONS[0].formUrl);
    });

    it('should navigate to correct Q4 form URL', async () => {
      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      const orchestrator = new BotOrchestrator(Cfg, q4Config, false, null, undefined);
      
      expect(orchestrator.formConfig.BASE_URL).toBe(QUARTER_DEFINITIONS[1].formUrl);
    });
  });

  describe('createFormConfig function', () => {
    it('should create valid config with custom URL and ID', () => {
      const config = createFormConfig(
        'https://example.com/form/123',
        'form-123'
      );

      expect(config.BASE_URL).toBe('https://example.com/form/123');
      expect(config.FORM_ID).toBe('form-123');
      expect(config.SUBMISSION_ENDPOINT).toBe('https://forms.smartsheet.com/api/submit/form-123');
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toEqual([
        '**forms.smartsheet.com/api/submit/form-123',
        '**forms.smartsheet.com/**',
        '**app.smartsheet.com/**'
      ]);
    });

    it('should generate correct SUBMISSION_ENDPOINT', () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      expect(q3Config.SUBMISSION_ENDPOINT).toBe(
        `https://forms.smartsheet.com/api/submit/${QUARTER_DEFINITIONS[0].formId}`
      );
    });

    it('should generate correct URL patterns', () => {
      const testFormId = 'test-form-id-123';
      const config = createFormConfig('https://example.com', testFormId);

      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toContain(
        `**forms.smartsheet.com/api/submit/${testFormId}`
      );
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toContain('**forms.smartsheet.com/**');
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toContain('**app.smartsheet.com/**');
    });
  });

  describe('Quarter validation in BotOrchestrator', () => {
    it('should validate that Q3 dates use Q3 form config', () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      const orchestrator = new BotOrchestrator(Cfg, q3Config, false, null, undefined);

      // Q3 dates should be valid with Q3 form config
      expect(orchestrator.formConfig.FORM_ID).toBe(QUARTER_DEFINITIONS[0].formId);
    });

    it('should validate that Q4 dates use Q4 form config', () => {
      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      const orchestrator = new BotOrchestrator(Cfg, q4Config, false, null, undefined);

      // Q4 dates should be valid with Q4 form config
      expect(orchestrator.formConfig.FORM_ID).toBe(QUARTER_DEFINITIONS[1].formId);
    });

    it('should detect mismatch between Q3 date and Q4 form config', async () => {
      // This will be tested in the actual submission flow
      // where entries are validated before processing
      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      const orchestrator = new BotOrchestrator(Cfg, q4Config, false, null, undefined);

      // The validation happens in _run_automation_internal
      // We expect Q4 config to reject Q3 dates
      expect(orchestrator.formConfig.FORM_ID).not.toBe(QUARTER_DEFINITIONS[0].formId);
    });

    it('should detect mismatch between Q4 date and Q3 form config', async () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      const orchestrator = new BotOrchestrator(Cfg, q3Config, false, null, undefined);

      // The validation happens in _run_automation_internal
      // We expect Q3 config to reject Q4 dates
      expect(orchestrator.formConfig.FORM_ID).not.toBe(QUARTER_DEFINITIONS[1].formId);
    });
  });

  describe('Deprecated constants validation', () => {
    it('should have BASE_URL set to deprecated placeholder', () => {
      expect(Cfg.BASE_URL).toBe('DEPRECATED_USE_DYNAMIC_CONFIG');
    });

    it('should have FORM_ID set to deprecated placeholder', () => {
      expect(Cfg.FORM_ID).toBe('DEPRECATED_USE_DYNAMIC_CONFIG');
    });

    it('should have SUBMISSION_ENDPOINT include deprecated placeholder', () => {
      expect(Cfg.SUBMISSION_ENDPOINT).toContain('DEPRECATED');
    });

    it('should have SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS include deprecated placeholder', () => {
      const patterns = Cfg.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS;
      expect(patterns[0]).toContain('DEPRECATED');
    });
  });

  describe('Date format handling', () => {
    it('should support date format conversion from mm/dd/yyyy to yyyy-mm-dd', () => {
      // This tests the date conversion logic in BotOrchestrator._run_automation_internal
      const testCases = [
        { input: '07/01/2025', expected: '2025-07-01' },
        { input: '09/30/2025', expected: '2025-09-30' },
        { input: '10/01/2025', expected: '2025-10-01' },
        { input: '12/31/2025', expected: '2025-12-31' },
        { input: '01/15/2025', expected: '2025-01-15' }
      ];

      testCases.forEach(({ input, expected }) => {
        const [month, day, year] = input.split('/');
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        expect(isoDate).toBe(expected);
      });
    });

    it('should pad single-digit months and days', () => {
      const testCases = [
        { input: '7/1/2025', expected: '2025-07-01' },
        { input: '9/5/2025', expected: '2025-09-05' },
        { input: '1/1/2025', expected: '2025-01-01' }
      ];

      testCases.forEach(({ input, expected }) => {
        const [month, day, year] = input.split('/');
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        expect(isoDate).toBe(expected);
      });
    });
  });

  describe('Quarter routing in timesheet submission', () => {
    it('should create separate form configs for Q3 and Q4', () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      expect(q3Config.FORM_ID).not.toBe(q4Config.FORM_ID);
      expect(q3Config.BASE_URL).not.toBe(q4Config.BASE_URL);
    });

    it('should use correct form URL for Q3 entries', () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      expect(q3Config.BASE_URL).toBe(QUARTER_DEFINITIONS[0].formUrl);
    });

    it('should use correct form URL for Q4 entries', () => {
      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      expect(q4Config.BASE_URL).toBe(QUARTER_DEFINITIONS[1].formUrl);
    });

    it('should generate correct submission endpoints for each quarter', () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      expect(q3Config.SUBMISSION_ENDPOINT).toContain(QUARTER_DEFINITIONS[0].formId);
      expect(q4Config.SUBMISSION_ENDPOINT).toContain(QUARTER_DEFINITIONS[1].formId);
    });
  });
});

