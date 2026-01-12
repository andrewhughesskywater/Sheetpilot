/**
 * Browser launcher utilities for the bot (Playwright + Chromium/Chrome).
 *
 * This file is currently a **standalone helper** (not wired into `WebformFiller`).
 * Keep it as a reusable place for:
 * - consistent browser launch args
 * - logging which executable Playwright actually spawned
 * - redacting user-home paths from logs
 *
 * If you change launch flags here, consider whether you also need the same change in
 * `browser/webform_flow.ts`, which currently launches Chromium directly.
 */
import { chromium, type Browser } from "playwright";
import * as cfg from "../config/automation_config";
import { botLogger } from "@sheetpilot/shared/logger";

type BrowserProcessInfo = {
  spawnfile?: string;
  spawnargs?: string[];
};

type BrowserWithProcess = Browser & {
  process?: () => BrowserProcessInfo | null;
};

function redactUserHomeFromPath(input: string | null): string | null {
  if (!input) return input;

  // These redactions prevent leaking local usernames/paths in logs.
  // Windows: C:\Users\<name>\...
  const win = input.replace(/(\\Users\\)([^\\]+)(\\)/i, "$1<redacted>$3");
  if (win !== input) return win;

  // macOS: /Users/<name>/...
  const mac = input.replace(/(\/Users\/)([^/]+)(\/)/, "$1<redacted>$3");
  if (mac !== input) return mac;

  // Linux: /home/<name>/...
  const linux = input.replace(/(\/home\/)([^/]+)(\/)/, "$1<redacted>$3");
  if (linux !== input) return linux;

  return input;
}

function getSpawnedExecutablePath(browser: Browser): string | null {
  // Playwright’s `Browser` type does not formally expose process info, but the
  // underlying object usually provides `.process()` in Node environments.
  // We only use this for diagnostics/logging.
  const proc = (browser as BrowserWithProcess).process?.();
  if (!proc) return null;

  if (typeof proc.spawnfile === "string" && proc.spawnfile.length > 0) {
    return proc.spawnfile;
  }

  const args = proc.spawnargs;
  if (
    Array.isArray(args) &&
    typeof args[0] === "string" &&
    args[0].length > 0
  ) {
    return args[0];
  }

  return null;
}

export class BrowserLauncher {
  private browser: Browser | null = null;

  constructor(private readonly headless: boolean) {}

  async launch(): Promise<Browser> {
    if (this.browser) return this.browser;

    // Prefer a “real” Chrome channel unless a caller forces something else.
    // This tends to match the user’s installed browser better than bundled Chromium.
    const channel =
      cfg.BROWSER_CHANNEL && cfg.BROWSER_CHANNEL !== "chromium"
        ? cfg.BROWSER_CHANNEL
        : "chrome";

    botLogger.info("Launching browser", { headless: this.headless, channel });

    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        channel,
        args: [
          // These flags aim to reduce resource usage and eliminate UI behaviors that can
          // interfere with deterministic automation (timers/background throttling, etc.).
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-images",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=VizDisplayCompositor",
        ],
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      botLogger.error("Could not launch browser", {
        headless: this.headless,
        channel,
        error: errorMessage,
      });
      throw new Error(`Could not launch browser: ${errorMessage}`);
    }

    const spawnedExecutablePath = getSpawnedExecutablePath(this.browser);
    const playwrightChromiumExecutablePath = chromium.executablePath();

    botLogger.info("Browser launched successfully", {
      headless: this.headless,
      channel,
      spawnedExecutablePath: redactUserHomeFromPath(spawnedExecutablePath),
      playwrightChromiumExecutablePath: redactUserHomeFromPath(
        playwrightChromiumExecutablePath
      ),
      spawnedExecutableMatchesPlaywrightChromium:
        Boolean(spawnedExecutablePath) &&
        spawnedExecutablePath === playwrightChromiumExecutablePath,
    });

    return this.browser;
  }

  async closeAll(): Promise<void> {
    if (!this.browser) return;
    await this.browser.close().catch((err) =>
      botLogger.warn("Could not close browser", {
        error: err instanceof Error ? err.message : String(err),
      })
    );
    this.browser = null;
  }
}
