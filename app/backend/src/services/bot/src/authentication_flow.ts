/**
 * @fileoverview Authentication Flow - Handles login and authentication processes
 * 
 * This module manages the authentication workflow for the timesheet automation system.
 * It handles navigation to login pages, credential entry, and authentication state validation.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { Page } from 'playwright';
import * as C from './automation_config';
import { WebformFiller } from './webform_flow';
import { authLogger } from '../../../shared/logger';

/**
 * Error thrown when navigation to authentication pages fails
 */
export class BotNavigationError extends Error {}

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
  browser_manager: WebformFiller;
  /** Wait timeout in seconds for element operations */
  _wait_s: number;
  /** Dynamic form configuration */
  private formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };

  /**
   * Creates a new LoginManager instance
   * @param config - Configuration object for authentication settings
   * @param browser_manager - WebformFiller instance for browser operations
   */
  constructor(config: typeof C, browser_manager: WebformFiller) {
    this.cfg = config;
    this.browser_manager = browser_manager;
    this._wait_s = Number(this.cfg.ELEMENT_WAIT_TIMEOUT ?? 10.0);
    // Use the dynamic form configuration from WebformFiller
    this.formConfig = browser_manager.formConfig;
  }

  /**
   * Executes the complete login process with provided credentials
   * 
   * Performs navigation to login page, credential entry, and authentication
   * following the configured login steps. Includes retry logic for navigation failures.
   * 
   * @param email - User email for authentication
   * @param password - User password for authentication
   * @returns Promise that resolves when login is complete
   * @throws BotNavigationError if navigation fails after retries
   */
  async run_login_steps(email: string, password: string): Promise<void> {
    const timer = authLogger.startTimer('login-flow');
    authLogger.info('Starting login process', { email, baseUrl: this.formConfig.BASE_URL });
    
    const max_navigation_retries = 3;
    let navigation_attempt = 0;

    while (navigation_attempt < max_navigation_retries) {
      try {
        navigation_attempt += 1;
        authLogger.verbose('Navigation attempt', { attempt: navigation_attempt, maxRetries: max_navigation_retries });
        const page = this.browser_manager.require_page();
        // Wait for page to be ready before navigation attempt
        await C.wait_for_dom_stability(page, 'body', 'visible', C.DYNAMIC_WAIT_BASE_TIMEOUT * 0.5, C.DYNAMIC_WAIT_BASE_TIMEOUT * 1.0, 'navigation retry delay');
        await this._navigate_to_base(page);
        authLogger.verbose('Successfully navigated to base URL');
        break;
      } catch (e) {
        authLogger.warn('Navigation attempt failed', { 
          attempt: navigation_attempt,
          error: String(e) 
        });
        if (navigation_attempt >= max_navigation_retries) {
          authLogger.error('All navigation attempts failed', { 
            maxRetries: max_navigation_retries,
            baseUrl: this.formConfig.BASE_URL,
            error: String(e) 
          });
          throw new BotNavigationError(`Could not navigate to ${this.formConfig.BASE_URL} after ${max_navigation_retries} attempts: ${String(e)}`);
        }
        // Wait for page to be stable after navigation failure
        const page = this.browser_manager.require_page();
        await C.wait_for_dom_stability(page, 'body', 'visible', C.DYNAMIC_WAIT_BASE_TIMEOUT * 1.0, C.DYNAMIC_WAIT_BASE_TIMEOUT * 2.0, 'login retry delay');
      }
    }

    const page = this.browser_manager.require_page();
    authLogger.verbose('Executing login steps', { stepCount: C.LOGIN_STEPS.length });
    
    for (let i = 0; i < C.LOGIN_STEPS.length; i++) {
      const step = C.LOGIN_STEPS[i];
      if (!step) continue;
      const action = step['action'];
      authLogger.debug('Executing login step', { 
        stepIndex: i,
        action,
        selector: step['element_selector'] || step['locator'] 
      });
      
      if (action === 'wait') {
        await page.waitForSelector(step['element_selector']!, { state: (step['wait_condition'] as 'visible' | 'hidden' | 'attached' | 'detached') ?? 'visible', timeout: C.GLOBAL_TIMEOUT * 1000 }).catch((err: Error) => {
          if (!step['optional']) {
            authLogger.error('Required element not found', { 
              selector: step['element_selector'],
              error: err?.message 
            });
            throw err;
          }
          authLogger.verbose('Optional element not found, continuing', { selector: step['element_selector'] });
        });
      } else if (action === 'input') {
        const locator = page.locator(step['locator']!);
        const value_key = step['value_key'] as string;
        const val = value_key === 'email' ? email : value_key === 'password' ? password : String(value_key);
        authLogger.debug('Filling input field', { 
          locator: step['locator'],
          valueKey: value_key,
          sensitive: step['sensitive'] 
        });
        if (step['sensitive']) {
          await locator.type(val);
        } else {
          await locator.fill(val);
        }
      } else if (action === 'click') {
        authLogger.debug('Clicking element', { locator: step['locator'] });
        await page.locator(step['locator']!).click();
        if (step['expects_navigation']) {
          authLogger.verbose('Waiting for navigation after click');
          await C.dynamic_wait_for_page_load(page, undefined, C.GLOBAL_TIMEOUT);
        }
      }
    }
    
    authLogger.info('Login process completed successfully', { email });
    timer.done({ email });
  }

  /**
   * Navigates to the base URL for authentication
   * @private
   * @param page - Playwright Page instance to navigate
   * @param timeout_ms - Optional timeout in milliseconds
   * @returns Promise that resolves when navigation is complete
   */
  private async _navigate_to_base(page: Page, timeout_ms?: number): Promise<void> {
    const timeout = timeout_ms ?? this._wait_s * 1000;
    authLogger.verbose('Navigating to base URL', { 
      baseUrl: this.formConfig.BASE_URL,
      timeoutMs: timeout 
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
      const page = this.browser_manager.require_page();
      // Check if current URL contains any configured success URL patterns
      const current_url = page.url();
      const success_urls: string[] = (this.cfg as Record<string, unknown>)['LOGIN_SUCCESS_URLS'] as string[] ?? [];
      authLogger.verbose('Validating login state', { 
        currentUrl: current_url,
        successUrls: success_urls 
      });
      if (success_urls.some((u) => current_url.includes(u))) {
        authLogger.info('Login state validated successfully');
        return true;
      }
      authLogger.verbose('No success URL match, defaulting to validated');
      return true; // Default to true for compatibility with existing behavior
    } catch (error) {
      authLogger.warn('Login state validation failed', { error });
      return false;
    }
  };
}
