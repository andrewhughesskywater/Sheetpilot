/**
 * Webform session management (contexts + pages).
 *
 * This module is currently **not wired** into `BotOrchestrator`.
 * It exists as a more structured alternative to `WebformFiller`’s direct
 * `contexts[]/pages[]` management.
 *
 * Key ideas:
 * - Create N isolated browser contexts up-front
 * - Apply consistent “stealth” scripts and realistic headers/user-agent
 * - Provide a single place to wait for a form to become interactive
 */
import type { Browser, BrowserContext, Page } from 'playwright';
import * as cfg from '../automation_config';
import { botLogger } from '../../utils/logger';

export type FormConfig = {
  BASE_URL: string;
  FORM_ID: string;
  SUBMISSION_ENDPOINT: string;
  SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: string[];
};

export type BrowserSession = {
  context: BrowserContext;
  page: Page;
};

/**
 * Manages multiple Playwright contexts/pages as discrete “sessions”.
 *
 * Use this when you need parallel or isolated browser state (e.g., multiple logins).
 * The current bot flow typically uses only one session (index 0).
 */
export class WebformSessionManager {
  private sessions: BrowserSession[] = [];
  private defaultSessionIndex = 0;

  constructor(
    private readonly browser: Browser,
    private readonly formConfig: FormConfig,
  ) {}

  async initContexts(count: number = 1): Promise<void> {
    // Create contexts up-front so callers can address them by index.
    for (let i = 0; i < count; i++) {
      const context = await this.browser.newContext({
        viewport: {
          width: cfg.BROWSER_VIEWPORT_WIDTH,
          height: cfg.BROWSER_VIEWPORT_HEIGHT,
        },
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          // These headers aim to mirror a typical interactive browser session.
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
        },
      });

      await this._applyStealthScripts(context);

      const page = await context.newPage();
      this.sessions[i] = { context, page };
    }

    await this.waitForFormReady(); // default session
  }

  getDefaultPage(): Page {
    return this._requireSession(this.defaultSessionIndex).page;
  }

  getSession(index: number): BrowserSession {
    if (index < 0 || index >= this.sessions.length) {
      throw new Error(
        `Invalid session index ${index}. Available: 0-${
          this.sessions.length - 1
        }`,
      );
    }
    return this._requireSession(index);
  }

  async navigateToBase(index?: number): Promise<void> {
    const { page } =
      index !== undefined ? this.getSession(index) : this._requireSession(0);
    await page.goto(this.formConfig.BASE_URL, {
      timeout: cfg.GLOBAL_TIMEOUT * 1000,
    });
  }

  async waitForFormReady(index?: number): Promise<void> {
    const { page } =
      index !== undefined ? this.getSession(index) : this._requireSession(0);

    botLogger.verbose('Waiting for form to be ready', { index });

    await page.waitForLoadState('domcontentloaded');
    await cfg.wait_for_dom_stability(
      page,
      'form',
      'visible',
      cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      cfg.DYNAMIC_WAIT_MAX_TIMEOUT,
      'form readiness',
    );
    await cfg.dynamic_wait_for_network_idle(
      page,
      cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      cfg.DYNAMIC_WAIT_MAX_TIMEOUT,
      'form readiness',
    );

    // Inputs interactive check (your existing code reused)
    await cfg.dynamic_wait(
      async () => {
        const inputs = page.locator('form input, form select, form textarea');
        const count = await inputs.count();
        if (count === 0) return false;
        for (let i = 0; i < Math.min(count, 3); i++) {
          const input = inputs.nth(i);
          if (
            (await input.isVisible().catch(() => false)) &&
            (await input.isEnabled().catch(() => false))
          ) {
            return true;
          }
        }
        return false;
      },
      cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      cfg.DYNAMIC_WAIT_MAX_TIMEOUT,
      cfg.DYNAMIC_WAIT_MULTIPLIER,
      'form inputs ready',
    );

    botLogger.verbose('Form ready', { index });
  }

  async closeAll(): Promise<void> {
    for (const s of this.sessions) {
      await s.context.close().catch((err: unknown) =>
        botLogger.warn('Could not close context', { error: String(err) }),
      );
    }
    this.sessions = [];
  }

  private _requireSession(index: number): BrowserSession {
    const session = this.sessions[index];
    if (!session) {
      throw new Error('No sessions initialized; call initContexts() first');
    }
    return session;
  }

  private async _applyStealthScripts(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = parameters => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({
            state: Notification.permission,
            name: parameters.name,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as PermissionStatus);
        }
        return originalQuery(parameters);
      };
    });
  }
}
