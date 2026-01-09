/**
 * WebformFiller: Playwright wrapper used by `BotOrchestrator`.
 *
 * This class owns the browser lifecycle and provides low-level primitives:
 * - launch the browser and create contexts/pages
 * - navigate to the base form URL and wait for stability
 * - fill field locators with values
 * - submit the form (simple implementation)
 *
 * ## “Current vs newer building blocks”
 * The bot currently uses `WebformFiller` directly. The package also contains
 * newer, more composable helpers (`WebformSessionManager`, `FormInteractor`,
 * `SubmissionMonitor`), but they are not wired into the orchestrator yet.
 * Prefer changing `WebformFiller` when you want behavior changes today.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as cfg from '../config/automation_config';
import { botLogger } from '../../utils/logger';
import { SubmissionMonitor } from './submission_monitor';

function resolveBrowserChannel(): string {
  if (cfg.BROWSER_CHANNEL && cfg.BROWSER_CHANNEL !== 'chromium') {
    return cfg.BROWSER_CHANNEL;
  }
  return 'chrome';
}

function buildBrowserLaunchArgs(): string[] {
  const baseArgs = [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-blink-features=AutomationControlled'
  ];
  return baseArgs.concat(process.platform === 'win32' ? [] : ['--no-sandbox']);
}

type BrowserProcessInfo = { spawnfile?: string; spawnargs?: string[] };
type BrowserWithProcess = { process?: () => BrowserProcessInfo | null };

function getSpawnedExecutablePath(browser: Browser): string | null {
  const proc = (browser as unknown as BrowserWithProcess).process?.();

  const spawnfile = proc?.spawnfile;
  if (typeof spawnfile === 'string' && spawnfile.length > 0) {
    return spawnfile;
  }

  const args = proc?.spawnargs;
  if (Array.isArray(args) && typeof args[0] === 'string' && args[0].length > 0) {
    return args[0];
  }

  return null;
}

function redactUserHomeFromPath(input: string | null): string | null {
  if (!input) return input;
  const win = input.replace(/(\\Users\\)([^\\]+)(\\)/i, '$1<redacted>$3');
  if (win !== input) return win;
  const mac = input.replace(/(\/Users\/)([^/]+)(\/)/, '$1<redacted>$3');
  if (mac !== input) return mac;
  const linux = input.replace(/(\/home\/)([^/]+)(\/)/, '$1<redacted>$3');
  if (linux !== input) return linux;
  return input;
}

export class BotNotStartedError extends Error {}

export class WebformFiller {
  cfg: typeof cfg;
  headless: boolean;
  browserKind: string;
  browser: Browser | null = null;
  // The bot can run multiple browser contexts (e.g., separate auth contexts),
  // but the current workflow mainly uses index 0.
  contexts: BrowserContext[] = [];
  pages: Page[] = [];
  context: BrowserContext | null = null;
  page: Page | null = null;
  formConfig: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] };

  constructor(
    config: typeof cfg,
    headless: boolean = true,
    browserKind: string = 'chromium',
    formConfig?: { BASE_URL: string; FORM_ID: string; SUBMISSION_ENDPOINT: string; SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[] }
  ) {
    this.cfg = config;
    this.headless = headless;
    this.browserKind = browserKind;
    // Prefer a caller-provided formConfig (quarter routing usually provides it).
    // Falling back to cfg.* keeps legacy callers/tests working, even though some
    // of those constants are marked deprecated in `config/automation_config.ts`.
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

    const timer = botLogger.startTimer('bot-browser-start');
    botLogger.info('Starting WebformFiller browser');
    await this._launchBrowser();

    await this._createContextAtIndex(0);
    await this._createPageAtIndex(0);

    this.page = this.pages[0] ?? null;
    this.context = this.contexts[0] ?? null;

    if (this.page) {
      await cfg.dynamic_wait_for_page_load(this.page);
    }

    botLogger.info('WebformFiller started successfully');
    timer.done({});
  }

  private async _launchBrowser(): Promise<void> {
    // Note: `browser/browser_launcher.ts` contains a standalone launcher helper
    // with richer diagnostics. `WebformFiller` currently launches directly.
    const channel = resolveBrowserChannel();

    botLogger.verbose('Launching Chrome via Playwright', { headless: this.headless, channel });

    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        channel,
        args: buildBrowserLaunchArgs()
      });

      const spawnedExecutablePath = redactUserHomeFromPath(
        this.browser ? getSpawnedExecutablePath(this.browser) : null
      );

      botLogger.info('Chrome launched successfully', {
        headless: this.headless,
        channel,
        spawnedExecutablePath,
      });
    } catch (err) {
      const e = err instanceof Error ? err.message : String(err);
      botLogger.error('Could not launch Chrome', { error: e });
      throw new Error(`Could not launch Chrome: ${e}`);
    }
  }

  private async _createContextAtIndex(index: number): Promise<void> {
    if (!this.browser) throw new BotNotStartedError('Browser not started');

    const context = await this.browser.newContext({
      viewport: {
        width: cfg.BROWSER_VIEWPORT_WIDTH,
        height: cfg.BROWSER_VIEWPORT_HEIGHT
      },
      ignoreHTTPSErrors: false,
      javaScriptEnabled: true
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    this.contexts[index] = context;
  }

  private async _createPageAtIndex(index: number): Promise<void> {
    const context = this.contexts[index];
    if (!context) throw new BotNotStartedError('Context not initialized');
    this.pages[index] = await context.newPage();
  }

  requirePage(): Page {
    if (!this.page) throw new BotNotStartedError('Page is not available');
    return this.page;
  }

  /**
   * Gets the Playwright Page for a specific context index.
   * Some collaborators (e.g., login manager) can operate on non-default contexts.
   */
  getPage(index: number): Page {
    const page = this.pages[index];
    if (!page) {
      throw new BotNotStartedError(`Page is not available for context index ${index}`);
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

  async navigateToBase(): Promise<void> {
    const page = this.requirePage();
    await page.goto(this.formConfig.BASE_URL, {
      timeout: cfg.GLOBAL_TIMEOUT * 1000
    });
  }

  async waitForFormReady(): Promise<void> {
    const page = this.requirePage();
    // This method is called for every row. Keep it fast and deterministic.
    // Treat "form ready" as: required field exists, is visible, and is enabled.
    const projectLocator =
      cfg.FIELD_DEFINITIONS['project_code']?.locator ?? "input[aria-label='Project']";

    await cfg.dynamic_wait({
      condition_func: async () => {
        const loc = page.locator(projectLocator).first();
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) return false;
        const enabled = await loc.isEnabled().catch(() => false);
        return enabled;
      },
      base_timeout: cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      max_timeout: Math.min(cfg.GLOBAL_TIMEOUT, 2),
      multiplier: cfg.DYNAMIC_WAIT_MULTIPLIER,
      operation_name: 'form ready',
    });
  }

  async injectFieldValue(spec: Record<string, unknown>, value: string): Promise<void> {
    const locator = String(spec['locator']);
    const page = this.requirePage();
    const field = page.locator(locator);

    const ok = await cfg.dynamic_wait_for_element(page, locator, 'visible', 1, cfg.GLOBAL_TIMEOUT);
    if (!ok) throw new Error(`Field ${locator} did not become visible`);

    await field.fill(String(value));
  }

  async submitForm(): Promise<boolean> {
    const page = this.requirePage();
    const timer = botLogger.startTimer('submit-form-total');

    try {
      const monitor = new SubmissionMonitor(() => page);
      const ok = await monitor.submitForm();
      if (!ok) {
        timer.done({ success: false, reason: 'monitor returned false' });
        return false;
      }

      // You confirmed: successful submit clears the form.
      // Wait for a "form cleared" signal so the next row can start immediately.
      const projectLocator =
        cfg.FIELD_DEFINITIONS['project_code']?.locator ?? "input[aria-label='Project']";
      const dateLocator =
        cfg.FIELD_DEFINITIONS['date']?.locator ?? "input[placeholder='mm/dd/yyyy']";
      const hoursLocator =
        cfg.FIELD_DEFINITIONS['hours']?.locator ?? "input[aria-label='Hours']";

      const cleared = await cfg.dynamic_wait({
        condition_func: async () => {
          const proj = page.locator(projectLocator).first();
          const date = page.locator(dateLocator).first();
          const hours = page.locator(hoursLocator).first();

          const projVisible = await proj.isVisible().catch(() => false);
          const projEnabled = await proj.isEnabled().catch(() => false);
          if (!projVisible || !projEnabled) return false;

          const projVal = await proj.inputValue().catch(() => null);
          const dateVal = await date.inputValue().catch(() => null);
          const hoursVal = await hours.inputValue().catch(() => null);

          const projEmpty = (projVal ?? '').trim().length === 0;
          const dateEmpty = (dateVal ?? '').trim().length === 0;
          const hoursEmpty = (hoursVal ?? '').trim().length === 0;

          // Project is the strongest signal; date/hours help confirm the clear.
          return projEmpty && (dateEmpty || hoursEmpty);
        },
        base_timeout: cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
        max_timeout: Math.min(cfg.GLOBAL_TIMEOUT, 2),
        multiplier: cfg.DYNAMIC_WAIT_MULTIPLIER,
        operation_name: 'form cleared after submit',
      });

      timer.done({ success: true, cleared });
      return true;
    } catch (err: unknown) {
      botLogger.warn('Could not submit form', { error: String(err) });
      timer.done({ success: false, reason: 'exception' });
      return false;
    }
  }
}
