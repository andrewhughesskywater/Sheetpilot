/**
 * Central configuration for timesheet automation.
 *
 * This file defines:
 * - behavior flags (submit vs fill-only, debugging toggles)
 * - timeouts and dynamic-wait tuning
 * - login steps (`LOGIN_STEPS`)
 * - field definitions (`FIELD_DEFINITIONS` / `FIELD_ORDER`)
 * - helper wait utilities
 *
 * ## How to change behavior safely
 * - Prefer updating selectors/steps here instead of scattering logic changes across the bot.
 * - Keep the unit conventions in mind:
 *   - most timeouts are **seconds**
 *   - names ending in `_MS` are **milliseconds**
 * - Use `createFormConfig()` (or quarter routing) for form URLs/IDs. Several legacy
 *   constants (`BASE_URL`, `FORM_ID`, `SUBMISSION_ENDPOINT`) exist only for compatibility.
 */

import { botLogger } from "@sheetpilot/shared/logger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Validation function type */
type ValidationFunction = (value: unknown) => boolean;

/** Error message function type */
type ErrorMessageFunction = (value: unknown) => string;

/** Field definition interface */
interface FieldDefinition {
  label: string;
  locator: string;
  type?: string;
  validation: ValidationFunction;
  error_message: ErrorMessageFunction;
  inject_value?: boolean;
  optional?: boolean;
}

/** Login step interface */
export interface LoginStep {
  name: string;
  action: string;
  locator?: string;
  element_selector?: string;
  value_key?: string;
  wait_condition?: string;
  expects_navigation?: boolean;
  optional?: boolean;
  sensitive?: boolean;
}

// ============================================================================
// BASE CONFIGURATION
// ============================================================================

/**
 * DEPRECATED: Do not use BASE_URL constant directly.
 *
 * The system now uses dynamic quarter-based form routing.
 * Use createFormConfig() to create a proper form configuration.
 *
 * @deprecated Use createFormConfig() or quarter_config instead
 */
export const BASE_URL: string =
  process.env["TS_BASE_URL"] ?? "DEPRECATED_USE_DYNAMIC_CONFIG";

/**
 * Creates a configuration object with dynamic form URL and ID
 *
 * This is the proper way to configure form URLs. The system uses quarter-based
 * routing to automatically select the correct form based on entry dates.
 *
 * @param formUrl - The form URL to use
 * @param formId - The form ID to use
 * @returns Configuration object with dynamic values
 */
export function createFormConfig(formUrl: string, formId: string) {
  return {
    BASE_URL: formUrl,
    FORM_ID: formId,
    SUBMISSION_ENDPOINT: `https://forms.smartsheet.com/api/submit/${formId}`,
    SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: [
      `**forms.smartsheet.com/api/submit/${formId}`,
      "**forms.smartsheet.com/**",
      "**app.smartsheet.com/**",
    ],
  };
}

// ============================================================================
// BROWSER CONFIGURATION
// ============================================================================

/** Browser type to use for automation (chromium only) */
export const BROWSER: string = process.env["TS_BROWSER"] ?? "chromium";
/**
 * Gets whether to run browser in headless mode
 * Reads from environment variable dynamically to support runtime changes without restart
 * @returns true if browser should run in headless mode, false otherwise
 */
export function getBrowserHeadless(): boolean {
  const envValue = process.env["BROWSER_HEADLESS"] ?? "false";
  const result = envValue.toLowerCase() === "true";
  botLogger.debug("getBrowserHeadless called", { envValue, result });
  return result;
}
/**
 * Whether to run browser in headless mode
 * @deprecated Use getBrowserHeadless() function instead for dynamic runtime updates
 */
export const BROWSER_HEADLESS: boolean = getBrowserHeadless();
/** Specific browser channel to use (e.g., 'chrome' for Chrome instead of Chromium) */
export const BROWSER_CHANNEL: string =
  process.env["BROWSER_CHANNEL"] ?? "chromium";

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

/** Default timeout for element operations in seconds */
export const ELEMENT_WAIT_TIMEOUT: number = Number(
  process.env["ELEMENT_WAIT"] ?? "10.0"
);
/** Duration to cache page context in seconds */
export const PAGE_CONTEXT_CACHE_DURATION: number = Number(
  process.env["PAGE_CTX_CACHE"] ?? "2.0"
);

// ============================================================================
// DYNAMIC WAIT CONFIGURATION
// ============================================================================

/** Multiplier for optional element wait timeouts */
export const DYNAMIC_FIELD_OPTIONAL_ELEMENT_MULTIPLIER: number = Number(
  process.env["DYNAMIC_OPTIONAL_ELEMENT_MULT"] ?? "0.3"
);
/** Multiplier for optional DOM wait timeouts */
export const DYNAMIC_FIELD_OPTIONAL_DOM_MULTIPLIER: number = Number(
  process.env["DYNAMIC_OPTIONAL_DOM_MULT"] ?? "0.1"
);
/** Multiplier for optional network wait timeouts */
export const DYNAMIC_FIELD_OPTIONAL_NETWORK_MULTIPLIER: number = Number(
  process.env["DYNAMIC_OPTIONAL_NETWORK_MULT"] ?? "0.2"
);

/** Multiplier for required element wait timeouts */
export const DYNAMIC_FIELD_REQUIRED_ELEMENT_MULTIPLIER: number = Number(
  process.env["DYNAMIC_REQUIRED_ELEMENT_MULT"] ?? "0.6"
);
/** Multiplier for required DOM wait timeouts */
export const DYNAMIC_FIELD_REQUIRED_DOM_MULTIPLIER: number = Number(
  process.env["DYNAMIC_REQUIRED_DOM_MULT"] ?? "0.15"
);
/** Multiplier for required network wait timeouts */
export const DYNAMIC_FIELD_REQUIRED_NETWORK_MULTIPLIER: number = Number(
  process.env["DYNAMIC_REQUIRED_NETWORK_MULT"] ?? "0.25"
);

/** Global timeout for all operations in seconds */
export const GLOBAL_TIMEOUT: number = Number(
  process.env["GLOBAL_TIMEOUT"] ?? "10.0"
);

/** Maximum timeout for element operations in seconds */
export const DYNAMIC_FIELD_MAX_ELEMENT_TIMEOUT: number = Number(
  process.env["DYNAMIC_MAX_ELEMENT_TIMEOUT"] ?? "6.0"
);
/** Maximum timeout for DOM operations in seconds */
export const DYNAMIC_FIELD_MAX_DOM_TIMEOUT: number = Number(
  process.env["DYNAMIC_MAX_DOM_TIMEOUT"] ?? "1.5"
);
/** Maximum timeout for network operations in seconds */
export const DYNAMIC_FIELD_MAX_NETWORK_TIMEOUT: number = Number(
  process.env["DYNAMIC_MAX_NETWORK_TIMEOUT"] ?? "2.5"
);

/** Whether dynamic wait functionality is enabled */
export const DYNAMIC_WAIT_ENABLED: boolean =
  (process.env["DYNAMIC_WAIT_ENABLED"] ?? "true").toLowerCase() === "true";
/** Base timeout for dynamic wait operations in seconds */
export const DYNAMIC_WAIT_BASE_TIMEOUT: number = Number(
  process.env["DYNAMIC_WAIT_BASE_TIMEOUT"] ?? "0.2"
);
/** Maximum timeout for dynamic wait operations in seconds */
export const DYNAMIC_WAIT_MAX_TIMEOUT: number = Number(
  process.env["DYNAMIC_WAIT_MAX_TIMEOUT"] ?? "10.0"
);
/** Multiplier for increasing wait timeouts in dynamic wait */
export const DYNAMIC_WAIT_MULTIPLIER: number = Number(
  process.env["DYNAMIC_WAIT_MULTIPLIER"] ?? "1.2"
);

// ============================================================================
// ADAPTIVE WAIT CONFIGURATION
// ============================================================================

/** Whether to enable adaptive wait times based on performance */
export const ENABLE_ADAPTIVE_WAITS: boolean =
  (process.env["ENABLE_ADAPTIVE_WAITS"] ?? "true").toLowerCase() === "true";
/** Minimum wait time multiplier for fast operations */
export const ADAPTIVE_WAIT_MIN_MULTIPLIER: number = Number(
  process.env["ADAPTIVE_WAIT_MIN"] ?? "0.3"
);
/** Maximum wait time multiplier for slow operations */
export const ADAPTIVE_WAIT_MAX_MULTIPLIER: number = Number(
  process.env["ADAPTIVE_WAIT_MAX"] ?? "2.0"
);

// ============================================================================
// SHORT WAIT CONSTANTS
// ============================================================================

/** Short wait timeout for brief UI interactions (e.g., dropdown selection) in seconds */
export const SHORT_WAIT_TIMEOUT: number = Number(
  process.env["SHORT_WAIT_TIMEOUT"] ?? "0.3"
);
/** Brief polling interval for rapid checks in milliseconds */
export const BRIEF_POLL_INTERVAL_MS: number = Number(
  process.env["BRIEF_POLL_INTERVAL_MS"] ?? "50"
);
/** Short delay timeout for UI interactions in milliseconds */
export const SHORT_DELAY_MS: number = Number(
  process.env["SHORT_DELAY_MS"] ?? "100"
);
/** Medium delay timeout for UI interactions in milliseconds */
export const MEDIUM_DELAY_MS: number = Number(
  process.env["MEDIUM_DELAY_MS"] ?? "200"
);
/** Half-timeout multiplier for faster operations */
export const HALF_TIMEOUT_MULTIPLIER: number = Number(
  process.env["HALF_TIMEOUT_MULTIPLIER"] ?? "0.5"
);

// ============================================================================
// FORM SUBMISSION CONFIGURATION
// ============================================================================

/** Whether to automatically submit forms after filling */
export const SUBMIT_FORM_AFTER_FILLING: boolean =
  (process.env["SUBMIT"] ?? "1") === "1";
/** Delay after filling before submitting form in seconds */
export const SUBMIT_DELAY_AFTER_FILLING: number = Number(
  process.env["SUBMIT_DELAY"] ?? "0.1"
);

/** Timeout for verifying submission success in milliseconds */
export const SUBMIT_VERIFY_TIMEOUT_MS: number = Number(
  process.env["SUBMIT_VERIFY_MS"] ?? "3000"
);
/** Minimum HTTP status code considered successful for submission */
export const SUBMIT_SUCCESS_MIN_STATUS: number = Number(
  process.env["SUBMIT_MIN_STATUS"] ?? "200"
);
/** Maximum HTTP status code considered successful for submission */
export const SUBMIT_SUCCESS_MAX_STATUS: number = Number(
  process.env["SUBMIT_MAX_STATUS"] ?? "299"
);
/**
 * DEPRECATED: Do not use SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS constant directly.
 *
 * The system now uses dynamic quarter-based form routing.
 * URL patterns come from createFormConfig() or quarter_config.
 *
 * @deprecated Use createFormConfig() or quarter_config instead
 */
export const SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] = [
  "**forms.smartsheet.com/api/submit/DEPRECATED",
  "**forms.smartsheet.com/**",
  "**app.smartsheet.com/**",
];

/**
 * DEPRECATED: Do not use FORM_ID constant directly.
 *
 * The system now uses dynamic quarter-based form routing.
 * Form IDs come from createFormConfig() or quarter_config.
 *
 * @deprecated Use createFormConfig() or quarter_config instead
 */
export const FORM_ID = "DEPRECATED_USE_DYNAMIC_CONFIG";
/**
 * DEPRECATED: Do not use SUBMISSION_ENDPOINT constant directly.
 *
 * The system now uses dynamic quarter-based form routing.
 * Endpoints come from createFormConfig() or quarter_config.
 *
 * @deprecated Use createFormConfig() or quarter_config instead
 */
export const SUBMISSION_ENDPOINT = `https://forms.smartsheet.com/api/submit/${FORM_ID}`;

/** Whether to validate response content for submission success */
export const ENABLE_RESPONSE_CONTENT_VALIDATION: boolean =
  (process.env["ENABLE_RESPONSE_VALIDATION"] ?? "1") === "1";
/** Text indicators that suggest successful form submission */
export const SUBMIT_SUCCESS_INDICATORS: string[] = [
  "submissionId",
  "confirmation",
  "success! we've captured your submission",
  "form submitted successfully",
  "thank you for your submission",
];

/**
 * @deprecated No longer used. The retry flow is now fixed at 3 attempts:
 * Initial → Level 1 retry (quick re-click) → Level 2 retry (form re-fill)
 */
export const SUBMIT_RETRY_ATTEMPTS: number = Number(
  process.env["SUBMIT_RETRY_ATTEMPTS"] ?? "3"
);

/** Delay for Level 1 retry (quick re-click) in seconds */
export const SUBMIT_CLICK_RETRY_DELAY_S: number = Number(
  process.env["SUBMIT_CLICK_RETRY_DELAY_S"] ?? "1.0"
);

/** Delay for Level 2 retry (form re-fill) in seconds */
export const SUBMIT_RETRY_DELAY: number = Number(
  process.env["SUBMIT_RETRY_DELAY"] ?? "2.0"
);

// ============================================================================
// SUBMIT BUTTON CONFIGURATION
// ============================================================================

/** Primary CSS selector for the submit button */
export const SUBMIT_BUTTON_LOCATOR = "button[data-client-id='form_submit_btn']";
/** Fallback selectors for finding submit buttons when primary fails */
export const SUBMIT_BUTTON_FALLBACK_LOCATORS: string[] = [
  "button[data-client-id='form_submit_btn']",
  "button:has-text('Submit')",
  "button:has-text('Save')",
  "button:has-text('Send')",
  "input[type='submit']",
  "button[type='submit']",
  "button.submit",
  "button[aria-label*='submit']",
  "button[aria-label*='save']",
  "button[title*='submit']",
  "button[title*='save']",
];

/** Timeout for detecting submit button presence in milliseconds */
export const SUBMIT_BUTTON_DETECTION_TIMEOUT_MS: number = Number(
  process.env["SUBMIT_DETECTION_TIMEOUT_MS"] ?? "10000"
);
/** Whether to enable debugging output for submission process */
export const ENABLE_SUBMIT_DEBUGGING: boolean =
  (process.env["ENABLE_SUBMIT_DEBUG"] ?? "1") === "1";
/** Whether to check for aria-disabled attribute on submit buttons */
export const ENABLE_ARIA_DISABLED_CHECK: boolean =
  (process.env["ENABLE_ARIA_DISABLED_CHECK"] ?? "1") === "1";
/** Whether submit button must be enabled before clicking */
export const SUBMIT_BUTTON_REQUIRE_ENABLED: boolean =
  (process.env["SUBMIT_BUTTON_REQUIRE_ENABLED"] ?? "1") === "1";

// ============================================================================
// FIELD VALIDATION CONFIGURATION
// ============================================================================

/** Timeout for field validation operations in milliseconds */
export const FIELD_VALIDATION_TIMEOUT_MS: number = Number(
  process.env["FIELD_VALIDATION_TIMEOUT_MS"] ?? "1000"
);
/** Whether to stop validation on first failure */
export const FIELD_VALIDATION_FAIL_FAST: boolean = [
  "1",
  "true",
  "yes",
].includes((process.env["FIELD_VALIDATION_FAIL_FAST"] ?? "true").toLowerCase());
/** Maximum number of retries for field validation */
export const FIELD_VALIDATION_MAX_RETRIES: number = Number(
  process.env["FIELD_VALIDATION_MAX_RETRIES"] ?? "1"
);

// ============================================================================
// AUTOMATION BEHAVIOR CONFIGURATION
// ============================================================================

/** Whether to stop automation when a row fails to process */
export const AUTOMATION_STOP_ON_ROW_FAILURE: boolean = [
  "1",
  "true",
  "yes",
].includes(
  (process.env["AUTOMATION_STOP_ON_ROW_FAILURE"] ?? "true").toLowerCase()
);

// ============================================================================
// DEBUGGING AND SCREENSHOT CONFIGURATION
// ============================================================================

/** Whether to enable snapshot validation for debugging */
export const ENABLE_SNAPSHOT_VALIDATION: boolean =
  (process.env["ENABLE_SNAPSHOT_VALIDATION"] ?? "1") === "1";
/** Timeout for snapshot validation in milliseconds */
export const SNAPSHOT_VALIDATION_TIMEOUT_MS: number = Number(
  process.env["SNAPSHOT_VALIDATION_TIMEOUT_MS"] ?? "5000"
);
/** Whether to capture screenshots on failures */
export const ENABLE_FAILURE_SCREENSHOTS: boolean =
  (process.env["ENABLE_SCREENSHOTS"] ?? "1") === "1";
/** Directory path for storing failure screenshots */
export const SCREENSHOT_DIRECTORY: string =
  process.env["SCREENSHOT_DIR"] ??
  "\\\\swfl-file01\\\\Maintenance\\\\Python Programs\\\\logs\\\\screenshots";
/** Whether to capture screenshots on submission failures */
export const SCREENSHOT_ON_SUBMIT_FAILURE: boolean =
  (process.env["SCREENSHOT_ON_FAILURE"] ?? "1") === "1";
/** Whether to capture screenshots on locator failures */
export const SCREENSHOT_ON_LOCATOR_FAILURE: boolean =
  (process.env["SCREENSHOT_ON_LOCATOR_FAILURE"] ?? "1") === "1";

// ============================================================================
// MISCELLANEOUS CONFIGURATION
// ============================================================================

/** Timeout for JavaScript injection operations in milliseconds */
export const JS_INJECTION_TIMEOUT_MS = 100;
/** Starting range for bot operations */
export const BOT_RANGE_START = 1;
/** Maximum number of login attempts before giving up */
export const LOGIN_MAX_ATTEMPTS = Number(
  process.env["LOGIN_MAX_ATTEMPTS"] ?? "3"
);
/** Backoff delay between login attempts in seconds */
export const LOGIN_BACKOFF_SEC = Number(
  process.env["LOGIN_BACKOFF_SEC"] ?? "1.0"
);
/** Whether to enable debug logging for bot operations */
export const BOT_DEBUG_LOGGING: boolean =
  (process.env["BOT_DEBUG_LOGGING"] ?? "0") === "1";
/** Exit code for locator failure errors */
export const BOT_LOCATOR_FAILURE_EXIT_CODE = 1;
/** Exit code for validation failure errors */
export const BOT_VALIDATION_FAILURE_EXIT_CODE = 2;

// ============================================================================
// BROWSER DIMENSIONS
// ============================================================================

/** Width of the browser window in pixels */
export const BROWSER_WINDOW_WIDTH = 1400;
/** Height of the browser window in pixels */
export const BROWSER_WINDOW_HEIGHT = 1000;
/** Width of the browser viewport in pixels */
export const BROWSER_VIEWPORT_WIDTH = 1400;
/** Height of the browser viewport in pixels */
export const BROWSER_VIEWPORT_HEIGHT = 1000;

// ============================================================================
// LOGIN CONFIGURATION
// ============================================================================

/** Sequence of steps to perform during login process */
export const LOGIN_STEPS: LoginStep[] = [
  {
    name: "Wait for Login Form",
    action: "wait",
    element_selector: "#loginEmail",
    wait_condition: "visible",
    optional: true,
  },
  {
    name: "Email Input",
    action: "input",
    locator: "#loginEmail",
    value_key: "email",
    sensitive: true,
  },
  {
    name: "Continue",
    action: "click",
    locator: "#formControl",
    expects_navigation: true,
    optional: true,
  },
  {
    name: "Wait for SSO Choice",
    action: "wait",
    element_selector: "a.clsJspButtonWide",
    wait_condition: "visible",
    optional: true,
  },
  {
    name: "Login with company account",
    action: "click",
    locator: "a.clsJspButtonWide",
    expects_navigation: true,
    optional: true,
  },
  {
    name: "Wait for AAD Email",
    action: "wait",
    element_selector: "#i0116",
    wait_condition: "visible",
  },
  {
    name: "AAD Email",
    action: "input",
    locator: "#i0116",
    value_key: "email",
    sensitive: true,
  },
  {
    name: "AAD Next",
    action: "click",
    locator: "#idSIButton9",
    expects_navigation: true,
    optional: true,
  },
  {
    name: "Wait for Password",
    action: "wait",
    element_selector: "#passwordInput",
    wait_condition: "visible",
  },
  {
    name: "Password Input",
    action: "input",
    locator: "#passwordInput",
    value_key: "password",
    sensitive: true,
  },
  {
    name: "Password Submit",
    action: "click",
    locator: "#submitButton",
    expects_navigation: true,
    optional: true,
  },
  {
    name: "Stay Signed In Prompt",
    action: "wait",
    element_selector: "#idBtn_Back",
    wait_condition: "visible",
    optional: true,
  },
  {
    name: "Stay Signed In — No",
    action: "click",
    locator: "#idBtn_Back",
    expects_navigation: true,
    optional: true,
  },
  {
    name: "Wait for Form Page Ready",
    action: "wait",
    element_selector: "input[aria-label='Project Task']",
    wait_condition: "visible",
    optional: false,
  },
];

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

/** Configuration for form fields including locators, validation, and behavior */
export const FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  project_code: {
    label: "Project",
    locator: "input[aria-label='Project Task']",
    validation: (x: unknown) => x !== "DISALLOWED",
    error_message: (x: unknown) =>
      `Project code '${String(x)}' is not allowed.`,
    inject_value: true,
  },
  date: {
    label: "Date",
    locator: "input[placeholder='mm/dd/yyyy']",
    validation: (x: unknown) => Boolean(x),
    error_message: (x: unknown) => `Date '${String(x)}' must be mm/dd/yyyy`,
    inject_value: true,
  },
  hours: {
    label: "Hours",
    locator: "input[aria-label='Hours']",
    validation: (x: unknown) => 0.0 <= Number(x) && Number(x) <= 24.0,
    error_message: (_: unknown) => `Hours must be between 0.0 and 24.0`,
    inject_value: true,
  },
  task_description: {
    label: "Task Description",
    locator: "role=textbox[name='Task Description']",
    validation: (x: unknown) => Boolean(String(x).trim()),
    error_message: (_: unknown) => "Task description is required",
    inject_value: true,
  },
  tool: {
    label: "Tool",
    locator: "input[aria-label*='Tool']",
    validation: (_: unknown) => true,
    error_message: (_: unknown) => "Tool validation failed",
    optional: true,
    inject_value: true,
  },
  detail_code: {
    label: "Detail Charge Code",
    locator: "input[aria-label='Detail Charge Code']",
    type: "dropdown",
    validation: (_: unknown) => true,
    error_message: (x: unknown) => `Detail code '${String(x)}' is not allowed.`,
    optional: true,
    inject_value: true,
  },
};

/** Order in which fields should be processed during form filling */
export const FIELD_ORDER: string[] = [
  "project_code",
  "date",
  "hours",
  "tool",
  "task_description",
  "detail_code",
];

/** Mapping of project codes to their specific tool labels */
export const PROJECT_TO_TOOL_LABEL: Record<string, string> = {
  "OSC-BBB": "BBB Tool",
  "FL-Carver Techs": "Carver Tool",
  "FL-Carver Tools": "Carver Tool",
  "SWFL-EQUIP": "SWFL Tool",
};

// ============================================================================
// DYNAMIC WAIT UTILITIES
// ============================================================================

/**
 * Sleeps for the specified number of milliseconds
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Dynamically waits for a condition to be true with exponential backoff
 *
 * Continuously checks a condition function with increasing delays until
 * the condition is met or maximum timeout is reached.
 *
 * @param condition_func - Function that returns true when condition is met
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @param multiplier - Multiplier for increasing delays
 * @param _operation_name - Name of operation for logging (unused)
 * @returns Promise resolving to true if condition met, false if timeout
 */
export async function dynamic_wait(
  condition_func: () => boolean | Promise<boolean>,
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT,
  multiplier = DYNAMIC_WAIT_MULTIPLIER,
  _operation_name = "operation"
): Promise<boolean> {
  if (!DYNAMIC_WAIT_ENABLED) {
    await sleep(base_timeout * 1000);
    return Boolean(await condition_func());
  }
  const start = Date.now();
  let current = base_timeout;
  while ((Date.now() - start) / 1000 < max_timeout) {
    if (await condition_func()) return true;
    await sleep(current * 1000);
    const elapsed = (Date.now() - start) / 1000;
    current = Math.min(
      current * multiplier,
      Math.max(0, max_timeout - elapsed)
    );
  }
  return false;
}

/**
 * Waits for an element to reach the specified state using dynamic wait
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector for the element
 * @param state - Desired state of the element (visible, hidden, attached)
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @param _operation_name - Name of operation for logging (unused)
 * @returns Promise resolving to true if element reaches state, false if timeout
 */
export async function dynamic_wait_for_element(
  page: import("playwright").Page,
  selector: string,
  state: "visible" | "hidden" | "attached" = "visible",
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT,
  _operation_name = "element"
): Promise<boolean> {
  return dynamic_wait(
    async () => {
      try {
        const locator = page.locator(selector);
        const count = await locator.count();
        if (count === 0) return false;
        const first = locator.first();
        if (state === "visible") return await first.isVisible();
        if (state === "hidden") return !(await first.isVisible());
        if (state === "attached")
          return await first.isEnabled().catch(() => false);
        return false;
      } catch {
        return false;
      }
    },
    base_timeout,
    max_timeout,
    DYNAMIC_WAIT_MULTIPLIER,
    `element (${selector})`
  );
}

/**
 * Waits for a page to finish loading using dynamic wait
 *
 * @param page - Playwright Page instance
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @param _operation_name - Name of operation for logging (unused)
 * @returns Promise resolving to true if page loads, false if timeout
 */
export async function dynamic_wait_for_page_load(
  page: import("playwright").Page,
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT,
  _operation_name = "page load"
): Promise<boolean> {
  return dynamic_wait(
    async () => {
      try {
        const state = await page.evaluate(() => document.readyState);
        return state === "complete";
      } catch {
        return false;
      }
    },
    base_timeout,
    max_timeout
  );
}

/**
 * Waits for network activity to become idle using dynamic wait
 *
 * @param page - Playwright Page instance
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @param _operation_name - Name of operation for logging (unused)
 * @returns Promise resolving to true if network becomes idle, false if timeout
 */
export async function dynamic_wait_for_network_idle(
  page: import("playwright").Page,
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT,
  _operation_name = "network idle"
): Promise<boolean> {
  return dynamic_wait(
    async () => {
      try {
        // Heuristic approach: wait for network to become idle
        // Note: Playwright lacks a direct performance API in Node.js
        // This is a minimal implementation that can be replaced with
        // page.waitForLoadState('networkidle') if more robust behavior is needed
        await page
          .waitForLoadState("networkidle", { timeout: base_timeout * 1000 })
          .catch((error) => {
            botLogger.debug("Network idle wait failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          });
        return true;
      } catch (error) {
        botLogger.debug("Error waiting for network idle", {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    base_timeout,
    max_timeout
  );
}

/**
 * Wait for DOM element to appear and become stable, with fallback to proceed if no activity
 *
 * @param page - Playwright Page instance
 * @param selector - CSS selector to wait for
 * @param state - Element state to wait for ('visible', 'hidden', 'attached', 'detached')
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @param operation_name - Name of operation for logging
 * @returns Promise resolving to true if element becomes stable or if no activity detected
 */
export async function wait_for_dom_stability(
  page: import("playwright").Page,
  selector: string,
  state: "visible" | "hidden" | "attached" | "detached" = "visible",
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT,
  operation_name = "DOM stability"
): Promise<boolean> {
  return dynamic_wait(
    async () => {
      try {
        const element = page.locator(selector);

        // Quick check if element exists and is in desired state
        // Capture state in closure since evaluate doesn't accept parameters for this use case
        const targetState = state;
        const isInState = await element
          .evaluate((el: HTMLElement | SVGElement) => {
            if (!el) return false;

            // Use type guard to check if element is HTMLElement
            const htmlEl = el as HTMLElement & {
              offsetWidth?: number;
              offsetHeight?: number;
            };

            // Use DOM APIs to check element state
            // Note: targetState is captured from closure
            const stateToCheck = targetState as string;
            switch (stateToCheck) {
              case "visible":
                // For HTMLElement, check offsetWidth/offsetHeight
                // For SVGElement, we'll use a fallback - check if it's in the DOM and has dimensions
                if (
                  htmlEl.offsetWidth !== undefined &&
                  htmlEl.offsetHeight !== undefined
                ) {
                  return htmlEl.offsetWidth > 0 && htmlEl.offsetHeight > 0;
                }
                // Fallback for SVG or other element types: check if element is in document
                return el.ownerDocument !== null && el.parentNode !== null;
              case "hidden":
                if (
                  htmlEl.offsetWidth !== undefined &&
                  htmlEl.offsetHeight !== undefined
                ) {
                  return htmlEl.offsetWidth === 0 || htmlEl.offsetHeight === 0;
                }
                // Fallback: assume not hidden if in document
                return el.ownerDocument === null || el.parentNode === null;
              case "attached":
                return el.parentNode !== null;
              case "detached":
                return el.parentNode === null;
              default:
                // Default to visible check
                if (
                  htmlEl.offsetWidth !== undefined &&
                  htmlEl.offsetHeight !== undefined
                ) {
                  return htmlEl.offsetWidth > 0 && htmlEl.offsetHeight > 0;
                }
                return el.ownerDocument !== null && el.parentNode !== null;
            }
          })
          .catch(() => false);

        if (isInState) {
          // Element is already in desired state, check for stability
          const initialRect = await element.boundingBox().catch(() => null);
          if (initialRect) {
            // Wait a short moment and check if element is still in same position
            await page.waitForTimeout(BRIEF_POLL_INTERVAL_MS);
            const finalRect = await element.boundingBox().catch(() => null);

            // Consider stable if position hasn't changed significantly
            if (
              finalRect &&
              Math.abs(initialRect.x - finalRect.x) < 1 &&
              Math.abs(initialRect.y - finalRect.y) < 1
            ) {
              return true;
            }
          }
          return true; // If we can't check position but element is in state, proceed
        }

        // Element not in desired state, but don't wait too long
        await element.waitFor({
          state,
          timeout: Math.min(base_timeout * 500, 2000),
        });
        return true;
      } catch {
        // If we can't find the element or it's not in the expected state,
        // proceed anyway after a short delay to avoid hanging
        await page.waitForTimeout(MEDIUM_DELAY_MS);
        return true;
      }
    },
    Math.min(base_timeout, 1.0),
    Math.min(max_timeout, 2.0),
    DYNAMIC_WAIT_MULTIPLIER,
    operation_name
  );
}

/**
 * Wait for dropdown options to populate, with fallback to proceed if no options found
 *
 * @param page - Playwright Page instance
 * @param dropdownSelector - CSS selector for the dropdown
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @returns Promise resolving to true if options appear or if no activity detected
 */
export async function wait_for_dropdown_options(
  page: import("playwright").Page,
  dropdownSelector: string,
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT
): Promise<boolean> {
  return dynamic_wait(
    async () => {
      try {
        // Check for common dropdown option patterns
        const optionSelectors = [
          `${dropdownSelector} [role="option"]`,
          `${dropdownSelector} .dropdown-option`,
          `${dropdownSelector} .option`,
          `${dropdownSelector} li`,
          `${dropdownSelector} [data-value]`,
          '[role="listbox"] [role="option"]', // Fallback to any listbox
          ".dropdown-menu .dropdown-item",
          ".select-options .option",
        ];

        for (const optionSelector of optionSelectors) {
          try {
            const options = page.locator(optionSelector);
            const count = await options.count();
            if (count > 0) {
              // Check if at least one option is visible
              const firstOption = options.first();
              if (await firstOption.isVisible().catch(() => false)) {
                return true;
              }
            }
          } catch {
            continue;
          }
        }

        // If no options found, proceed anyway after a short delay
        // This handles cases where dropdowns don't show options or use different patterns
        await page.waitForTimeout(SHORT_DELAY_MS);
        return true;
      } catch {
        // If there's any error, proceed anyway to avoid hanging
        await page.waitForTimeout(SHORT_DELAY_MS);
        return true;
      }
    },
    Math.min(base_timeout, HALF_TIMEOUT_MULTIPLIER),
    Math.min(max_timeout, 1.0),
    DYNAMIC_WAIT_MULTIPLIER,
    "dropdown options population"
  );
}

/**
 * Wait for form validation state to stabilize, with fallback to proceed if no validation activity
 *
 * @param page - Playwright Page instance
 * @param fieldSelector - CSS selector for the field to check
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @returns Promise resolving to true if validation stabilizes or if no activity detected
 */
export async function wait_for_validation_stability(
  page: import("playwright").Page,
  fieldSelector: string,
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT
): Promise<boolean> {
  return dynamic_wait(
    async () => {
      try {
        // Wait for any validation indicators to appear
        const validationSelectors = [
          `${fieldSelector} + .error`,
          `${fieldSelector} + .validation-error`,
          `${fieldSelector} ~ .error-message`,
          `${fieldSelector} ~ .field-error`,
          `[data-field-error="${fieldSelector}"]`,
          `.error:has-text("${fieldSelector}")`,
        ];

        let hasValidationError = false;

        // Check if validation errors exist
        for (const errorSelector of validationSelectors) {
          try {
            const errorElement = page.locator(errorSelector);
            if (await errorElement.isVisible().catch(() => false)) {
              hasValidationError = true;
              break;
            }
          } catch {
            continue;
          }
        }

        // Wait a moment to see if validation state changes
        await page.waitForTimeout(SHORT_DELAY_MS);

        // Check again to ensure validation is stable
        let stillHasError = false;
        for (const errorSelector of validationSelectors) {
          try {
            const errorElement = page.locator(errorSelector);
            if (await errorElement.isVisible().catch(() => false)) {
              stillHasError = true;
              break;
            }
          } catch {
            continue;
          }
        }

        // Validation is stable if error state hasn't changed
        // If no validation errors were found initially, proceed anyway
        const validationStable = hasValidationError === stillHasError;

        return validationStable || !hasValidationError;
      } catch {
        // If we can't check validation, proceed anyway to avoid hanging
        await page.waitForTimeout(SHORT_DELAY_MS);
        return true;
      }
    },
    Math.min(base_timeout, SHORT_WAIT_TIMEOUT),
    Math.min(max_timeout, SHORT_WAIT_TIMEOUT * 2),
    DYNAMIC_WAIT_MULTIPLIER,
    "validation stability"
  );
}

/**
 * Wait for network activity to complete after form submission
 *
 * @param page - Playwright Page instance
 * @param base_timeout - Initial timeout in seconds
 * @param max_timeout - Maximum total timeout in seconds
 * @returns Promise resolving to true if network becomes idle, false if timeout
 */
export async function wait_for_submission_network_idle(
  page: import("playwright").Page,
  base_timeout = DYNAMIC_WAIT_BASE_TIMEOUT,
  max_timeout = DYNAMIC_WAIT_MAX_TIMEOUT
): Promise<boolean> {
  return dynamic_wait(
    async () => {
      try {
        // Wait for network to be idle
        await page.waitForLoadState("networkidle", {
          timeout: base_timeout * 1000,
        });

        // Additional check for submission-specific indicators
        const submissionIndicators = [
          ".submission-success",
          ".form-success",
          '[data-submission-status="success"]',
          ".confirmation-message",
          ".success-message",
        ];

        // Check if any success indicators are visible
        for (const indicator of submissionIndicators) {
          try {
            const element = page.locator(indicator);
            if (await element.isVisible().catch(() => false)) {
              return true;
            }
          } catch {
            continue;
          }
        }

        return true; // Network idle is sufficient
      } catch {
        return false;
      }
    },
    base_timeout,
    max_timeout,
    DYNAMIC_WAIT_MULTIPLIER,
    "submission network idle"
  );
}

/**
 * Smart wait that proceeds if no DOM activity is detected
 * This prevents the bot from hanging when DOM doesn't respond as expected
 *
 * @param page - Playwright Page instance
 * @param condition_func - Function that returns true when condition is met
 * @param max_wait_time - Maximum time to wait in seconds
 * @param check_interval - How often to check for activity in milliseconds
 * @param operation_name - Name of operation for logging
 * @returns Promise resolving to true if condition met or if no activity detected
 */
export async function smart_wait_or_proceed(
  page: import("playwright").Page,
  condition_func: () => boolean | Promise<boolean>,
  max_wait_time = 1.0,
  check_interval = 100,
  _operation_name = "smart wait"
): Promise<boolean> {
  const startTime = Date.now();
  const maxWaitMs = max_wait_time * 1000;
  let consecutiveNoActivity = 0;
  const maxConsecutiveNoActivity = 3; // Proceed if no activity for 3 consecutive checks

  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Check if condition is met
      const conditionMet = await condition_func();
      if (conditionMet) {
        return true;
      }

      // Check for any DOM activity (element changes, new elements, etc.)
      const hasActivity = await page
        .evaluate(() => {
          // Simple heuristic: check if any elements have changed classes or attributes recently
          const elements = document.querySelectorAll("*");
          let activityDetected = false;

          // Convert NodeList to Array for iteration
          const elementArray = Array.from(elements);
          for (const el of elementArray) {
            // Check for recent changes in common dynamic attributes
            if (
              el.classList.length > 0 ||
              el.getAttribute("style") ||
              el.getAttribute("data-state")
            ) {
              activityDetected = true;
              break;
            }
          }

          return activityDetected;
        })
        .catch(() => false);

      if (hasActivity) {
        consecutiveNoActivity = 0;
      } else {
        consecutiveNoActivity++;

        // If no activity detected for multiple consecutive checks, proceed
        if (consecutiveNoActivity >= maxConsecutiveNoActivity) {
          await page.waitForTimeout(BRIEF_POLL_INTERVAL_MS); // Brief pause before proceeding
          return true; // Proceed anyway
        }
      }

      await page.waitForTimeout(check_interval);
    } catch {
      // If there's any error, proceed anyway to avoid hanging
      await page.waitForTimeout(BRIEF_POLL_INTERVAL_MS);
      return true;
    }
  }

  // Timeout reached, proceed anyway
  return true;
}
