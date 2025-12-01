/**
 * @fileoverview Electron Browser Automation - Playwright-like API using Electron BrowserWindow
 * 
 * This module provides browser automation capabilities using Electron's native BrowserWindow
 * instead of Playwright, eliminating the need for external browser dependencies.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { BrowserWindow, WebContents, app } from 'electron';
import { botLogger } from '../../../../../shared/logger';
import * as cfg from './automation_config';

/**
 * Response object for HTTP requests
 */
export interface ElectronResponse {
  status(): number;
  url(): string;
  headers(): Record<string, string>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/**
 * Locator class for element selection and interaction
 */
export class ElectronLocator {
  private page: ElectronPage;
  private selector: string;

  constructor(page: ElectronPage, selector: string) {
    this.page = page;
    this.selector = selector;
  }

  /**
   * Get the nth element in the selection
   */
  nth(index: number): ElectronLocator {
    return new ElectronLocator(this.page, `${this.selector}:nth-of-type(${index + 1})`);
  }

  /**
   * Get the first element
   */
  first(): ElectronLocator {
    return new ElectronLocator(this.page, `${this.selector}:first-of-type`);
  }

  /**
   * Check if element is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.page.executeJavaScript<boolean>(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && 
               window.getComputedStyle(el).visibility !== 'hidden' &&
               window.getComputedStyle(el).display !== 'none';
      })()
    `);
  }

  /**
   * Check if element is enabled
   */
  async isEnabled(): Promise<boolean> {
    return await this.page.executeJavaScript<boolean>(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) return false;
        return !el.disabled && !el.hasAttribute('aria-disabled');
      })()
    `);
  }

  /**
   * Get count of matching elements
   */
  async count(): Promise<number> {
    return await this.page.executeJavaScript<number>(`
      (() => {
        return document.querySelectorAll('${this.selector.replace(/'/g, "\\'")}').length;
      })()
    `);
  }

  /**
   * Fill input field with value
   */
  async fill(value: string): Promise<void> {
    await this.page.executeJavaScript(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) throw new Error('Element not found: ${this.selector.replace(/'/g, "\\'")}');
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
  }

  /**
   * Type text into element (simulates typing)
   */
  async type(text: string): Promise<void> {
    await this.page.executeJavaScript(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) throw new Error('Element not found: ${this.selector.replace(/'/g, "\\'")}');
        el.focus();
        el.value = '';
        ${text.split('').map(char => {
          const key = char === '\n' ? 'Enter' : char;
          return `el.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keypress', { key: ${JSON.stringify(key)}, bubbles: true }));
          el.value += ${JSON.stringify(char)};
          el.dispatchEvent(new KeyboardEvent('keyup', { key: ${JSON.stringify(key)}, bubbles: true }));`;
        }).join('\n        ')}
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
  }

  /**
   * Click element
   */
  async click(): Promise<void> {
    await this.page.executeJavaScript(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) throw new Error('Element not found: ${this.selector.replace(/'/g, "\\'")}');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.click();
      })()
    `);
  }

  /**
   * Press a key
   */
  async press(key: string): Promise<void> {
    await this.page.executeJavaScript(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) throw new Error('Element not found: ${this.selector.replace(/'/g, "\\'")}');
        el.focus();
        const keyEvent = new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true });
        el.dispatchEvent(keyEvent);
        if (key === 'Enter') {
          const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
          el.dispatchEvent(clickEvent);
        }
      })()
    `);
  }

  /**
   * Get attribute value
   */
  async getAttribute(name: string): Promise<string | null> {
    return await this.page.executeJavaScript<string | null>(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) return null;
        return el.getAttribute(${JSON.stringify(name)});
      })()
    `);
  }

  /**
   * Get text content
   */
  async textContent(): Promise<string | null> {
    return await this.page.executeJavaScript<string | null>(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) return null;
        return el.textContent;
      })()
    `);
  }

  /**
   * Evaluate JavaScript in element context
   */
  async evaluate<T>(fn: (el: unknown) => T): Promise<T> {
    const fnString = fn.toString();
    return await this.page.executeJavaScript<T>(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) throw new Error('Element not found: ${this.selector.replace(/'/g, "\\'")}');
        return (${fnString})(el);
      })()
    `);
  }

  /**
   * Wait for element state
   */
  async waitFor(options?: { state?: 'visible' | 'hidden' | 'attached' | 'detached'; timeout?: number }): Promise<void> {
    const state = options?.state || 'visible';
    const timeout = options?.timeout || 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isVisible = await this.isVisible().catch(() => false);
      
      if (state === 'visible' && isVisible) return;
      if (state === 'hidden' && !isVisible) return;
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Element ${this.selector} did not become ${state} within ${timeout}ms`);
  }

  /**
   * Get bounding box
   */
  async boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return await this.page.executeJavaScript<{ x: number; y: number; width: number; height: number } | null>(`
      (() => {
        const el = document.querySelector('${this.selector.replace(/'/g, "\\'")}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()
    `);
  }

  /**
   * Locator with xpath
   */
  locator(selector: string): ElectronLocator {
    return new ElectronLocator(this.page, selector);
  }
}

/**
 * Page class representing a web page
 */
export class ElectronPage {
  private webContents: WebContents;
  private responseHandlers: Array<(response: ElectronResponse) => void> = [];
  private responseCache: Map<string, ElectronResponse> = new Map();

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.setupResponseMonitoring();
  }

  /**
   * Setup response monitoring using webRequest API
   */
  private setupResponseMonitoring(): void {
    const ses = this.webContents.session;
    
    ses.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
      const response: ElectronResponse = {
        status: () => details.statusCode || 200,
        url: () => details.url,
        headers: () => {
          const headers: Record<string, string> = {};
          if (details.responseHeaders) {
            for (const [key, values] of Object.entries(details.responseHeaders)) {
              if (values && values.length > 0 && values[0]) {
                headers[key] = values[0];
              }
            }
          }
          return headers;
        },
        text: async () => {
          // Electron's webRequest API doesn't provide response body directly
          // For most use cases, status code and URL are sufficient for validation
          // If body is needed, it can be fetched separately
          return '';
        },
        json: async () => {
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch {
            return {};
          }
        }
      };
      
      this.responseCache.set(details.url, response);
      
      // Call registered handlers
      for (const handler of this.responseHandlers) {
        try {
          handler(response);
        } catch (error) {
          botLogger.error('Error in response handler', { error: String(error) });
        }
      }
    });
  }

  /**
   * Navigate to URL
   */
  async goto(url: string, options?: { timeout?: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = options?.timeout || 30000;
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Navigation timeout: ${url}`));
        }
      }, timeout);

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.webContents.removeListener('did-finish-load', onLoad);
          this.webContents.removeListener('did-fail-load', onError);
        }
      };

      const onLoad = () => {
        cleanup();
        resolve();
      };

      const onError = (_event: Electron.Event, errorCode: number, errorDescription: string) => {
        cleanup();
        reject(new Error(`Navigation failed: ${errorDescription} (${errorCode})`));
      };

      this.webContents.once('did-finish-load', onLoad);
      this.webContents.once('did-fail-load', onError);
      
      this.webContents.loadURL(url).catch(reject);
    });
  }

  /**
   * Get current URL
   */
  url(): string {
    return this.webContents.getURL();
  }

  /**
   * Create locator for element selection
   */
  locator(selector: string): ElectronLocator {
    return new ElectronLocator(this, selector);
  }

  /**
   * Execute JavaScript in page context
   */
  async executeJavaScript<T>(script: string): Promise<T> {
    return await this.webContents.executeJavaScript(script);
  }

  /**
   * Evaluate a function in page context (Playwright-compatible API)
   */
  async evaluate<T>(fn: () => T | Promise<T>): Promise<T> {
    const fnString = fn.toString();
    return await this.webContents.executeJavaScript(`(${fnString})()`);
  }

  /**
   * Wait for load state
   */
  async waitForLoadState(state?: 'load' | 'domcontentloaded' | 'networkidle', options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout || 30000;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkState = async () => {
        try {
          const readyState = await this.executeJavaScript<string>('document.readyState');
          
          if (state === 'domcontentloaded' && readyState !== 'loading') {
            resolve();
            return;
          }
          
          if (state === 'load' && readyState === 'complete') {
            resolve();
            return;
          }
          
          if (state === 'networkidle') {
            // Simple network idle check - wait for a short period with no navigation
            await new Promise(r => setTimeout(r, 500));
            resolve();
            return;
          }
          
          if (!state && readyState === 'complete') {
            resolve();
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Wait for load state timeout: ${state || 'complete'}`));
            return;
          }
          
          setTimeout(checkState, 100);
        } catch (error) {
          reject(error);
        }
      };
      
      checkState();
    });
  }

  /**
   * Wait for selector
   */
  async waitForSelector(selector: string, options?: { state?: 'visible' | 'hidden' | 'attached' | 'detached'; timeout?: number }): Promise<void> {
    const locator = this.locator(selector);
    await locator.waitFor(options);
  }

  /**
   * Listen to response events
   */
  on(event: 'response', handler: (response: ElectronResponse) => void): void {
    if (event === 'response') {
      this.responseHandlers.push(handler);
    }
  }

  /**
   * Remove response event listener
   */
  off(event: 'response', handler: (response: ElectronResponse) => void): void {
    if (event === 'response') {
      const index = this.responseHandlers.indexOf(handler);
      if (index > -1) {
        this.responseHandlers.splice(index, 1);
      }
    }
  }

  /**
   * Wait for timeout
   */
  async waitForTimeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get webContents
   */
  getWebContents(): WebContents {
    return this.webContents;
  }
}

/**
 * BrowserContext class representing a browser context
 */
export class ElectronBrowserContext {
  private browserWindow: BrowserWindow;
  private page: ElectronPage | null = null;

  constructor(browserWindow: BrowserWindow) {
    this.browserWindow = browserWindow;
  }

  /**
   * Create new page
   */
  async newPage(): Promise<ElectronPage> {
    if (!this.page) {
      this.page = new ElectronPage(this.browserWindow.webContents);
    }
    return this.page;
  }

  /**
   * Add initialization script
   */
  async addInitScript(script: string | (() => void)): Promise<void> {
    const scriptString = typeof script === 'string' ? script : `(${script.toString()})()`;
    this.browserWindow.webContents.executeJavaScript(scriptString);
  }

  /**
   * Close context
   */
  async close(): Promise<void> {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      this.browserWindow.close();
    }
  }

  /**
   * Get browser window
   */
  getBrowserWindow(): BrowserWindow {
    return this.browserWindow;
  }

  /**
   * Clear all browser data (cookies, cache, storage) to ensure fresh login state
   */
  async clearBrowserData(): Promise<void> {
    if (this.browserWindow.isDestroyed()) {
      return;
    }
    
    const session = this.browserWindow.webContents.session;
    
    try {
      // Clear all cookies, storage, and cache
      await session.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'filesystem', 'cachestorage', 'serviceworkers'],
        quotas: ['temporary']
      });
      
      // Also clear cache separately
      await session.clearCache();
      
      botLogger.verbose('Cleared browser data', { 
        cookies: true, 
        storage: true, 
        cache: true 
      });
    } catch (error) {
      botLogger.warn('Could not clear browser data', { error: String(error) });
    }
  }
}

/**
 * Browser class representing the browser instance
 */
export class ElectronBrowser {
  private browserWindows: BrowserWindow[] = [];
  private contexts: ElectronBrowserContext[] = [];

  /**
   * Launch browser with options
   */
  static async launch(_options?: {
    headless?: boolean;
    args?: string[];
    executablePath?: string;
  }): Promise<ElectronBrowser> {
    const browser = new ElectronBrowser();
    
    // BrowserWindow will be created per context
    // We don't create a main window here since contexts create their own
    
    return browser;
  }

  /**
   * Create new browser context
   */
  async newContext(options?: {
    viewport?: { width: number; height: number };
    ignoreHTTPSErrors?: boolean;
    javaScriptEnabled?: boolean;
    userAgent?: string;
    extraHTTPHeaders?: Record<string, string>;
    headless?: boolean;
    disableWebSecurity?: boolean;
  }): Promise<ElectronBrowserContext> {
    // Only disable webSecurity if explicitly requested (for localhost/mock websites)
    // ignoreHTTPSErrors should only affect certificate validation, not webSecurity
    const shouldDisableWebSecurity = options?.disableWebSecurity || false;
    
    const browserWindow = new BrowserWindow({
      width: options?.viewport?.width || cfg.BROWSER_VIEWPORT_WIDTH,
      height: options?.viewport?.height || cfg.BROWSER_VIEWPORT_HEIGHT,
      show: !options?.headless, // Show window if not headless
      backgroundColor: '#ffffff', // Set background color to avoid black flash
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Disable sandbox for compatibility
        webSecurity: !shouldDisableWebSecurity, // Only disable for localhost/mock websites
        allowRunningInsecureContent: shouldDisableWebSecurity, // Only allow insecure content when webSecurity is disabled
        // Performance optimizations
        backgroundThrottling: false, // Disable background throttling for automation
        offscreen: false, // Ensure normal rendering pipeline
        enableWebSQL: false, // Disable deprecated WebSQL for better performance
      }
    });

    // Ensure the window is initialized with a valid page
    // Load about:blank asynchronously without waiting - navigation will happen immediately anyway
    browserWindow.loadURL('about:blank').catch(() => {
      // Ignore errors - about:blank load failures are non-critical
      // Navigation to actual URL will happen immediately after context creation
    });

    // Forward console messages to bot logger
    browserWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const meta = { line, sourceId };
      // Map Electron console levels to logger levels
      // 0: verbose, 1: info, 2: warning, 3: error
      if (level === 0) botLogger.debug(`[Browser Console] ${message}`, meta);
      else if (level === 1) botLogger.info(`[Browser Console] ${message}`, meta);
      else if (level === 2) botLogger.warn(`[Browser Console] ${message}`, meta);
      else if (level === 3) botLogger.error(`[Browser Console] ${message}`, meta);
    });

    // Handle ignoreHTTPSErrors
    if (options?.ignoreHTTPSErrors) {
      const certHandler = (
        event: Electron.Event, 
        webContents: Electron.WebContents, 
        _url: string, 
        _error: string, 
        _certificate: Electron.Certificate, 
        callback: (isTrusted: boolean) => void
      ) => {
        if (webContents.id === browserWindow.webContents.id) {
          event.preventDefault();
          callback(true);
        }
      };
      
      app.on('certificate-error', certHandler);
      
      // Clean up listener when window is closed
      browserWindow.on('closed', () => {
        app.removeListener('certificate-error', certHandler);
      });
    }

    // Set user agent if provided
    if (options?.userAgent) {
      browserWindow.webContents.setUserAgent(options.userAgent);
    }

    // Set extra HTTP headers
    if (options?.extraHTTPHeaders) {
      for (const [key, value] of Object.entries(options.extraHTTPHeaders)) {
        browserWindow.webContents.session.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
          details.requestHeaders[key] = value;
          callback({ requestHeaders: details.requestHeaders });
        });
      }
    }

    // Inject stealth scripts asynchronously to avoid blocking rendering
    // Use 'dom-ready' instead of 'did-finish-load' for earlier injection
    browserWindow.webContents.on('dom-ready', () => {
      // Execute asynchronously to not block page rendering
      setImmediate(() => {
        browserWindow.webContents.executeJavaScript(`
          (() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', { 
              get: () => false 
            });
            
            // Override automation detection properties
            Object.defineProperty(navigator, 'plugins', {
              get: () => [1, 2, 3, 4, 5]
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
                });
              }
              return originalQuery(parameters);
            };
          })()
        `).catch(() => {
          // Silently fail if script injection fails (page may have navigated)
        });
      });
    });

    this.browserWindows.push(browserWindow);
    const context = new ElectronBrowserContext(browserWindow);
    this.contexts.push(context);
    
    return context;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    for (const window of this.browserWindows) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.browserWindows = [];
    this.contexts = [];
  }

  /**
   * Get all contexts
   */
  getContexts(): ElectronBrowserContext[] {
    return this.contexts;
  }
}

/**
 * Launch chromium browser (compatibility function)
 */
export async function chromium(): Promise<{ launch: (options?: {
  headless?: boolean;
  args?: string[];
  executablePath?: string;
}) => Promise<ElectronBrowser> }> {
  return {
    launch: ElectronBrowser.launch
  };
}

