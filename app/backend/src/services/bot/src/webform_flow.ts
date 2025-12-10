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
  /** Playwright BrowserContext instances */
  contexts: BrowserContext[] = [];
  /** Playwright Page instances */
  pages: Page[] = [];
  /** Legacy single context (maintained for backwards compatibility) */
  context: BrowserContext | null = null;
  /** Legacy single page (maintained for backwards compatibility) */
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
    botLogger.info('Starting browser', { 
      browserKind: this.browser_kind, 
      headless: this.headless
    });
    
    await this._launch_browser();
    
    // Create browser context
    for (let i = 0; i < 1; i++) {
      await this._create_context_at_index(i);
      await this._create_page_at_index(i);
    }
    
    // Set legacy single page/context to first one for backwards compatibility
    this.page = this.pages[0] ?? null;
    this.context = this.contexts[0] ?? null;
    
    if (this.page) {
      await cfg.dynamic_wait_for_page_load(this.page);
    }
    
    botLogger.info('Browser started successfully', { contextCount: this.contexts.length });
    timer.done();
  }

  /**
   * Gets the path to the bundled Chromium executable
   * Also sets PLAYWRIGHT_BROWSERS_PATH environment variable so Playwright can find browsers
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
      // In packaged app, browsers are bundled in resources/build/playwright-browsers/ (via extraResources)
      const resourcesPath = process.resourcesPath;
      const browsersBasePath = path.join(resourcesPath, 'build', 'playwright-browsers');
      
      botLogger.verbose('Searching for bundled browsers', { browsersBasePath });

      if (!fs.existsSync(browsersBasePath)) {
        botLogger.warn('Bundled browsers directory not found', { browsersBasePath });
        return undefined;
      }

      // Find chromium directory (e.g., chromium-1194)
      const entries = fs.readdirSync(browsersBasePath);
      const chromiumDir = entries.find(entry => entry.startsWith('chromium-'));

      if (!chromiumDir) {
        botLogger.warn('Chromium directory not found in bundled browsers', { 
          browsersBasePath, 
          foundEntries: entries 
        });
        return undefined;
      }

      botLogger.verbose('Found Chromium directory', { chromiumDir });

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
        // Only set PLAYWRIGHT_BROWSERS_PATH after verifying the executable exists
        // This is the directory containing the chromium-* folders, not the executable itself
        process.env.PLAYWRIGHT_BROWSERS_PATH = browsersBasePath;
        botLogger.verbose('Set PLAYWRIGHT_BROWSERS_PATH', { browsersBasePath });
        botLogger.info('Found bundled Chromium browser', { executablePath });
        return executablePath;
      } else {
        botLogger.warn('Bundled Chromium executable not found', { executablePath });
        // Don't set PLAYWRIGHT_BROWSERS_PATH if executable doesn't exist - let Playwright use default behavior
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
      launchOptions['executablePath'] = bundledBrowserPath;
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
   * Creates a new browser context at specified index with configured settings
   * @private
   * @param index - Index for the context array
   * @returns Promise that resolves when context is created
   */
  private async _create_context_at_index(index: number): Promise<void> {
    const context = await this.browser!.newContext({
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
    await context.addInitScript(() => {
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
    
    this.contexts[index] = context;
  }

  /**
   * Creates a new page at specified index within the browser context
   * @private
   * @param index - Index for the page array
   * @returns Promise that resolves when page is created
   */
  private async _create_page_at_index(index: number): Promise<void> {
    this.pages[index] = await this.contexts[index]!.newPage();
  }
  

  /**
   * Closes the browser and cleans up all resources
   * 
   * Safely closes all contexts and browser, handling any errors gracefully.
   * Resets all instance variables to null/empty after cleanup.
   * 
   * @returns Promise that resolves when cleanup is complete
   */
  async close(): Promise<void> {
    botLogger.verbose('Closing browser', { contextCount: this.contexts.length });
    
    // Close all contexts
    for (let i = 0; i < this.contexts.length; i++) {
      await this.contexts[i]?.close().catch((err) => {
        botLogger.warn('Error closing browser context', { contextIndex: i, error: err?.message });
      });
    }
    
    // Close legacy single context if different from array
    if (this.context && !this.contexts.includes(this.context)) {
      await this.context.close().catch((err) => {
        botLogger.warn('Error closing legacy browser context', { error: err?.message });
      });
    }
    
    // Close browser
    await this.browser?.close().catch((err) => {
      botLogger.warn('Error closing browser', { error: err?.message });
    });
    
    // Reset all state
    this.contexts = [];
    this.pages = [];
    this.context = null;
    this.page = null;
    this.browser = null;
    
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
   * Gets a page instance by context index
   * @param contextIndex - Index of the context to retrieve page from
   * @returns Playwright Page object
   * @throws Error if context index is invalid
   */
  getPage(contextIndex: number): Page {
    // Check if browser has been started at all
    if (this.pages.length === 0) {
      throw new BotNotStartedError('Page is not available; call start() first');
    }
    
    if (contextIndex < 0 || contextIndex >= this.pages.length) {
      throw new Error(`Invalid context index: ${contextIndex}. Available contexts: 0-${this.pages.length - 1}`);
    }
    const page = this.pages[contextIndex];
    if (!page) {
      throw new BotNotStartedError(`Page at index ${contextIndex} is not available; call start() first`);
    }
    return page;
  }
  
  /**
   * Gets a context instance by index
   * @param contextIndex - Index of the context to retrieve
   * @returns Playwright BrowserContext object
   * @throws Error if context index is invalid
   */
  getContext(contextIndex: number): BrowserContext {
    if (contextIndex < 0 || contextIndex >= this.contexts.length) {
      throw new Error(`Invalid context index: ${contextIndex}. Available contexts: 0-${this.contexts.length - 1}`);
    }
    const context = this.contexts[contextIndex];
    if (!context) {
      throw new BotNotStartedError(`Context at index ${contextIndex} is not available; call start() first`);
    }
    return context;
  }

  /**
   * Navigates to the base URL for form interaction
   * @param contextIndex - Optional context index
   * @returns Promise that resolves when navigation is complete
   */
  async navigate_to_base(contextIndex?: number): Promise<void> {
    const page = contextIndex !== undefined ? this.getPage(contextIndex) : this.require_page();
    await page.goto(this.formConfig.BASE_URL, { timeout: cfg.GLOBAL_TIMEOUT * 1000 });
  }

  /**
   * Wait for the form to be ready for interaction
   * @param contextIndex - Optional context index
   */
  async wait_for_form_ready(contextIndex?: number): Promise<void> {
    const page = contextIndex !== undefined ? this.getPage(contextIndex) : this.require_page();
    botLogger.verbose('Waiting for form to be ready', { contextIndex });
    
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
      } catch (error) {
        botLogger.debug('Error checking form inputs ready', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        return false;
      }
    }, cfg.DYNAMIC_WAIT_BASE_TIMEOUT, cfg.DYNAMIC_WAIT_MAX_TIMEOUT, cfg.DYNAMIC_WAIT_MULTIPLIER, 'form inputs ready');
    
    botLogger.verbose('Form is ready for interaction', { contextIndex });
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
   * @param contextIndex - Optional context index
   * @returns Promise that resolves when field is filled
   * @throws Error if field locator is missing or field doesn't become visible
   */
  async inject_field_value(spec: Record<string, unknown>, value: string, contextIndex?: number): Promise<void> {
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
      value: String(value),
      contextIndex
    });

    try {
    const page = contextIndex !== undefined ? this.getPage(contextIndex) : this.require_page();
      botLogger.debug('Locating field element', { locator: locatorSel, contextIndex });
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
        botLogger.debug('Could not retrieve field attributes', { 
          fieldName, 
          error: attrError instanceof Error ? attrError.message : String(attrError) 
        });
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
   * Creates a response handler for monitoring form submission responses
   * @private
   * @param successResponses - Array to collect successful responses
   * @param allResponses - Array to collect all responses
   * @param submissionIds - Array to collect submission IDs
   * @param submissionTokens - Array to collect submission tokens
   * @param requestIds - Array to collect request IDs
   * @returns Response handler function
   */
  private _createSubmissionResponseHandler(
    successResponses: Array<{status: number; url: string; body?: string}>,
    allResponses: Array<{status: number; url: string}>,
    submissionIds: string[],
    submissionTokens: string[],
    requestIds: string[]
  ): (response: import('playwright').Response) => Promise<void> {
    return async (response: import('playwright').Response) => {
      allResponses.push({ status: response.status(), url: response.url() });
      
      // Check if this is a Smartsheet response with success status
      const isSmartsheetDomain = (
        response.url().includes('smartsheet.com') || 
        response.url().includes('smartsheet.')
      );
      
      const isSuccessStatus = (
        cfg.SUBMIT_SUCCESS_MIN_STATUS <= response.status() && 
        response.status() <= cfg.SUBMIT_SUCCESS_MAX_STATUS
      );
      
      // Only process Smartsheet responses with success status codes
      if (isSmartsheetDomain && isSuccessStatus) {
        botLogger.verbose('Received Smartsheet response', { 
          status: response.status(), 
          url: response.url() 
        });
        
        try {
          // Get response content to validate submission success
          const responseText = await response.text();
          botLogger.debug('Response content', { 
            url: response.url(), 
            contentPreview: responseText.substring(0, 200) + '...' 
          });
          
          // Extract additional metadata from response headers
          const responseHeaders = response.headers();
          if ('x-smar-request-id' in responseHeaders) {
            requestIds.push(responseHeaders['x-smar-request-id']);
            botLogger.debug('Found request ID', { requestId: responseHeaders['x-smar-request-id'] });
          }
          
          // Check for successful submission indicators in response content
          if (this._validate_submission_response(responseText)) {
            successResponses.push({ status: response.status(), url: response.url(), body: responseText });
            
            // Extract submission ID and token if present
            try {
              const responseData = JSON.parse(responseText);
              if ('submissionId' in responseData) {
                submissionIds.push(responseData.submissionId);
                botLogger.info('Form submission successful', { 
                  submissionId: responseData.submissionId,
                  url: response.url()
                });
              }
              
              if ('token' in responseData) {
                submissionTokens.push(responseData.token);
                botLogger.debug('Found submission token', { token: responseData.token });
              }
            } catch {
              botLogger.info('Form submission successful (non-JSON response)');
            }
            
            return;
          }
          
          // Fallback: if content validation failed but we got a success status from Smartsheet,
          // still accept it as successful (Smartsheet returned 200-299)
          botLogger.warn('Response content validation failed, but accepting based on HTTP status', { 
            status: response.status(),
            url: response.url(),
            contentPreview: responseText.substring(0, 200) + '...'
          });
          successResponses.push({ status: response.status(), url: response.url() });
          return;
        } catch (contentError) {
          // If we can't even read the response content, still accept based on HTTP status
          botLogger.warn('Could not read response content, accepting based on HTTP status', { 
            error: String(contentError),
            status: response.status(),
            url: response.url()
          });
          successResponses.push({ status: response.status(), url: response.url() });
          return;
        }
      } else {
        botLogger.silly('Ignoring non-Smartsheet or non-success response', { 
          status: response.status(), 
          url: response.url(),
          isSmartsheet: isSmartsheetDomain,
          isSuccess: isSuccessStatus
        });
      }
    };
  }

  /**
   * Finds the submit button on the form
   * @private
   * @param page - Playwright Page instance
   * @returns Promise resolving to the submit button locator, or null if not found
   */
  private async _findSubmitButton(page: import('playwright').Page): Promise<import('playwright').Locator | null> {
    for (const selector of cfg.SUBMIT_BUTTON_FALLBACK_LOCATORS) {
      try {
        const submitButton = page.locator(selector);
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
            return submitButton;
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Checks for DOM-based success indicators
   * @private
   * @param page - Playwright Page instance
   * @returns Promise resolving to true if success indicator found, false otherwise
   */
  private async _checkDomSuccessIndicators(page: import('playwright').Page): Promise<boolean> {
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
          botLogger.info('DOM success indicator found', { selector });
          return true;
        }
      } catch {
        continue;
      }
    }
    
    return false;
  }

  /**
   * Validates submission success and logs details
   * @private
   * @param successResponses - Array of successful HTTP responses
   * @param domSuccessFound - Whether DOM success indicator was found
   * @param submissionIds - Array of submission IDs found
   * @param submissionTokens - Array of submission tokens found
   * @param requestIds - Array of request IDs found
   * @returns True if submission was successful
   */
  private _validateSubmissionSuccess(
    successResponses: Array<{status: number; url: string; body?: string}>,
    domSuccessFound: boolean,
    submissionIds: string[],
    submissionTokens: string[],
    requestIds: string[]
  ): boolean {
    if (successResponses.length > 0 || domSuccessFound) {
      const successDetails: string[] = [];
      
      if (domSuccessFound && successResponses.length === 0) {
        successDetails.push('DOM success indicator detected');
        botLogger.info('Form submission validated via DOM indicator');
      } else {
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
          botLogger.info('Form submission validated via HTTP response', { 
            responseCount: successResponses.length, 
            details: successDetails.join(', ')
          });
        } else {
          botLogger.info('Form submission validated via HTTP response', { 
            responseCount: successResponses.length,
            statusRange: `${cfg.SUBMIT_SUCCESS_MIN_STATUS}-${cfg.SUBMIT_SUCCESS_MAX_STATUS}`
          });
        }
      }
      
      return true;
    }
    return false;
  }

  /**
   * Submits the form and validates the submission response
   * 
   * Sets up response monitoring, finds and clicks the submit button,
   * and validates the submission based on response patterns and content.
   * Includes comprehensive response validation similar to the Python version.
   * 
   * @param contextIndex - Optional context index
   * @returns Promise resolving to true if submission was successful, false otherwise
   */
  async submit_form(contextIndex?: number): Promise<boolean> {
    const timer = botLogger.startTimer('submit-form');
    botLogger.info('Starting form submission', { contextIndex });
    const page = contextIndex !== undefined ? this.getPage(contextIndex) : this.require_page();
    
    // Set up response monitoring with content validation
    const successResponses: Array<{status: number; url: string; body?: string}> = [];
    const allResponses: Array<{status: number; url: string}> = [];
    const submissionIds: string[] = [];
    const submissionTokens: string[] = [];
    const requestIds: string[] = [];

    const handler = this._createSubmissionResponseHandler(
      successResponses,
      allResponses,
      submissionIds,
      submissionTokens,
      requestIds
    );

    page.on('response', handler);
    
    try {
      // Find submit button
      const submitButton = await this._findSubmitButton(page);
      if (!submitButton) {
        throw new Error('No submit button found');
      }
      
      // Click the submit button
      botLogger.verbose('Clicking submit button');
      await submitButton.click();
      botLogger.info('Form submit button clicked');
      
      // Use DOM-based wait for submission verification
      const verifyTimeout = Math.min(cfg.SUBMIT_VERIFY_TIMEOUT_MS / 1000.0, cfg.GLOBAL_TIMEOUT);
      
      // Track if we found DOM success indicators
      let domSuccessFound = false;
      
      // Wait for either HTTP response OR DOM success indicators
      try {
        await cfg.dynamic_wait(async () => {
          // Check for HTTP response success
          if (successResponses.length > 0) {
            botLogger.verbose('HTTP response success detected');
            return true;
          }
          
          // Check for DOM success indicators
          domSuccessFound = await this._checkDomSuccessIndicators(page);
          return domSuccessFound;
        }, cfg.DYNAMIC_WAIT_BASE_TIMEOUT * cfg.HALF_TIMEOUT_MULTIPLIER, verifyTimeout, cfg.DYNAMIC_WAIT_MULTIPLIER, 'form submission verification');
      } catch (waitError) {
        botLogger.warn('Form submission verification wait timed out', { error: String(waitError) });
      }
      
      // Validate submission success
      const isSuccess = this._validateSubmissionSuccess(
        successResponses,
        domSuccessFound,
        submissionIds,
        submissionTokens,
        requestIds
      );
      
      if (isSuccess) {
        timer.done({ success: true, method: domSuccessFound ? 'dom' : 'http' });
        return true;
      } else {
        botLogger.warn('Form submission validation failed: No HTTP responses or DOM indicators found');
        if (allResponses.length > 0) {
          const statusCodes = allResponses.map(r => r.status);
          const urls = allResponses.map(r => r.url);
          botLogger.warn('Received HTTP responses with status codes', { statusCodes, urls });
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
      } catch (cleanupError) {
        botLogger.debug('Error removing response handler during cleanup', { 
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) 
        });
        // Ignore cleanup errors - they're non-critical
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
        cfg.SHORT_WAIT_TIMEOUT, // Max 300ms wait (in seconds)
        cfg.BRIEF_POLL_INTERVAL_MS,  // Check every 50ms (in milliseconds)
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
        cfg.SHORT_WAIT_TIMEOUT, // Max 300ms wait (in seconds)
        cfg.BRIEF_POLL_INTERVAL_MS,  // Check every 50ms (in milliseconds)
        `dropdown close for ${fieldName}`
      );
      
      botLogger.debug('Successfully handled SmartSheets dropdown', { fieldName });
      
    } catch (error) {
      botLogger.warn('Could not handle SmartSheets dropdown', { 
        fieldName, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't raise the exception - let the form filling continue
      // The field might still work even if dropdown navigation fails
    }
  }

  /**
   * Gets validation error selectors to check
   * @private
   * @returns Array of CSS selectors for validation errors
   */
  private _getValidationErrorSelectors(): string[] {
    return [
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
  }

  /**
   * Collects error text from elements matching a selector within a container
   * @private
   * @param container - Locator for the container to search
   * @param selector - CSS selector for error elements
   * @returns Promise resolving to Set of unique error messages
   */
  private async _collectErrorsFromContainer(container: Locator, selector: string): Promise<Set<string>> {
    const errors = new Set<string>();
    try {
      const errorElements = container.locator(selector);
      const count = await errorElements.count();
      
      for (let i = 0; i < count; i++) {
        const errorElement = errorElements.nth(i);
        if (await errorElement.isVisible().catch(() => false)) {
          const errorText = await errorElement.textContent().catch(() => null);
          if (errorText && errorText.trim()) {
            errors.add(errorText.trim());
          }
        }
      }
    } catch {
      // Ignore errors when collecting - continue with other selectors
    }
    return errors;
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
      await cfg.wait_for_validation_stability(page, `#${fieldId}`);
      
      // Look for common validation error patterns
      const errorSelectors = this._getValidationErrorSelectors();
      
      // Use Set to automatically handle deduplication
      const fieldErrorsFound = new Set<string>();
      
      // Check for errors near the field element
      const parentContainer = field.locator('xpath=..');
      
      for (const selector of errorSelectors) {
        // Check parent container for errors
        const parentErrors = await this._collectErrorsFromContainer(parentContainer, selector);
        parentErrors.forEach(error => fieldErrorsFound.add(error));
        
        // Check page for field-related errors
        try {
          const pageErrorElements = page.locator(selector);
          const pageErrorCount = await pageErrorElements.count();
          
          for (let i = 0; i < pageErrorCount; i++) {
            const errorElement = pageErrorElements.nth(i);
            if (await errorElement.isVisible().catch(() => false)) {
              const errorText = await errorElement.textContent().catch(() => null);
              if (errorText && errorText.trim()) {
                // Check if this error is related to our field
                if (this._is_error_related_to_field(errorText.trim(), fieldName)) {
                  fieldErrorsFound.add(errorText.trim());
                }
              }
            }
          }
        } catch (selectorError) {
          botLogger.debug('Error checking page selector', { selector, error: String(selectorError) });
          continue;
        }
      }
      
      // Report any validation errors found
      if (fieldErrorsFound.size > 0) {
        const uniqueErrors = Array.from(fieldErrorsFound);
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
      botLogger.debug('Could not check validation errors for field', { 
        fieldName, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
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