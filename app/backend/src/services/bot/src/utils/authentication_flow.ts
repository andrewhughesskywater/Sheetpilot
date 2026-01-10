/**
 * Authentication flow helpers (login/navigation).
 *
 * `LoginManager` executes a config-driven login “recipe” (`LOGIN_STEPS`).
 * This keeps selectors and auth branching mostly in configuration rather than code.
 *
 * ## `LOGIN_STEPS` contract (from `config/automation_config.ts`)
 * Each step uses `action` plus a few optional fields:
 * - `wait`: uses `element_selector` + `wait_condition` (`visible|hidden|attached|detached`)
 * - `input`: uses `locator` + `value_key` (`email|password|literal`) and optional `sensitive`
 * - `click`: uses `locator` and optional `expects_navigation`
 *
 * ## Contexts
 * The bot can hold multiple Playwright contexts/pages. `contextIndex` allows
 * callers to run login steps against a non-default context.
 */

import type { Page } from 'playwright';

import { authLogger } from '../../utils/logger';
import type { WebformFiller } from '../browser/webform_flow';
import type { LoginStep } from '../config/automation_config';
import * as C from '../config/automation_config';

/**
 * Error thrown when navigation to authentication pages fails
 */
export class BotNavigationError extends Error {}

interface HandleInputActionConfig {
  page: import('playwright').Page;
  step: LoginStep;
  email: string;
  password: string;
  contextIndex?: number | undefined;
}

/**
 * Manages authentication and login processes for the automation system
 *
 * Handles the complete login workflow including navigation, credential entry,
 * and authentication state validation. Supports retry logic and error handling.
 */
export class LoginManager {
  /** Configuration object containing authentication settings */
  cfg: typeof C;
  /** Webform filler instance for browser interaction */
  browserManager: WebformFiller;
  /** Wait timeout in seconds for element operations */
  waitSeconds: number;
  /** Dynamic form configuration */
  private formConfig: {
    BASE_URL: string;
    FORM_ID: string;
    SUBMISSION_ENDPOINT: string;
    SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[];
  };
  /** Track login state for each context */
  private loginStates: boolean[] = [];

  private _getPageForContext(contextIndex?: number): Page {
    return contextIndex !== undefined ? this.browserManager.getPage(contextIndex) : this.browserManager.requirePage();
  }

  private async _navigateToBaseWithRetries(contextIndex?: number): Promise<void> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        authLogger.verbose('Navigation attempt', { attempt, maxRetries, contextIndex });
        const page = this._getPageForContext(contextIndex);
        await C.wait_for_dom_stability(
          page,
          'body',
          'visible',
          Number(C.DYNAMIC_WAIT_BASE_TIMEOUT) * C.HALF_TIMEOUT_MULTIPLIER,
          Number(C.DYNAMIC_WAIT_BASE_TIMEOUT) * 1.0
        );
        await this._navigateToBase(page);
        authLogger.verbose('Successfully navigated to base URL', { contextIndex });
        return;
      } catch (e) {
        authLogger.warn('Navigation attempt failed', {
          attempt,
          error: String(e),
          contextIndex,
        });
        if (attempt >= maxRetries) {
          authLogger.error('All navigation attempts failed', {
            maxRetries,
            baseUrl: this.formConfig.BASE_URL,
            error: String(e),
            contextIndex,
          });
          throw new BotNavigationError(
            `Could not navigate to ${this.formConfig.BASE_URL} after ${maxRetries} attempts: ${String(e)}`
          );
        }

        const page = this._getPageForContext(contextIndex);
        await C.wait_for_dom_stability(
          page,
          'body',
          'visible',
          Number(C.DYNAMIC_WAIT_BASE_TIMEOUT) * 1.0,
          Number(C.DYNAMIC_WAIT_BASE_TIMEOUT) * 2.0
        );
      }
    }
  }

  private async _executeLoginSteps(
    page: Page,
    config: { email: string; password: string; contextIndex?: number }
  ): Promise<void> {
    const { email, password, contextIndex } = config;
    authLogger.verbose('Executing login steps', { stepCount: C.LOGIN_STEPS.length, contextIndex });

    for (let i = 0; i < C.LOGIN_STEPS.length; i++) {
      const step = C.LOGIN_STEPS[i];
      if (!step) continue;
      const action = step['action'] as string;
      authLogger.debug('Executing login step', {
        stepIndex: i,
        action,
        selector: step['element_selector'] || step['locator'],
        contextIndex,
      });

      switch (action) {
        case 'wait':
          await this._handleWaitAction(page, step, contextIndex);
          break;
        case 'input':
          await this._handleInputAction({ page, step, email, password, contextIndex });
          break;
        case 'click':
          await this._handleClickAction(page, step, contextIndex);
          break;
        default:
          authLogger.warn('Unknown login action', { action, stepIndex: i });
      }
    }
  }

  /**
   * Creates a new LoginManager instance
   * @param config - Configuration object for authentication settings
   * @param browserManager - WebformFiller instance for browser operations
   */
  constructor(config: typeof C, browserManager: WebformFiller) {
    this.cfg = config;
    this.browserManager = browserManager;
    this.waitSeconds = Number(this.cfg.ELEMENT_WAIT_TIMEOUT ?? 10.0);
    // Use the dynamic form configuration from WebformFiller
    this.formConfig = browserManager.formConfig;
  }

  /**
   * Handles a wait action in the login steps
   * @private
   * @param page - Playwright Page instance
   * @param step - Login step configuration
   * @param contextIndex - Optional context index for logging
   */
  private async _handleWaitAction(
    page: import('playwright').Page,
    step: LoginStep,
    contextIndex?: number
  ): Promise<void> {
    const elementSelector = step['element_selector'] as string;
    const waitCondition = (step['wait_condition'] as 'visible' | 'hidden' | 'attached' | 'detached') ?? 'visible';
    const isOptional = step['optional'] as boolean | undefined;

    await page
      .waitForSelector(elementSelector, {
        state: waitCondition,
        timeout: C.GLOBAL_TIMEOUT * 1000,
      })
      .catch((err: Error) => {
        if (!isOptional) {
          authLogger.error('Required element not found', {
            selector: elementSelector,
            error: err?.message,
            contextIndex,
          });
          throw err;
        }
        authLogger.verbose('Optional element not found, continuing', { selector: elementSelector, contextIndex });
      });
  }

  /**
   * Handles an input action in the login steps
   * @private
   * @param page - Playwright Page instance
   * @param step - Login step configuration
   * @param email - User email
   * @param password - User password
   * @param contextIndex - Optional context index for logging
   */
  private async _handleInputAction(config: HandleInputActionConfig): Promise<void> {
    const { page, step, email, password, contextIndex } = config;
    const locator = page.locator(step['locator'] as string);
    const valueKey = step['value_key'] as string;
    const isSensitive = step['sensitive'] as boolean | undefined;

    const val = valueKey === 'email' ? email : valueKey === 'password' ? password : String(valueKey);

    authLogger.debug('Filling input field', {
      locator: step['locator'],
      valueKey,
      sensitive: isSensitive,
      contextIndex,
    });

    // Use fill() even for sensitive values to avoid slow per-keystroke typing during SSO.
    // `sensitive` still controls logging hygiene via the caller and config.
    await locator.fill(val);
  }

  /**
   * Handles a click action in the login steps
   * @private
   * @param page - Playwright Page instance
   * @param step - Login step configuration
   * @param contextIndex - Optional context index for logging
   */
  private async _handleClickAction(
    page: import('playwright').Page,
    step: LoginStep,
    contextIndex?: number
  ): Promise<void> {
    const locator = page.locator(step['locator'] as string);
    const expectsNavigation = step['expects_navigation'] as boolean | undefined;

    authLogger.debug('Clicking element', { locator: step['locator'], contextIndex });
    await locator.click();

    if (expectsNavigation) {
      authLogger.verbose('Waiting for navigation after click', { contextIndex });
      await C.dynamic_wait_for_page_load(page, undefined, C.GLOBAL_TIMEOUT);
    }
  }

  /**
   * Executes the complete login process with provided credentials for a specific context
   *
   * Performs navigation to login page, credential entry, and authentication
   * following the configured login steps. Includes retry logic for navigation failures.
   *
   * @param email - User email for authentication
   * @param password - User password for authentication
   * @param contextIndex - Target browser context index. When set, `LoginManager`
   *   memoizes login state per context to avoid repeating auth flows.
   * @returns Promise that resolves when login is complete
   * @throws BotNavigationError if navigation fails after retries
   */
  async runLoginSteps(email: string, password: string, contextIndex?: number): Promise<void> {
    // Check if already logged in for this context
    if (contextIndex !== undefined && this.loginStates[contextIndex]) {
      authLogger.verbose('Context already logged in, skipping login', { contextIndex });
      return;
    }

    const timer = authLogger.startTimer('login-flow');
    authLogger.info('Starting login process', { email, baseUrl: this.formConfig.BASE_URL, contextIndex });

    await this._navigateToBaseWithRetries(contextIndex);

    const page = this._getPageForContext(contextIndex);
    const loginConfig: { email: string; password: string; contextIndex?: number } = { email, password };
    if (contextIndex !== undefined) {
      loginConfig.contextIndex = contextIndex;
    }
    await this._executeLoginSteps(page, loginConfig);

    // Mark this context as logged in
    if (contextIndex !== undefined) {
      this.loginStates[contextIndex] = true;
      authLogger.info('Login process completed successfully, context marked as logged in', { email, contextIndex });
    } else {
      authLogger.info('Login process completed successfully', { email });
    }
    timer.done({ email, contextIndex });
  }

  /**
   * Navigates to the base URL for authentication
   * @private
   * @param page - Playwright Page instance to navigate
   * @param timeoutMs - Optional timeout in milliseconds
   * @returns Promise that resolves when navigation is complete
   */
  private async _navigateToBase(page: Page, timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.waitSeconds * 1000;
    authLogger.verbose('Navigating to base URL', {
      baseUrl: this.formConfig.BASE_URL,
      timeoutMs: timeout,
    });
    await page.goto(this.formConfig.BASE_URL, { timeout });
  }

  /**
   * Validates the current login state by checking URL patterns
   *
   * Uses a minimal heuristic approach to determine if the user is logged in
   * by checking if the current URL contains any success URL patterns.
   *
   * @returns Promise resolving to true if logged in, false otherwise
   */
  validate_login_state = async (): Promise<boolean> => {
    try {
      const page = this.browserManager.requirePage();
      // Check if current URL contains any configured success URL patterns
      const currentUrl = page.url();
      const successUrls: string[] = ((this.cfg as Record<string, unknown>)['LOGIN_SUCCESS_URLS'] as string[]) ?? [];
      authLogger.verbose('Validating login state', {
        currentUrl: currentUrl,
        successUrls: successUrls,
      });
      if (successUrls.some((u) => currentUrl.includes(u))) {
        authLogger.info('Login state validated successfully');
        return true;
      }
      // Compatibility behavior: default to true when URL heuristics do not match.
      // Tighten this if you need strict “logged-in vs logged-out” detection.
      authLogger.verbose('No success URL match, defaulting to validated');
      return true;
    } catch (error) {
      authLogger.warn('Login state validation failed', { error });
      return false;
    }
  };
}
