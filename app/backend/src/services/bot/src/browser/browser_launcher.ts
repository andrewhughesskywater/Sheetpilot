// browser_launcher.ts
import { chromium, Browser } from 'playwright';
import * as cfg from '.config/automation_config.ts';
import { botLogger } from '@sheetpilot/shared/logger';

export class BrowserLauncher {
  private browser: Browser | null = null;

  constructor(private readonly headless: boolean) {}

  async launch(): Promise<Browser> {
    if (this.browser) return this.browser;

    const channel =
      cfg.BROWSER_CHANNEL && cfg.BROWSER_CHANNEL !== 'chromium'
        ? cfg.BROWSER_CHANNEL
        : 'chrome';

    botLogger.info('Launching browser', { headless: this.headless, channel });

    this.browser = await chromium.launch({
      headless: this.headless,
      channel,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--aggressive-cache-discard',
        '--memory-pressure-off',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    return this.browser;
  }

  async closeAll(): Promise<void> {
    if (!this.browser) return;
    await this.browser.close().catch(err =>
      botLogger.warn('Error closing browser', { error: String(err) }),
    );
    this.browser = null;
  }
}
