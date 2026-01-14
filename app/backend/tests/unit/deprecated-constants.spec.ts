/**
 * @fileoverview Deprecated Constants Tests
 * 
 * Tests that deprecated constants are properly marked and that the
 * createFormConfig function works correctly as the replacement.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import * as Cfg from '@sheetpilot/bot';
import { createFormConfig, QUARTER_DEFINITIONS } from '@sheetpilot/bot';

describe('Deprecated Constants', () => {
  describe('Deprecated constant values', () => {
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
      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toContain('DEPRECATED');
    });
  });

  describe('createFormConfig function', () => {
    it('should create valid config with custom URL and ID', () => {
      const testUrl = 'https://app.smartsheet.com/b/form/test123';
      const testId = 'test123';
      
      const config = createFormConfig(testUrl, testId);

      expect(config.BASE_URL).toBe(testUrl);
      expect(config.FORM_ID).toBe(testId);
      expect(config.SUBMISSION_ENDPOINT).toBe('https://forms.smartsheet.com/api/submit/test123');
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toEqual([
        '**forms.smartsheet.com/api/submit/test123',
        '**forms.smartsheet.com/**',
        '**app.smartsheet.com/**'
      ]);
    });

    it('should generate correct SUBMISSION_ENDPOINT', () => {
      const q3FormId = QUARTER_DEFINITIONS[0].formId;
      const config = createFormConfig('https://example.com', q3FormId);

      expect(config.SUBMISSION_ENDPOINT).toBe(
        `https://forms.smartsheet.com/api/submit/${q3FormId}`
      );
    });

    it('should generate correct URL patterns', () => {
      const testFormId = 'test-form-id-456';
      const config = createFormConfig('https://app.smartsheet.com/b/form/xyz', testFormId);

      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toHaveLength(3);
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS[0]).toBe(
        `**forms.smartsheet.com/api/submit/${testFormId}`
      );
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS[1]).toBe('**forms.smartsheet.com/**');
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS[2]).toBe('**app.smartsheet.com/**');
    });

    it('should create unique configs for different form IDs', () => {
      const config1 = createFormConfig('https://example.com/form1', 'form1');
      const config2 = createFormConfig('https://example.com/form2', 'form2');

      expect(config1.FORM_ID).not.toBe(config2.FORM_ID);
      expect(config1.BASE_URL).not.toBe(config2.BASE_URL);
      expect(config1.SUBMISSION_ENDPOINT).not.toBe(config2.SUBMISSION_ENDPOINT);
    });

    it('should work with Q3 quarter definition', () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      expect(q3Config.BASE_URL).toBe(QUARTER_DEFINITIONS[0].formUrl);
      expect(q3Config.FORM_ID).toBe(QUARTER_DEFINITIONS[0].formId);
      expect(q3Config.SUBMISSION_ENDPOINT).toContain(QUARTER_DEFINITIONS[0].formId);
    });

    it('should work with Q4 quarter definition', () => {
      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      expect(q4Config.BASE_URL).toBe(QUARTER_DEFINITIONS[1].formUrl);
      expect(q4Config.FORM_ID).toBe(QUARTER_DEFINITIONS[1].formId);
      expect(q4Config.SUBMISSION_ENDPOINT).toContain(QUARTER_DEFINITIONS[1].formId);
    });

    it('should generate correct patterns for Q3 form', () => {
      const q3Config = createFormConfig(
        QUARTER_DEFINITIONS[0].formUrl,
        QUARTER_DEFINITIONS[0].formId
      );

      const patterns = q3Config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS;
      expect(patterns).toContain(
        `**forms.smartsheet.com/api/submit/${QUARTER_DEFINITIONS[0].formId}`
      );
    });

    it('should generate correct patterns for Q4 form', () => {
      const q4Config = createFormConfig(
        QUARTER_DEFINITIONS[1].formUrl,
        QUARTER_DEFINITIONS[1].formId
      );

      const patterns = q4Config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS;
      expect(patterns).toContain(
        `**forms.smartsheet.com/api/submit/${QUARTER_DEFINITIONS[1].formId}`
      );
    });
  });

  describe('Deprecation warnings in code comments', () => {
    it('should indicate that deprecated constants should not be used', () => {
      // This tests that the deprecation is clearly documented
      expect(Cfg.BASE_URL).toBe('DEPRECATED_USE_DYNAMIC_CONFIG');
      expect(Cfg.FORM_ID).toBe('DEPRECATED_USE_DYNAMIC_CONFIG');
    });

    it('should provide createFormConfig as replacement', () => {
      // Verify that createFormConfig is available as the replacement
      expect(createFormConfig).toBeDefined();
      expect(typeof createFormConfig).toBe('function');
    });

    it('should use createFormConfig to create valid configurations', () => {
      const config = createFormConfig('https://test.com', 'test-id');
      
      expect(config.BASE_URL).not.toBe('DEPRECATED_USE_DYNAMIC_CONFIG');
      expect(config.FORM_ID).not.toBe('DEPRECATED_USE_DYNAMIC_CONFIG');
      expect(config).toHaveProperty('BASE_URL');
      expect(config).toHaveProperty('FORM_ID');
      expect(config).toHaveProperty('SUBMISSION_ENDPOINT');
      expect(config).toHaveProperty('SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS');
    });
  });
});

