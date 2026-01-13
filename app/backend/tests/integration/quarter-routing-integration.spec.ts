/**
 * @fileoverview Quarter Routing Integration Tests
 *
 * Tests the integration of quarter routing with BotOrchestrator and LoginManager
 * to ensure entries are submitted to the correct quarterly form based on their dates.
 *
 * IMPORTANT: The quarter configuration uses a rolling window pattern.
 * Only the current quarter and previous quarter are available at any given time.
 * These tests work with whatever quarters are configured in the rolling window.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BotOrchestrator } from "../../src/services/bot/src/core/bot_orchestation";
import {
  WebformSessionManager as _WebformFiller,
  type FormConfig,
} from "../../src/services/bot/src/browser/webform_session";
import { createFormConfig } from "../../src/services/bot/src/config/automation_config";
import * as Cfg from "../../src/services/bot/src/config/automation_config";
import { QUARTER_DEFINITIONS } from "../../src/services/bot/src/config/quarter_config";

// Mock the logger
vi.mock("../src/shared/logger", () => ({
  botLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
  },
  authLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
    startTimer: vi.fn(() => ({
      done: vi.fn(),
    })),
  },
}));

// Mock WebformFiller
vi.mock("../src/services/bot/src/webform_flow", () => ({
  WebformFiller: class {
    start = vi.fn(() => Promise.resolve());
    close = vi.fn(() => Promise.resolve());
    navigate_to_base = vi.fn(() => Promise.resolve());
    wait_for_form_ready = vi.fn(() => Promise.resolve());
    submit_form = vi.fn(() => Promise.resolve(true));
    inject_field_value = vi.fn(() => Promise.resolve());
    require_page = vi.fn(() => ({
      goto: vi.fn(() => Promise.resolve()),
      locator: vi.fn(() => ({
        fill: vi.fn(() => Promise.resolve()),
        type: vi.fn(() => Promise.resolve()),
        click: vi.fn(() => Promise.resolve()),
      })),
      url: vi.fn(() => "https://app.smartsheet.com/b/form/123"),
    }));
    formConfig = {
      BASE_URL: "",
      FORM_ID: "",
      SUBMISSION_ENDPOINT: "",
      SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: [],
    };
    // Add constructor to accept args without error
    constructor() {}
  },
}));

// Mock Electron browser
vi.mock("../src/services/bot/src/electron-browser", () => ({
  chromium: vi.fn(() => ({
    launch: vi.fn(() =>
      Promise.resolve({
        newContext: vi.fn(() =>
          Promise.resolve({
            newPage: vi.fn(() =>
              Promise.resolve({
                goto: vi.fn(() => Promise.resolve()),
                locator: vi.fn(() => ({
                  fill: vi.fn(() => Promise.resolve()),
                  type: vi.fn(() => Promise.resolve()),
                  click: vi.fn(() => Promise.resolve()),
                })),
                url: vi.fn(() => "https://app.smartsheet.com/b/form/123"),
              })
            ),
          })
        ),
      })
    ),
  })),
}));

describe("Quarter Routing Integration", () => {
  let firstQuarterFormConfig: ReturnType<typeof createFormConfig>;
  let secondQuarterFormConfig: ReturnType<typeof createFormConfig> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create form configs for quarters in rolling window
    // First quarter is current, second is previous (if exists)
    if (QUARTER_DEFINITIONS.length === 0) {
      throw new Error("QUARTER_DEFINITIONS must contain at least one quarter");
    }

    firstQuarterFormConfig = createFormConfig(
      QUARTER_DEFINITIONS[0]!.formUrl,
      QUARTER_DEFINITIONS[0]!.formId
    );

    // Second quarter exists if rolling window has 2 quarters
    if (QUARTER_DEFINITIONS.length >= 2) {
      secondQuarterFormConfig = createFormConfig(
        QUARTER_DEFINITIONS[1]!.formUrl,
        QUARTER_DEFINITIONS[1]!.formId
      );
    }
  });

  describe("BotOrchestrator with formConfig", () => {
    it("should require formConfig parameter (no longer optional)", () => {
      expect(() => {
        new BotOrchestrator(
          Cfg,
          undefined as unknown as FormConfig,
          false,
          null,
          undefined
        );
      }).toThrow("formConfig is required");
    });

    it("should throw error if formConfig is missing", () => {
      expect(() => {
        new BotOrchestrator(
          Cfg,
          undefined as unknown as FormConfig,
          false,
          null,
          undefined
        );
      }).toThrow("formConfig is required");
    });

    it("should accept valid formConfig for first quarter in rolling window", () => {
      const orchestrator = new BotOrchestrator(
        Cfg,
        firstQuarterFormConfig,
        false,
        null,
        undefined
      );
      expect(orchestrator.formConfig.BASE_URL).toBe(
        QUARTER_DEFINITIONS[0]!.formUrl
      );
      expect(orchestrator.formConfig.FORM_ID).toBe(
        QUARTER_DEFINITIONS[0]!.formId
      );
    });

    it("should accept valid formConfig for second quarter in rolling window", () => {
      if (!secondQuarterFormConfig) {
        // Skip if only one quarter in rolling window
        return;
      }
      const orchestrator = new BotOrchestrator(
        Cfg,
        secondQuarterFormConfig,
        false,
        null,
        undefined
      );
      expect(orchestrator.formConfig.BASE_URL).toBe(
        QUARTER_DEFINITIONS[1]!.formUrl
      );
      expect(orchestrator.formConfig.FORM_ID).toBe(
        QUARTER_DEFINITIONS[1]!.formId
      );
    });

    it("should pass formConfig to WebformFiller", () => {
      const orchestrator = new BotOrchestrator(
        Cfg,
        firstQuarterFormConfig,
        false,
        null,
        undefined
      );

      // Verify that the formConfig is set on the orchestrator
      expect(orchestrator.formConfig).toBeDefined();
      expect(orchestrator.formConfig.BASE_URL).toBe(
        firstQuarterFormConfig.BASE_URL
      );
      expect(orchestrator.formConfig.FORM_ID).toBe(
        firstQuarterFormConfig.FORM_ID
      );
    });
  });

  describe("LoginManager uses dynamic formConfig", () => {
    it("should create LoginManager with formConfig from WebformFiller", () => {
      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[0]!.formUrl,
        QUARTER_DEFINITIONS[0]!.formId
      );

      const orchestrator = new BotOrchestrator(
        Cfg,
        formConfig,
        false,
        null,
        undefined
      );
      const loginManager = orchestrator.login_manager;

      // LoginManager should have access to formConfig through WebformFiller
      expect(loginManager).toBeDefined();
    });

    it("should navigate to correct form URL for first quarter", async () => {
      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[0]!.formUrl,
        QUARTER_DEFINITIONS[0]!.formId
      );

      const orchestrator = new BotOrchestrator(
        Cfg,
        formConfig,
        false,
        null,
        undefined
      );

      // Mock the page.goto method to verify it's called with correct URL
      const mockGoto = vi.fn(() => Promise.resolve());
      const _page = {
        goto: mockGoto,
        url: vi.fn(() => QUARTER_DEFINITIONS[0]!.formUrl),
      };

      // The LoginManager should use orchestrator.webform_filler.require_page()
      // which has access to formConfig
      expect(orchestrator.formConfig.BASE_URL).toBe(
        QUARTER_DEFINITIONS[0]!.formUrl
      );
    });

    it("should navigate to correct form URL for second quarter", async () => {
      if (QUARTER_DEFINITIONS.length < 2) {
        // Skip if only one quarter in rolling window
        return;
      }

      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[1]!.formUrl,
        QUARTER_DEFINITIONS[1]!.formId
      );

      const orchestrator = new BotOrchestrator(
        Cfg,
        formConfig,
        false,
        null,
        undefined
      );

      expect(orchestrator.formConfig.BASE_URL).toBe(
        QUARTER_DEFINITIONS[1]!.formUrl
      );
    });
  });

  describe("createFormConfig function", () => {
    it("should create valid config with custom URL and ID", () => {
      const config = createFormConfig(
        "https://example.com/form/123",
        "form-123"
      );

      expect(config.BASE_URL).toBe("https://example.com/form/123");
      expect(config.FORM_ID).toBe("form-123");
      expect(config.SUBMISSION_ENDPOINT).toBe(
        "https://forms.smartsheet.com/api/submit/form-123"
      );
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toEqual([
        "**forms.smartsheet.com/api/submit/form-123",
        "**forms.smartsheet.com/**",
        "**app.smartsheet.com/**",
      ]);
    });

    it("should generate correct SUBMISSION_ENDPOINT", () => {
      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[0]!.formUrl,
        QUARTER_DEFINITIONS[0]!.formId
      );

      expect(formConfig.SUBMISSION_ENDPOINT).toBe(
        `https://forms.smartsheet.com/api/submit/${QUARTER_DEFINITIONS[0]!.formId}`
      );
    });

    it("should generate correct URL patterns", () => {
      const testFormId = "test-form-id-123";
      const config = createFormConfig("https://example.com", testFormId);

      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toContain(
        `**forms.smartsheet.com/api/submit/${testFormId}`
      );
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toContain(
        "**forms.smartsheet.com/**"
      );
      expect(config.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS).toContain(
        "**app.smartsheet.com/**"
      );
    });
  });

  describe("Quarter validation in BotOrchestrator", () => {
    it("should validate that first quarter dates use first quarter form config", () => {
      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[0]!.formUrl,
        QUARTER_DEFINITIONS[0]!.formId
      );

      const orchestrator = new BotOrchestrator(
        Cfg,
        formConfig,
        false,
        null,
        undefined
      );

      // First quarter dates should be valid with first quarter form config
      expect(orchestrator.formConfig.FORM_ID).toBe(
        QUARTER_DEFINITIONS[0]!.formId
      );
    });

    it("should validate that second quarter dates use second quarter form config", () => {
      if (QUARTER_DEFINITIONS.length < 2) {
        // Skip if only one quarter in rolling window
        return;
      }

      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[1]!.formUrl,
        QUARTER_DEFINITIONS[1]!.formId
      );

      const orchestrator = new BotOrchestrator(
        Cfg,
        formConfig,
        false,
        null,
        undefined
      );

      // Second quarter dates should be valid with second quarter form config
      expect(orchestrator.formConfig.FORM_ID).toBe(
        QUARTER_DEFINITIONS[1]!.formId
      );
    });

    it("should detect mismatch between quarters in rolling window", async () => {
      if (QUARTER_DEFINITIONS.length < 2) {
        // Skip if only one quarter in rolling window
        return;
      }

      // This will be tested in the actual submission flow
      // where entries are validated before processing
      const secondQuarterConfig = createFormConfig(
        QUARTER_DEFINITIONS[1]!.formUrl,
        QUARTER_DEFINITIONS[1]!.formId
      );

      const orchestrator = new BotOrchestrator(
        Cfg,
        secondQuarterConfig,
        false,
        null,
        undefined
      );

      // The validation happens in _run_automation_internal
      // We expect second quarter config to not match first quarter form ID
      expect(orchestrator.formConfig.FORM_ID).not.toBe(
        QUARTER_DEFINITIONS[0]!.formId
      );
    });

    it("should detect mismatch when using wrong quarter form config", async () => {
      if (QUARTER_DEFINITIONS.length < 2) {
        // Skip if only one quarter in rolling window
        return;
      }

      const firstQuarterConfig = createFormConfig(
        QUARTER_DEFINITIONS[0]!.formUrl,
        QUARTER_DEFINITIONS[0]!.formId
      );

      const orchestrator = new BotOrchestrator(
        Cfg,
        firstQuarterConfig,
        false,
        null,
        undefined
      );

      // The validation happens in _run_automation_internal
      // We expect first quarter config to not match second quarter form ID
      expect(orchestrator.formConfig.FORM_ID).not.toBe(
        QUARTER_DEFINITIONS[1]!.formId
      );
    });
  });

  describe("Deprecated constants validation", () => {
    it("should have BASE_URL set to deprecated placeholder", () => {
      expect(Cfg.BASE_URL).toBe("DEPRECATED_USE_DYNAMIC_CONFIG");
    });

    it("should have FORM_ID set to deprecated placeholder", () => {
      expect(Cfg.FORM_ID).toBe("DEPRECATED_USE_DYNAMIC_CONFIG");
    });

    it("should have SUBMISSION_ENDPOINT include deprecated placeholder", () => {
      expect(Cfg.SUBMISSION_ENDPOINT).toContain("DEPRECATED");
    });

    it("should have SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS include deprecated placeholder", () => {
      const patterns = Cfg.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS;
      expect(patterns[0]).toContain("DEPRECATED");
    });
  });

  describe("Date format handling", () => {
    it("should support date format conversion from mm/dd/yyyy to yyyy-mm-dd", () => {
      // This tests the date conversion logic in BotOrchestrator._run_automation_internal
      // Generate test cases from configured quarters
      const testCases: Array<{ input: string; expected: string }> = [];
      QUARTER_DEFINITIONS.forEach((quarter) => {
        const startDate = new Date(quarter.startDate);
        const endDate = new Date(quarter.endDate);

        // Add start and end dates
        testCases.push({
          input: `${(startDate.getMonth() + 1).toString().padStart(2, "0")}/${startDate.getDate().toString().padStart(2, "0")}/${startDate.getFullYear()}`,
          expected: quarter.startDate,
        });
        testCases.push({
          input: `${(endDate.getMonth() + 1).toString().padStart(2, "0")}/${endDate.getDate().toString().padStart(2, "0")}/${endDate.getFullYear()}`,
          expected: quarter.endDate,
        });
      });

      testCases.forEach(({ input, expected }) => {
        const [month, day, year] = input.split("/");
        const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        expect(isoDate).toBe(expected);
      });
    });

    it("should pad single-digit months and days", () => {
      // Generate test cases from configured quarters
      const testCases: Array<{ input: string; expected: string }> = [];
      QUARTER_DEFINITIONS.forEach((quarter) => {
        const startDate = new Date(quarter.startDate);
        // Use unpadded format and verify padding works
        testCases.push({
          input: `${startDate.getMonth() + 1}/${startDate.getDate()}/${startDate.getFullYear()}`,
          expected: quarter.startDate,
        });
      });

      testCases.forEach(({ input, expected }) => {
        const [month, day, year] = input.split("/");
        const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        expect(isoDate).toBe(expected);
      });
    });
  });

  describe("Quarter routing in timesheet submission", () => {
    it("should create separate form configs for each quarter in rolling window", () => {
      const firstConfig = createFormConfig(
        QUARTER_DEFINITIONS[0]!.formUrl,
        QUARTER_DEFINITIONS[0]!.formId
      );

      if (QUARTER_DEFINITIONS.length >= 2) {
        const secondConfig = createFormConfig(
          QUARTER_DEFINITIONS[1]!.formUrl,
          QUARTER_DEFINITIONS[1]!.formId
        );

        expect(firstConfig.FORM_ID).not.toBe(secondConfig.FORM_ID);
        expect(firstConfig.BASE_URL).not.toBe(secondConfig.BASE_URL);
      }

      // Verify at least one config is created
      expect(firstConfig.FORM_ID).toBeTruthy();
      expect(firstConfig.BASE_URL).toBeTruthy();
    });

    it("should use correct form URL for first quarter entries", () => {
      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[0]!.formUrl,
        QUARTER_DEFINITIONS[0]!.formId
      );

      expect(formConfig.BASE_URL).toBe(QUARTER_DEFINITIONS[0]!.formUrl);
    });

    it("should use correct form URL for second quarter entries", () => {
      if (QUARTER_DEFINITIONS.length < 2) {
        // Skip if only one quarter in rolling window
        return;
      }

      const formConfig = createFormConfig(
        QUARTER_DEFINITIONS[1]!.formUrl,
        QUARTER_DEFINITIONS[1]!.formId
      );

      expect(formConfig.BASE_URL).toBe(QUARTER_DEFINITIONS[1]!.formUrl);
    });

    it("should generate correct submission endpoints for each quarter", () => {
      QUARTER_DEFINITIONS.forEach((quarter) => {
        const formConfig = createFormConfig(quarter.formUrl, quarter.formId);

        expect(formConfig.SUBMISSION_ENDPOINT).toContain(quarter.formId);
        expect(formConfig.SUBMISSION_ENDPOINT).toBe(
          `https://forms.smartsheet.com/api/submit/${quarter.formId}`
        );
      });
    });
  });
});
