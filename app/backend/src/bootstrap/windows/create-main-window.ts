import type { App, BrowserWindow } from 'electron';
import { BrowserWindow as ElectronBrowserWindow } from 'electron';
import type { LoggerLike } from '../logging/logger-contract';
import type { WindowState } from './window-state';
import { resolveCspPolicy, buildCspHeader } from '../security/csp-policy';
import { resolveAppPathsSync, validateIconPathAsync } from '../utils/resolve-app-paths';
import { showErrorDialog } from './show-error-dialog';
import { ConsoleLoggerManager, type ConsoleMessageContext } from './console-logger';

interface CreateMainWindowParams {
  app: App;
  logger: LoggerLike;
  packagedLike: boolean;
  isSmoke: boolean;
  backendDirname: string;
  windowState: WindowState;
  scheduleWindowStateSave: () => void;
  restoreWindowStateAsync: (window: BrowserWindow) => Promise<void>;
}

function setupNavigationControl(window: BrowserWindow, logger: LoggerLike): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    logger.warn('Blocked window.open request', { url });
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const protocol = parsed.protocol;
      const isFile = protocol === 'file:';
      const isDevLocalhost = protocol === 'http:' && parsed.hostname === 'localhost' && parsed.port === '5173';

      if (!isFile && !isDevLocalhost) {
        logger.warn('Blocked navigation attempt', { url });
        event.preventDefault();
      }
    } catch (err: unknown) {
      logger.warn('Could not parse navigation URL', { url, error: err instanceof Error ? err.message : String(err) });
      event.preventDefault();
    }
  });
}

function setupPermissionControl(window: BrowserWindow, logger: LoggerLike): void {
  window.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn('Denied permission request', { permission });
    callback(false);
  });
}

function setupCspHeaders(window: BrowserWindow, cspHeaderValue: string): void {
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeaderValue]
      }
    });
  });
}

function setupConsoleLogging(window: BrowserWindow, consoleLoggerManager: ConsoleLoggerManager, logger: LoggerLike): void {
  const handleConsoleMessage = (data: { level: number; message: string; line: number; sourceId: string }): void => {
    const filter = consoleLoggerManager.getFilter(window.webContents.id);
    const consoleData = data;

    // Skip if dedup filter says this is a duplicate
    if (!filter.filter(consoleData.level, consoleData.message, consoleData.line, consoleData.sourceId)) {
      return;
    }

    // Log the first occurrence
    const context: ConsoleMessageContext = { line: consoleData.line, sourceId: consoleData.sourceId, webContentsId: window.webContents.id };
    const levelName = ConsoleLoggerManager.getLevelName(consoleData.level);
    logger[levelName](`[Renderer] ${consoleData.message}`, context);
  };
  
  window.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    handleConsoleMessage({ level, message, line, sourceId });
  });
}

function setupErrorHandlers(window: BrowserWindow, params: CreateMainWindowParams): void {
  const handleLoadFailure = (data: { errorCode: number; errorDescription: string; validatedURL: string; isMainFrame: boolean }): void => {
    const loadError = data;
    params.logger.error('Could not load renderer', {
      errorCode: loadError.errorCode,
      errorDescription: loadError.errorDescription,
      validatedURL: loadError.validatedURL,
      isMainFrame: loadError.isMainFrame,
      webContentsId: window.webContents.id
    });

    if (loadError.isMainFrame) {
      void showErrorDialog({
        app: params.app,
        logger: params.logger,
        error: new Error(`${loadError.errorCode}: ${loadError.errorDescription}`),
        title: 'Failed to Load Application',
        message: `Could not load the application interface:\n\nError ${loadError.errorCode}: ${loadError.errorDescription}\n\nURL: ${loadError.validatedURL}\n\nPlease check the log file for more details.`,
        exitCode: 1
      });
    }
  };
  
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    handleLoadFailure({ errorCode, errorDescription, validatedURL, isMainFrame });
  });

  window.webContents.on('did-finish-load', () => {
    if (!window.isDestroyed()) {
      params.logger.info('Renderer loaded successfully', {
        url: window.webContents.getURL(),
        title: window.webContents.getTitle()
      });
    } else {
      params.logger.info('Renderer loaded successfully (window already destroyed)');
    }
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    params.logger.error('Renderer process crashed', {
      reason: details.reason,
      exitCode: details.exitCode
    });

    void showErrorDialog({
      app: params.app,
      logger: params.logger,
      error: new Error(`Renderer crash: ${details.reason}`),
      title: 'Renderer Process Crashed',
      message: `The application interface crashed:\n\nReason: ${details.reason}\nExit Code: ${details.exitCode}\n\nThe application will now exit.`,
      exitCode: 1
    });
  });
}

function setupWindowStateHandlers(window: BrowserWindow, params: CreateMainWindowParams, consoleLoggerManager: ConsoleLoggerManager): void {
  window.once('ready-to-show', () => {
    params.logger.info('Window ready-to-show event fired');
    window.show();
    params.logger.info('Main window shown', {
      width: params.windowState.width,
      height: params.windowState.height,
      isVisible: window.isVisible(),
      isDestroyed: window.isDestroyed()
    });

    params.restoreWindowStateAsync(window).catch((err: unknown) => {
      params.logger.debug('Could not restore window state', { error: err instanceof Error ? err.message : String(err) });
    });
  });

  window.on('show', () => {
    if (!window.isDestroyed()) {
      params.logger.info('Window show event fired', {
        isVisible: window.isVisible(),
        isFocused: window.isFocused()
      });
    }
  });

  window.on('resize', () => {
    if (!window.isMaximized()) {
      params.scheduleWindowStateSave();
    }
  });

  window.on('move', () => {
    if (!window.isMaximized()) {
      params.scheduleWindowStateSave();
    }
  });

  window.on('maximize', () => {
    params.scheduleWindowStateSave();
  });

  window.on('unmaximize', () => {
    params.scheduleWindowStateSave();
  });

  window.on('close', () => {
    params.scheduleWindowStateSave();
    // Clean up console logger for this window
    consoleLoggerManager.removeFilter(window.webContents.id);
  });
}

/**
 * Create and configure the main application window.
 *
 * Security: Isolates renderer process with strict web preferences:
 * - Context isolation: true (preload isolated from renderer)
 * - Node integration: disabled
 * - Sandbox: enabled
 * - Web security: enabled
 *
 * CSP: Injected via response headers for defense-in-depth.
 * Navigation: Restricted to file:// (local assets) and localhost:5173 (dev only).
 * Permissions: All denied (camera, mic, etc).
 *
 * Console logging: Deduplicated per-window to prevent log spam.
 * Error handling: Captured in Sentry and shown to user with 2s timeout.
 */
export function createMainWindow(params: CreateMainWindowParams): BrowserWindow | null {
  // Resolve critical paths (preload) and optional paths (icon)
  let preloadPath: string;
  let iconPath: string | undefined;

  try {
    const paths = resolveAppPathsSync(params.backendDirname, params.packagedLike);
    preloadPath = paths.preloadPath;
    iconPath = paths.iconPath;
  } catch (err: unknown) {
    void showErrorDialog({
      app: params.app,
      logger: params.logger,
      error: err,
      title: 'Application Startup Error',
      message: `${err instanceof Error ? err.message : String(err)}\n\nPlease rebuild the application.`,
      exitCode: 1
    });
    return null;
  }

  // Asynchronously validate icon (non-critical, deferred)
  void validateIconPathAsync(iconPath, params.logger);

  // Resolve CSP policy
  const cspPolicy = resolveCspPolicy(!params.packagedLike);
  const cspHeaderValue = buildCspHeader(cspPolicy);

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: params.windowState.width,
    height: params.windowState.height,
    show: false,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  };

  if (params.windowState.x !== undefined) {
    windowOptions.x = params.windowState.x;
  }
  if (params.windowState.y !== undefined) {
    windowOptions.y = params.windowState.y;
  }

  const window = new ElectronBrowserWindow(windowOptions);
  const consoleLoggerManager = new ConsoleLoggerManager(params.logger);

  // Setup security handlers
  setupNavigationControl(window, params.logger);
  setupPermissionControl(window, params.logger);
  setupCspHeaders(window, cspHeaderValue);
  setupConsoleLogging(window, consoleLoggerManager, params.logger);
  setupErrorHandlers(window, params);

  if (params.isSmoke) {
    try {
      window.webContents.openDevTools({ mode: 'detach' });
    } catch {
      // no-op
    }
  }

  if (params.windowState.isMaximized) {
    window.maximize();
  }

  setupWindowStateHandlers(window, params, consoleLoggerManager);

  return window;
}


