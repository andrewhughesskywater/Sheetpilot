/**
 * @fileoverview Webform Flow - Browser automation and form interaction
 * 
 * This module handles browser lifecycle management, form field interaction,
 * and submission processes for the timesheet automation system.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { chromium, Browser, BrowserContext, Page, Locator } from 'playwright';
import * as cfg from './automation_config';
import { botLogger } from '../../../../../shared/logger';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Error thrown when browser operations are attempted before initialization
 */
export class BotNotStartedError extends Error {}

/**
 * Manages browser automation and form interaction for timesheet submission
 * 
 * Handles browser lifecycle, form field filling, submission detection,
 * and response validation. Uses Chromium browser exclusively.
 */
export class WebformFiller {
  /** Configuration object containing automation settings */
  cfg: typeof cfg;
  /** Whether to run browser in headless mode */
  headless: boolean;
  /** Type of browser to use (chromium only) */
  browser_kind: string;
  /** Playwright Browser instance (null until started) */
  browser: Browser | null = null;
  /** Playwright BrowserContext instance (null until started) */
  context: BrowserContext | null = null;
  /** Playwright Page instance (null until started) */
  page: Page | null = null;
  /** Dynamic form configuration */
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };

  /**
   * Creates a new WebformFiller instance
   * @param config - Configuration object for automation settings
   * @param headless - Whether to run browser in headless mode (default: true)
   * @param browser_kind - Type of browser to use (must be 'chromium')
   * @param formConfig - Optional dynamic form configuration
   */
  constructor(
    config: typeof cfg, 
    headless: boolean = true, 
    browser_kind: string = 'chromium',
    formConfig?: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] }
  ) {
    this.cfg = config;
    this.headless = headless;
    this.browser_kind = browser_kind;
    this.formConfig = formConfig || {
      BASE_URL: cfg.BASE_URL,
      FORM_ID: cfg.FORM_ID,
      SUBMISSION_ENDPOINT: cfg.SUBMISSION_ENDPOINT,
      SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: cfg.SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS
    };
  }

  /**
   * Initializes the browser and creates necessary contexts
   * 
   * Launches the specified browser, creates a context and page,
   * and waits for the page to be ready. Includes reuse guard to prevent
   * multiple initializations.
   * 
   * @returns Promise that resolves when browser is ready
   */
  async start(): Promise<void> {
    if (this.page) {
      botLogger.verbose('Browser already initialized, skipping start');
      return; // Prevent multiple initializations
    }
    const timer = botLogger.startTimer('browser-startup');
    botLogger.info('Starting browser', { browserKind: this.browser_kind, headless: this.headless });
    await this._launch_browser();
    await this._create_context();
    await this._create_page();
    await cfg.dynamic_wait_for_page_load(this.page!);
    botLogger.info('Browser started successfully');
    timer.done();
  }

  /**
   * Gets the path to the bundled Chromium executable
   * @private
   * @returns Path to the Chromium executable or undefined if not found
   */
  private getBundledBrowserPath(): string | undefined {
    // Only use bundled browsers in packaged app
    if (!app.isPackaged) {
      botLogger.verbose('Running in development mode, using system Playwright browsers');
      return undefined;
    }

    try {
      // In packaged app, browsers are bundled in resources/app.asar.unpacked/build/playwright-browsers/
      const resourcesPath = process.resourcesPath;
      const browsersBasePath = path.join(resourcesPath, 'app.asar.unpacked', 'build', 'playwright-browsers');
      
      botLogger.verbose('Searching for bundled browsers', { browsersBasePath });

      if (!fs.existsSync(browsersBasePath)) {
        botLogger.warn('Bundled browsers directory not found', { browsersBasePath });
        return undefined;
      }

      // Find chromium directory (e.g., chromium-1194)
      const entries = fs.readdirSync(browsersBasePath);
      const chromiumDir = entries.find(entry => entry.startsWith('chromium-'));

      if (!chromiumDir) {
        botLogger.warn('Chromium directory not found in bundled browsers', { browsersBasePath });
        return undefined;
      }

      // Construct path to executable based on platform
      let executablePath: string;
      if (process.platform === 'win32') {
        executablePath = path.join(browsersBasePath, chromiumDir, 'chrome-win', 'chrome.exe');
      } else if (process.platform === 'darwin') {
        executablePath = path.join(browsersBasePath, chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
      } else {
        executablePath = path.join(browsersBasePath, chromiumDir, 'chrome-linux', 'chrome');
      }

      if (fs.existsSync(executablePath)) {
        botLogger.info('Found bundled Chromium browser', { executablePath });
        return executablePath;
      } else {
        botLogger.warn('Bundled Chromium executable not found', { executablePath });
        return undefined;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      botLogger.error('Error locating bundled browser', { error: err.message });
      return undefined;
    }
  }

  /**
   * Launches the configured browser type using bundled Chromium
   * Uses Playwright's bundled Chromium browser for consistent behavior across all systems
   * @private
   * @returns Promise that resolves when browser is launched
   * @throws Error if bundled Chromium could not be launched
   */
  private async _launch_browser(): Promise<void> {
    botLogger.verbose('Launching bundled Chromium browser', { browserKind: this.browser_kind });
    
    // Use bundled Chromium for consistent behavior across all systems
    const launchOptions: Record<string, unknown> = {
      headless: this.headless,
      args: [
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript-harmony-shipping',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--aggressive-cache-discard',
        '--memory-pressure-off',
        // Stealth configuration to reduce AV detection
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    };

    // Add bundled browser path if available (production mode)
    const bundledBrowserPath = this.getBundledBrowserPath();
    if (bundledBrowserPath) {
      launchOptions.executablePath = bundledBrowserPath;
      botLogger.verbose('Using bundled browser executable', { executablePath: bundledBrowserPath });
    }

    try {
      botLogger.verbose('Launching bundled Chromium', { headless: this.headless, isPackaged: app.isPackaged });
      // Launch bundled Chromium (no channel parameter = uses Playwright's bundled browser)
      this.browser = await chromium.launch(launchOptions);
      botLogger.info('Successfully launched bundled Chromium browser');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMsg = 'Could not launch bundled Chromium browser';
      botLogger.error(errorMsg, { error: err.message });
      throw new Error(`${errorMsg}: ${err.message}`);
    }
    
    botLogger.verbose('Browser launched successfully');
  }

  /**
   * Creates a new browser context with configured settings
   * @private
   * @returns Promise that resolves when context is created
   */
  private async _create_context(): Promise<void> {
    this.context = await this.browser!.newContext({
      viewport: { width: cfg.BROWSER_VIEWPORT_WIDTH, height: cfg.BROWSER_VIEWPORT_HEIGHT },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      // Stealth configuration to reduce AV detection
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });
    
    // Hide automation flags
    await this.context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', { 
        get: () => false 
      });
      
      // Override automation detection properties
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5] // Fake plugins array
      });
      
      // Override automation detection methods
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({
            state: Notification.permission,
            name: parameters.name,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
          } as PermissionStatus);
        }
        return originalQuery(parameters);
      };
    });
  }

  /**
   * Creates a new page within the browser context
   * @private
   * @returns Promise that resolves when page is created
   */
  private async _create_page(): Promise<void> {
    this.page = await this.context!.newPage();
  }

  /**
   * Closes the browser and cleans up all resources
   * 
   * Safely closes the context and browser, handling any errors gracefully.
   * Resets all instance variables to null after cleanup.
   * 
   * @returns Promise that resolves when cleanup is complete
   */
  async close(): Promise<void> {
    botLogger.verbose('Closing browser');
    await this.context?.close().catch((err) => {
      botLogger.warn('Error closing browser context', { error: err?.message });
    });
    await this.browser?.close().catch((err) => {
      botLogger.warn('Error closing browser', { error: err?.message });
    });
    this.context = null; this.browser = null; this.page = null;
    botLogger.info('Browser closed successfully');
  }

  /**
   * Gets the current page instance, throwing error if not initialized
   * @returns Playwright Page object
   * @throws BotNotStartedError if browser is not started
   */
  require_page(): Page {
    if (!this.page) throw new BotNotStartedError('Page is not available; call start() first');
    return this.page;
  }

  /**
   * Navigates to the base URL for form interaction
   * @returns Promise that resolves when navigation is complete
   */
  async navigate_to_base(): Promise<void> {
    const page = this.require_page();
    await page.goto(this.formConfig.BASE_URL, { timeout: cfg.GLOBAL_TIMEOUT * 1000 });
  }

  /**
   * Wait for the form to be ready for interaction
   */
  async wait_for_form_ready(): Promise<void> {
    const page = this.require_page();
    botLogger.verbose('Waiting for form to be ready');
    
    // Wait for page to be loaded
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for form elements to be visible and stable
    await cfg.wait_for_dom_stability(page, 'form', 'visible', cfg.DYNAMIC_WAIT_BASE_TIMEOUT, cfg.DYNAMIC_WAIT_MAX_TIMEOUT, 'form readiness');
    
    // Wait for network to be idle
    await cfg.dynamic_wait_for_network_idle(page, cfg.DYNAMIC_WAIT_BASE_TIMEOUT, cfg.DYNAMIC_WAIT_MAX_TIMEOUT, 'form readiness');
    
    // Wait for form inputs to be interactive
    await cfg.dynamic_wait(async () => {
      try {
        const inputs = page.locator('form input, form select, form textarea');
        const count = await inputs.count();
        if (count === 0) return false;
        
        // Check if at least one input is enabled and visible
        for (let i = 0; i < Math.min(count, 3); i++) {
          const input = inputs.nth(i);
          const isVisible = await input.isVisible().catch(() => false);
          const isEnabled = await input.isEnabled().catch(() => false);
          if (isVisible && isEnabled) {
            return true;
          }
        }
        return false;
      } catch {
        return false;
      }
    }, cfg.DYNAMIC_WAIT_BASE_TIMEOUT, cfg.DYNAMIC_WAIT_MAX_TIMEOUT, cfg.DYNAMIC_WAIT_MULTIPLIER, 'form inputs ready');
    
    botLogger.verbose('Form is ready for interaction');
  }

  /**
   * Injects a value into a form field using the provided specification
   * 
   * Waits for the field to become visible, clears it, fills it with the value,
   * handles dropdown fields with special keyboard interactions, and validates
   * the field after filling to detect any validation errors.
   * 
   * @param spec - Field specification containing locator and label
   * @param value - Value to inject into the field
   * @returns Promise that resolves when field is filled
   * @throws Error if field locator is missing or field doesn't become visible
   */
  async inject_field_value(spec: Record<string, unknown>, value: string): Promise<void> {
    const fieldName = String(spec?.['label'] ?? 'Unknown Field');
    const locatorSel = spec?.['locator'] as string;
    if (!locatorSel) {
      throw new Error(`Field locator is missing for field: ${fieldName}`);
    }
    const fieldType = spec?.['type'] ?? 'text';
    
    botLogger.verbose('Injecting field value', { 
      fieldName,
      fieldType,
      locator: locatorSel,
      value: String(value)
    });
    
    if (!locatorSel) {
      botLogger.error('No locator specified for field', { fieldName });
      throw new Error(`No locator specified for field '${fieldName}'`);
    }

    try {
    const page = this.require_page();
      botLogger.debug('Locating field element', { locator: locatorSel });
      const field = page.locator(locatorSel);
      
      botLogger.debug('Waiting for field to become visible', { fieldName, timeout: cfg.GLOBAL_TIMEOUT });
    const ok = await cfg.dynamic_wait_for_element(page, locatorSel, 'visible', cfg.DYNAMIC_WAIT_BASE_TIMEOUT, cfg.GLOBAL_TIMEOUT);
    if (!ok) {
      botLogger.error('Field did not become visible', { fieldName, locator: locatorSel });
      throw new Error(`Field '${fieldName}' did not become visible within timeout`);
    }

      // Get field attributes for additional context
      try {
        const fieldId = await field.getAttribute('id') || 'No ID';
        const fieldClass = await field.getAttribute('class') || 'No class';
        const fieldPlaceholder = await field.getAttribute('placeholder') || 'No placeholder';
        botLogger.debug('Field attributes', { 
          fieldName,
          id: fieldId, 
          class: fieldClass, 
          placeholder: fieldPlaceholder 
        });
      } catch (attrError) {
        botLogger.debug('Could not retrieve field attributes', { fieldName, error: attrError });
      }
      
      // Clear and fill the field
      botLogger.debug('Clearing existing content', { fieldName });
    await field.fill('');
      
      botLogger.debug('Entering value into field', { fieldName, value: String(value) });
    await field.fill(String(value));

      // Handle dropdown/combobox fields for SmartSheets
    if (await this._is_dropdown_field(spec, field)) {
        botLogger.info('Handling dropdown field with SmartSheets navigation', { fieldName });
        await this._handle_smartsheets_dropdown(field, fieldName);
      }
      
      botLogger.info('Successfully filled field', { fieldName, value: String(value) });
      
      // Check for validation errors after filling the field (only for critical fields)
      if (['project_code', 'date', 'hours', 'task_description'].includes(fieldName)) {
        await this._check_field_validation_errors(field, fieldName);
      }
      
    } catch (error) {
      botLogger.error('Could not fill form field', { 
        fieldName, 
        value: String(value),
        locator: locatorSel,
        error: String(error)
      });
      throw error;
    }
  }

  /**
   * Submits the form and validates the submission response
   * 
   * Sets up response monitoring, finds and clicks the submit button,
   * and validates the submission based on response patterns and content.
   * Includes comprehensive response validation similar to the Python version.
   * 
   * @returns Promise resolving to true if submission was successful, false otherwise
   */
  async submit_form(): Promise<boolean> {
    const timer = botLogger.startTimer('submit-form');
    botLogger.info('Starting form submission');
    const page = this.require_page();
    
    // Set up response monitoring with content validation
    const successResponses: Array<{status: number; url: string; body?: string}> = [];
    const allResponses: Array<{status: number; url: string}> = [];
    const submissionIds: string[] = [];
    const submissionTokens: string[] = [];
    const requestIds: string[] = [];

    const handler = async (response: import('playwright').Response) => {
      allResponses.push({ status: response.status(), url: response.url() });
      
      // Check if this is the specific Smartsheet form submission response
      const isSubmissionResponse = (
        // Check for the exact submission API endpoint
        response.url().includes('/api/submit/') && 
        response.url().includes('forms.smartsheet.com') &&
        // Check for the specific form ID
        response.url().includes(this.formConfig.FORM_ID)
      );
      
      // Also check for general Smartsheet responses as fallback
      const isGeneralSmartsheetResponse = (
        (response.url().includes('forms.smartsheet.com') || response.url().includes('app.smartsheet.com')) &&
        (cfg.SUBMIT_SUCCESS_MIN_STATUS <= response.status() && response.status() <= cfg.SUBMIT_SUCCESS_MAX_STATUS)
      );
      
      if (isSubmissionResponse || isGeneralSmartsheetResponse) {
        botLogger.verbose('Received potential success response', { status: response.status(), url: response.url() });
        
        try {
          // Get response content to validate submission success
          const responseText = await response.text();
          botLogger.debug('Response content from', { url: response.url(), content: responseText.substring(0, 200) + '...' });
          
          // Extract additional metadata from response headers
          const responseHeaders = response.headers();
          if ('x-smar-request-id' in responseHeaders) {
            requestIds.push(responseHeaders['x-smar-request-id']);
            botLogger.debug('Found request ID', { requestId: responseHeaders['x-smar-request-id'] });
          }
          
          // Check for successful submission indicators
          if (this._validate_submission_response(responseText)) {
            successResponses.push({ status: response.status(), url: response.url(), body: responseText });
            
            // Extract submission ID if present
            try {
              const responseData = JSON.parse(responseText);
              if ('submissionId' in responseData) {
                submissionIds.push(responseData.submissionId);
                botLogger.info('Form submission successful with ID', { submissionId: responseData.submissionId });
              } else {
                botLogger.info('Form submission successful (no submission ID)');
              }
              
              // Extract submission token if present
              if ('token' in responseData) {
                submissionTokens.push(responseData.token);
                botLogger.debug('Found submission token', { token: responseData.token });
              }
            } catch {
              botLogger.info('Form submission successful (non-JSON response)');
            }
            
            botLogger.info('Received HTTP response from', { status: response.status(), url: response.url() });
            return;
          }
        } catch (contentError) {
          botLogger.debug('Could not validate response content', { error: String(contentError) });
        }
        
        // Fallback: if we can't validate content, accept HTTP status
        successResponses.push({ status: response.status(), url: response.url() });
        botLogger.info('Received HTTP response (content validation failed)', { status: response.status(), url: response.url() });
      } else {
        botLogger.debug('Received HTTP response', { status: response.status(), url: response.url() });
      }
    };

    page.on('response', handler);
    
    try {
      // Find submit button
      let submitButton = null;
      for (const selector of cfg.SUBMIT_BUTTON_FALLBACK_LOCATORS) {
        try {
          submitButton = page.locator(selector);
          // Use dynamic wait for submit button visibility
          const ok = await cfg.dynamic_wait_for_element(
            page, 
            selector, 
            'visible', 
            cfg.DYNAMIC_WAIT_BASE_TIMEOUT, 
            cfg.GLOBAL_TIMEOUT, 
            `submit button visibility (${selector})`
          );
          if (ok) {
            const isEnabled = await submitButton.isEnabled();
            if (isEnabled) {
              break;
            }
          }
        } catch {
          continue;
        }
      }
      
      if (!submitButton) {
        throw new Error('No submit button found');
      }
      
      // Submit the form
      botLogger.verbose('Clicking submit button');
      await submitButton.click();
      botLogger.info('Form submit button clicked');
      
      // Use DOM-based wait for submission verification
      const verifyTimeout = Math.min(cfg.SUBMIT_VERIFY_TIMEOUT_MS / 1000.0, cfg.GLOBAL_TIMEOUT);
      
      // Wait for either HTTP response OR DOM success indicators
      await cfg.dynamic_wait(async () => {
        // Check for HTTP response success
        if (successResponses.length > 0) {
          return true;
        }
        
        // Check for DOM success indicators
        const successSelectors = [
          '.submission-success',
          '.form-success',
          '[data-submission-status="success"]',
          '.confirmation-message',
          '.success-message',
          '.alert-success'
        ];
        
        for (const selector of successSelectors) {
          try {
            const element = page.locator(selector);
            if (await element.isVisible().catch(() => false)) {
              return true;
            }
          } catch {
            continue;
          }
        }
        
        return false;
      }, cfg.DYNAMIC_WAIT_BASE_TIMEOUT * 0.5, verifyTimeout, cfg.DYNAMIC_WAIT_MULTIPLIER, 'form submission verification');
      
      // Check for successful submissions
      if (successResponses.length > 0) {
        const successDetails: string[] = [];
        if (submissionIds.length > 0) {
          successDetails.push(`submission IDs: ${submissionIds.join(', ')}`);
        }
        if (submissionTokens.length > 0) {
          successDetails.push(`tokens: ${submissionTokens.join(', ')}`);
        }
        if (requestIds.length > 0) {
          successDetails.push(`request IDs: ${requestIds.join(', ')}`);
        }
        
        if (successDetails.length > 0) {
          botLogger.info('Form submission validated', { 
            responseCount: successResponses.length, 
            details: successDetails.join(', ')
          });
        } else {
          botLogger.info('Form submission validated', { 
            responseCount: successResponses.length,
            statusRange: `${cfg.SUBMIT_SUCCESS_MIN_STATUS}-${cfg.SUBMIT_SUCCESS_MAX_STATUS}`
          });
        }
        timer.done({ success: true });
        return true;
      } else {
        botLogger.warn('Form submission validation failed: No successful responses received');
        if (allResponses.length > 0) {
          const statusCodes = allResponses.map(r => r.status);
          const urls = allResponses.map(r => r.url);
          botLogger.warn('Received responses with status codes', { statusCodes, urls });
        } else {
          botLogger.warn('No HTTP responses received during submission');
        }
        timer.done({ success: false });
        return false;
      }
      
    } catch (error) {
      botLogger.error('Form submission error', { error: String(error) });
      timer.done({ success: false, error: error });
      return false;
    } finally {
      try {
      page.off('response', handler);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Determines if a field is a dropdown based on its label and attributes
   * @private
   * @param spec - Field specification containing label information
   * @param field - Field locator for checking attributes
   * @returns True if field is identified as a dropdown, false otherwise
   */
  private async _is_dropdown_field(spec: Record<string, unknown>, field: Locator): Promise<boolean> {
    // Check field name patterns that are known dropdowns
    const fieldName = String(spec?.['label'] ?? '').toLowerCase();
    const dropdownFields = ['project', 'tool', 'detail charge code'];
    
    if (dropdownFields.some(dropdownField => fieldName.includes(dropdownField))) {
      return true;
    }
    
    // Check HTML attributes that indicate dropdown behavior
    try {
      const role = await field.getAttribute('role');
      if (role && ['combobox', 'listbox'].includes(role)) {
        return true;
      }
      
      // Check for aria-haspopup which indicates dropdown
      const haspopup = await field.getAttribute('aria-haspopup');
      if (haspopup && ['listbox', 'menu', 'true'].includes(haspopup)) {
        return true;
      }
    } catch {
      // If we can't check attributes, assume it's not a dropdown
    }
    
    return false;
  }

  /**
   * Handles SmartSheets dropdown navigation with Down Arrow + Enter
   * @private
   * @param field - Field locator element
   * @param fieldName - Name of the field for logging
   */
  private async _handle_smartsheets_dropdown(field: Locator, fieldName: string): Promise<void> {
    try {
      // Wait for dropdown options to populate after typing (with fallback)
      const dropdownSelector = await field.getAttribute('id') || await field.evaluate((el: { getAttribute: (attr: string) => string | null }) => el.getAttribute('data-testid')) || 'input';
      await cfg.wait_for_dropdown_options(this.require_page(), `#${dropdownSelector}`);
      
      // Press Down Arrow to select the first filtered option
      botLogger.debug('Pressing Down Arrow for dropdown field', { fieldName });
      await field.press('ArrowDown');
      
      // Wait briefly for selection to be highlighted, but proceed if no activity
      await cfg.smart_wait_or_proceed(
        this.require_page(),
        async () => {
          try {
            const selectedOption = this.require_page().locator(`[role="option"][aria-selected="true"]`);
            return await selectedOption.isVisible().catch(() => false);
          } catch {
            return false;
          }
        },
        0.3, // Max 300ms wait
        50,  // Check every 50ms
        `selection highlight for ${fieldName}`
      );
      
      // Press Enter to confirm the selection
      botLogger.debug('Pressing Enter to confirm selection for dropdown field', { fieldName });
      await field.press('Enter');
      
      // Wait briefly for dropdown to close, but proceed if no activity
      await cfg.smart_wait_or_proceed(
        this.require_page(),
        async () => {
          try {
            const options = this.require_page().locator(`[role="option"]`);
            const count = await options.count();
            return count === 0; // Dropdown closed if no options visible
          } catch {
            return true; // Assume closed if we can't check
          }
        },
        0.3, // Max 300ms wait
        50,  // Check every 50ms
        `dropdown close for ${fieldName}`
      );
      
      botLogger.debug('Successfully handled SmartSheets dropdown', { fieldName });
      
    } catch (error) {
      botLogger.warn('Could not handle SmartSheets dropdown', { fieldName, error: String(error) });
      // Don't raise the exception - let the form filling continue
      // The field might still work even if dropdown navigation fails
    }
  }

  /**
   * Checks for validation errors that appear after filling a field
   * @private
   * @param field - Field locator element
   * @param fieldName - Name of the field for logging
   */
  private async _check_field_validation_errors(field: Locator, fieldName: string): Promise<void> {
    try {
      const page = this.require_page();
      
      // Wait briefly for validation state to stabilize, but proceed if no activity
      const fieldId = await field.getAttribute('id') || await field.evaluate((el: { getAttribute: (attr: string) => string | null }) => el.getAttribute('data-testid')) || 'input';
      await cfg.wait_for_validation_stability(this.require_page(), `#${fieldId}`);
      
      // Look for common validation error patterns
      const errorSelectors = [
        '[data-testid*="error"]',      // Test ID based errors
        '[class*="error"]',            // CSS class based errors
        '[class*="invalid"]',          // Invalid state indicators
        '[aria-invalid="true"]',       // ARIA invalid indicators
        '.error-message',              // Generic error message class
        '.validation-error',           // Validation error class
        '.field-error',                // Field error class
        '[role="alert"]',              // ARIA alert role
        '[aria-live="polite"]',        // ARIA live region
        '[aria-live="assertive"]',     // ARIA assertive live region
      ];
      
      // Check for errors near the field element
      const fieldErrorsFound: string[] = [];
      
      for (const selector of errorSelectors) {
        try {
          // Look for errors within the field's parent container
          const parentContainer = field.locator('xpath=..');
          const errorElements = parentContainer.locator(selector);
          
          const count = await errorElements.count();
          if (count > 0) {
            for (let i = 0; i < count; i++) {
              const errorElement = errorElements.nth(i);
              if (await errorElement.isVisible()) {
                const errorText = await errorElement.textContent();
                if (errorText && errorText.trim()) {
                  fieldErrorsFound.push(errorText.trim());
                }
              }
            }
          }
          
          // Also check for errors in the general page area
          const pageErrorElements = page.locator(selector);
          const pageErrorCount = await pageErrorElements.count();
          if (pageErrorCount > 0) {
            for (let i = 0; i < pageErrorCount; i++) {
              const errorElement = pageErrorElements.nth(i);
              if (await errorElement.isVisible()) {
                const errorText = await errorElement.textContent();
                if (errorText && errorText.trim()) {
                  // Check if this error is related to our field
                  if (this._is_error_related_to_field(errorText, fieldName)) {
                    fieldErrorsFound.push(errorText.trim());
                  }
                }
              }
            }
          }
        } catch (selectorError) {
          botLogger.debug('Error checking selector', { selector, error: String(selectorError) });
          continue;
        }
      }
      
      // Report any validation errors found
      if (fieldErrorsFound.length > 0) {
        const uniqueErrors = [...new Set(fieldErrorsFound)]; // Remove duplicates
        botLogger.warn('Validation errors detected for field', { fieldName, errors: uniqueErrors });
        for (const error of uniqueErrors) {
          botLogger.warn('Field validation error', { fieldName, error });
        }
        
        // Raise an exception to stop processing this field/row
        throw new Error(`Field validation failed for '${fieldName}': ${uniqueErrors.join('; ')}`);
      } else {
        botLogger.debug('No validation errors detected for field', { fieldName });
      }
      
    } catch (error) {
      if (String(error).includes('Field validation failed')) {
        // Re-raise validation errors
        throw error;
      }
      botLogger.debug('Could not check validation errors for field', { fieldName, error: String(error) });
      // Don't raise the exception - continue with form filling
      // The field might still work even if error checking fails
    }
  }

  /**
   * Checks if an error message is related to a specific field
   * @private
   * @param errorText - The error message text
   * @param fieldName - The field name to check against
   * @returns True if the error is related to the field, false otherwise
   */
  private _is_error_related_to_field(errorText: string, fieldName: string): boolean {
    if (!errorText || !fieldName) {
      return false;
    }
    
    // Convert field name to common variations
    const fieldVariations = [
      fieldName.toLowerCase(),
      fieldName.replace('_', ' ').toLowerCase(),
      fieldName.replace('_', '').toLowerCase(),
    ];
    
    // Add field-specific mappings for common field names
    const fieldMappings: Record<string, string[]> = {
      'project_code': ['project', 'project code'],
      'task_description': ['task', 'task description', 'description'],
      'detail_code': ['detail', 'detail code', 'charge code'],
      'time_in': ['time in', 'start time'],
      'time_out': ['time out', 'end time'],
    };
    
    // Add mapped variations
    if (fieldName in fieldMappings) {
      const mappedVariations = fieldMappings[fieldName];
      if (mappedVariations) {
        fieldVariations.push(...mappedVariations);
      }
    }
    
    // Check if error text contains field-related keywords
    const errorLower = errorText.toLowerCase();
    
    // Direct field name matches
    for (const variation of fieldVariations) {
      if (errorLower.includes(variation)) {
        return true;
      }
    }
    
    // Check for common field-related error patterns
    const fieldIndicators = [
      'field', 'input', 'value', 'required', 'invalid', 'format',
      'project', 'date', 'time', 'hours', 'tool', 'task', 'description'
    ];
    
    for (const indicator of fieldIndicators) {
      if (errorLower.includes(indicator) && fieldVariations.some(variation => errorLower.includes(variation))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Validates submission response content for success indicators
   * @private
   * @param text - Response text to validate
   * @returns True if response indicates successful submission, false otherwise
   */
  private _validate_submission_response(text: string): boolean {
    try {
      // Try to parse as JSON first
      const data = JSON.parse(text);
      
      // Check for successful submission indicators from response data
      if (typeof data === 'object' && data) {
        // Check for submissionId (primary indicator)
        if ('submissionId' in data) {
          botLogger.debug('Found submissionId in response', { submissionId: data.submissionId });
          return true;
        }
        
        // Check for confirmation object with success indicators
        if (data.confirmation && typeof data.confirmation === 'object') {
          const confirmation = data.confirmation;
          // Check for success message
          if ('message' in confirmation && typeof confirmation.message === 'string') {
            const message = String(confirmation.message).toLowerCase();
            const successIndicators = [
              'success', 'captured', 'submitted', 'received', 'thank you'
            ];
            if (successIndicators.some(indicator => message.includes(indicator))) {
              botLogger.debug('Found success confirmation message', { message: confirmation.message });
              return true;
            }
          }
        }
        
        // Check for token (secondary indicator)
        if ('token' in data) {
          botLogger.debug('Found submission token in response');
          return true;
        }
        
        // If we have submissionId, consider it successful even without confirmation
        if ('submissionId' in data) {
          return true;
        }
      }
    } catch {
      // If not JSON, check for HTML success indicators
      const responseLower = String(text).toLowerCase();
      
      // Look for success indicators in HTML content
      const successIndicators = [
        "success! we've captured your submission",
        "form submitted successfully",
        "thank you for your submission",
        "submission received",
        "success! we've captured",
        "confirmation",
        "submissionid"
      ];
      
      for (const indicator of successIndicators) {
        if (responseLower.includes(indicator)) {
          botLogger.debug('Found HTML success indicator', { indicator });
          return true;
        }
      }
    }
    
    return false;
  }

}