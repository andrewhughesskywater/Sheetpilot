/**
 * @fileoverview WebformFiller - Browser automation controller
 *
 * This file provides the WebformFiller class used by the BotOrchestrator.
 * It launches the user's Chrome using Playwright, manages contexts/pages,
 * waits for form readiness, injects field values, and submits forms.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as cfg from '../config/automation_config';
import { botLogger } from '../../../../../../shared/logger';

export class BotNotStartedError extends Error {}

export class WebformFiller {
  cfg: typeof cfg;
  headless: boolean;
  browser_kind: string;
  browser: Browser | null = null;
  contexts: BrowserContext[] = [];
  pages: Page[] = [];
  context: BrowserContext | null = null;
  page: Page | null = null;
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };

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

  async start(): Promise<void> {
    if (this.page) {
      botLogger.verbose('Browser already initialized, skipping start');
      return;
    }

    botLogger.info('Starting WebformFiller browser');
    await this._launch_browser();

    await this._create_context_at_index(0);
    await this._create_page_at_index(0);

    this.page = this.pages[0] ?? null;
    this.context = this.contexts[0] ?? null;

    if (this.page) {
      await cfg.dynamic_wait_for_page_load(this.page);
    }

    botLogger.info('WebformFiller started successfully');
  }

  private async _launch_browser(): Promise<void> {
    const channel =
      cfg.BROWSER_CHANNEL && cfg.BROWSER_CHANNEL !== 'chromium'
        ? cfg.BROWSER_CHANNEL
        : 'chrome';

    botLogger.verbose('Launching Chrome via Playwright', { headless: this.headless, channel });

    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        channel,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      botLogger.info('Chrome launched successfully');
    } catch (err) {
      const e = err instanceof Error ? err.message : String(err);
      botLogger.error('Failed to launch Chrome', { error: e });
      throw new Error(`Could not launch Chrome: ${e}`);
    }
  }

  private async _create_context_at_index(index: number): Promise<void> {
    if (!this.browser) throw new BotNotStartedError('Browser not started');

    const context = await this.browser.newContext({
      viewport: {
        width: cfg.BROWSER_VIEWPORT_WIDTH,
        height: cfg.BROWSER_VIEWPORT_HEIGHT
      },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    this.contexts[index] = context;
  }

  private async _create_page_at_index(index: number): Promise<void> {
    const context = this.contexts[index];
    if (!context) throw new BotNotStartedError('Context not initialized');
    this.pages[index] = await context.newPage();
  }

  require_page(): Page {
    if (!this.page) throw new BotNotStartedError('Page not available');
    return this.page;
  }

  /**
   * Gets the Playwright Page for a specific context index.
   * Some collaborators (e.g., login manager) can operate on non-default contexts.
   */
  getPage(index: number): Page {
    const page = this.pages[index];
    if (!page) {
      throw new BotNotStartedError(`Page not available for context index ${index}`);
    }
    return page;
  }

  async close(): Promise<void> {
    botLogger.info('Closing WebformFiller browser');

    for (const ctx of this.contexts) {
      await ctx?.close().catch(() => {});
    }

    await this.browser?.close().catch(() => {});

    this.contexts = [];
    this.pages = [];
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  async navigate_to_base(): Promise<void> {
    const page = this.require_page();
    await page.goto(this.formConfig.BASE_URL, {
      timeout: cfg.GLOBAL_TIMEOUT * 1000
    });
  }

  async wait_for_form_ready(): Promise<void> {
    const page = this.require_page();

    await page.waitForLoadState('domcontentloaded');
    await cfg.dynamic_wait_for_network_idle(page, 2, cfg.GLOBAL_TIMEOUT, 'wait for form ready');
  }

  async inject_field_value(spec: Record<string, unknown>, value: string): Promise<void> {
    const locator = String(spec['locator']);
    const page = this.require_page();
    const field = page.locator(locator);

    const ok = await cfg.dynamic_wait_for_element(page, locator, 'visible', 1, cfg.GLOBAL_TIMEOUT);
    if (!ok) throw new Error(`Field ${locator} did not become visible`);

    await field.fill('');
    await field.fill(String(value));
  }

  async submit_form(): Promise<boolean> {
    const page = this.require_page();
    const button = page.locator('button[type="submit"], input[type="submit"]');

    const ok = await cfg.dynamic_wait_for_element(page, 'button[type="submit"], input[type="submit"]', 'visible', 1, cfg.GLOBAL_TIMEOUT);
    if (!ok) throw new Error('Submit button not found');

    await button.click();

    await page.waitForLoadState('networkidle');
    return true;
  }
}
