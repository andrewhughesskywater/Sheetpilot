import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  setDbPath,
  ensureSchema,
  getDbPath,
  getDb,
  runMigrations
} from './repositories';
import { APP_VERSION } from '../../shared/constants';

// Logger interface matching the Logger class from shared/logger
interface LoggerInterface {
  error: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  verbose: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
  silly: (message: string, data?: unknown) => void;
  audit: (action: string, message: string, data?: unknown) => void;
  security: (eventType: string, message: string, data?: unknown) => void;
  startTimer: (operation: string) => { done: (metadata?: unknown) => void };
}

// Defer logger import until after preflight; provide lightweight shims for early use
let appLogger: LoggerInterface;
let dbLogger: LoggerInterface;
let initializeLogging: () => void;

// Minimal console-based logger used before real logger loads
function createShimLogger(component: string): LoggerInterface {
  const prefix = `[${component}]`;
  return {
    error: (message: string, data?: unknown) => console.error(prefix, message, data ?? ''),
    warn: (message: string, data?: unknown) => console.warn(prefix, message, data ?? ''),
    info: (message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    verbose: (message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    debug: (message: string, data?: unknown) => console.debug(prefix, message, data ?? ''),
    silly: (message: string, data?: unknown) => console.debug(prefix, message, data ?? ''),
    audit: (_a: string, message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    security: (_e: string, message: string, data?: unknown) => console.warn(prefix, message, data ?? ''),
    startTimer: (_op: string) => ({ done: (_m?: unknown) => void 0 })
  };
}

appLogger = createShimLogger('Application');
dbLogger = createShimLogger('Database');

// Write startup log to file immediately (before app is ready)
// This helps debug silent failures
try {
  const startupLogPath = path.join(process.env['TEMP'] || process.env['TMP'] || process.cwd(), 'sheetpilot-startup.log');
  const startupLog = fs.createWriteStream(startupLogPath, { flags: 'a' });
  startupLog.write(`[${new Date().toISOString()}] Application starting...\n`);
  startupLog.write(`__dirname: ${__dirname}\n`);
  startupLog.write(`process.resourcesPath: ${process.resourcesPath}\n`);
  startupLog.write(`app.isPackaged: ${app.isPackaged}\n`);
  startupLog.write(`process.execPath: ${process.execPath}\n`);
  startupLog.end();
} catch {
  // Ignore startup log errors - this is just for debugging
}

// Electron BrowserWindow uses Electron's built-in Chromium for consistent behavior across all systems
const IS_SMOKE = process.env['SMOKE_PACKAGED'] === '1';
const PACKAGED_LIKE = app.isPackaged || IS_SMOKE;

// Add backend node_modules to module resolution path (dev and packaged-like)
{
  const pathModule = require('path');
  const modulePaths: string[] = [];

  if (PACKAGED_LIKE && !IS_SMOKE) {
    // Packaged paths (ASAR and ASAR unpacked)
    modulePaths.push(
      pathModule.join(process.resourcesPath, 'app.asar', 'app', 'backend', 'node_modules'),
      pathModule.join(process.resourcesPath, 'app.asar.unpacked', 'app', 'backend', 'node_modules')
    );
  } else {
    // Development or smoke path: use project node_modules directly
    modulePaths.push(pathModule.resolve(__dirname, '..', '..', '..', '..', 'app', 'backend', 'node_modules'));
  }

  const currentPath = process.env['NODE_PATH'] || '';
  const combined = [...modulePaths, currentPath].filter(Boolean).join(pathModule.delimiter);
  process.env['NODE_PATH'] = combined;
  require('module').Module._initPaths();
}

import { registerDefaultPlugins } from './middleware/bootstrap-plugins';

// Preflight: verify critical modules resolve before loading heavy subsystems
function preflightResolve(): void {
  const criticalModules = ['electron-log', 'electron-updater', 'better-sqlite3'];
  const failures: Array<{ name: string; error: string }> = [];
  for (const name of criticalModules) {
    try {
      require.resolve(name);
    } catch (err) {
      failures.push({ name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (failures.length > 0) {
    const details = failures.map(f => `${f.name}: ${f.error}`).join(' | ');
    appLogger.error('Preflight module resolution failed', { details, nodePath: process.env['NODE_PATH'], resourcesPath: process.resourcesPath });
    
    // Log to console (will be visible if run from command line)
    console.error('═══════════════════════════════════════════════════════════');
    console.error('FATAL: Application Startup Error');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Preflight module resolution failed:', details);
    console.error('NODE_PATH:', process.env['NODE_PATH']);
    console.error('Resources path:', process.resourcesPath);
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Please reinstall the application.');
    console.error('Press any key to exit...');
    
    // Try to show error dialog after app is ready
    let dialogShown = false;
    app.whenReady().then(() => {
      try {
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Application Startup Error',
          `Could not start application. Missing required dependencies:\n\n${details}\n\nPlease reinstall the application.\n\nCheck the log file in: ${app.getPath('userData')}`
        );
        dialogShown = true;
        // Exit after showing dialog
        setTimeout(() => app.exit(1), 2000);
      } catch (err) {
        console.error('Could not show error dialog:', err);
        app.exit(1);
      }
    }).catch(() => {
      // If whenReady fails, just exit
      app.exit(1);
    });
    
    // Exit after timeout if dialog wasn't shown (prevents hanging)
    setTimeout(() => {
      if (!dialogShown) {
        console.error('App did not become ready, exiting...');
        app.exit(1);
      }
    }, 10000);
  }
}

preflightResolve();

// Now import the real logger after preflight passes
// In test mode, use placeholder loggers that will be mocked
if (process.env['VITEST'] === 'true') {
  const mockLogger = (): LoggerInterface => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    verbose: () => {},
    silly: () => {},
    audit: () => {},
    security: () => {},
    startTimer: () => ({ done: () => {} })
  });
  const mockLoggerModule = {
    initializeLogging: (): void => {},
    appLogger: mockLogger(),
    dbLogger: mockLogger()
  };
  initializeLogging = mockLoggerModule.initializeLogging;
  appLogger = mockLoggerModule.appLogger;
  dbLogger = mockLoggerModule.dbLogger;
} else {
  ({ initializeLogging, appLogger, dbLogger } = require('../../shared/logger'));
}

// Configure Electron - minimal switches for stability
// These must be set before app.whenReady()
// Disable background throttling for automation browser windows
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let mainWindow: BrowserWindow | null = null;

// Window state management
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

function getWindowState(): WindowState {
  const defaultWidth = 1200;
  const defaultHeight = Math.round(defaultWidth * 1.618);
  
  // Fast path: return defaults immediately for quick startup
  // Window state will be restored asynchronously after window is shown
  return {
    width: defaultWidth,
    height: defaultHeight,
    isMaximized: false
  };
}

// Asynchronous window state restoration (called after window is shown)
async function restoreWindowState(window: BrowserWindow): Promise<void> {
  try {
    const userDataPath = app.getPath('userData');
    const windowStatePath = path.join(userDataPath, 'window-state.json');
    
    const data = await fs.promises.readFile(windowStatePath, 'utf8');
    const savedState = JSON.parse(data);
    
    // Validate saved state and ensure it's within screen bounds
    const { width, height, x, y, isMaximized } = savedState;
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    
    // Ensure window is not larger than screen
    const validWidth = Math.min(width || 1200, screenWidth);
    const validHeight = Math.min(height || 1943, screenHeight);
    
    // Ensure window position is within screen bounds
    let validX = x;
    let validY = y;
    
    if (validX !== undefined && validY !== undefined) {
      validX = Math.max(0, Math.min(validX, screenWidth - validWidth));
      validY = Math.max(0, Math.min(validY, screenHeight - validHeight));
    }
    
    // Restore window state
    if (isMaximized) {
      window.maximize();
    } else {
      window.setBounds({ width: validWidth, height: validHeight, x: validX, y: validY });
    }
    
    appLogger.debug('Window state restored', { width: validWidth, height: validHeight, isMaximized });
  } catch (error: unknown) {
    // Window state file doesn't exist or is invalid - keep defaults
    appLogger.debug('Using default window state', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

// Debounced window state save to reduce file I/O (async)
let saveWindowStateTimer: NodeJS.Timeout | null = null;
function saveWindowState() {
  if (!mainWindow) return;
  
  // Clear existing timer
  if (saveWindowStateTimer) {
    clearTimeout(saveWindowStateTimer);
  }
  
  // Debounce: only save after 500ms of no further calls
  saveWindowStateTimer = setTimeout(async () => {
    try {
      const userDataPath = app.getPath('userData');
      const windowStatePath = path.join(userDataPath, 'window-state.json');
      
      const bounds = mainWindow!.getBounds();
      const isMaximized = mainWindow!.isMaximized();
      
      const windowState: WindowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized
      };
      
      // Ensure directory exists (async)
      await fs.promises.mkdir(userDataPath, { recursive: true });
      await fs.promises.writeFile(windowStatePath, JSON.stringify(windowState, null, 2));
      
      appLogger.debug('Window state saved', windowState);
    } catch (error: unknown) {
      appLogger.warn('Could not save window state', { error: error instanceof Error ? error.message : String(error) });
    }
  }, 500);
}

// Global safety nets for unhandled errors
process.on('uncaughtException', (error: Error) => {
  appLogger.error('Uncaught exception detected', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  
  // Always log to console first
  console.error('═══════════════════════════════════════════════════════════');
  console.error('FATAL: Uncaught Exception');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('Message:', error.message);
  console.error('Name:', error.name);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  console.error('═══════════════════════════════════════════════════════════');
  
  // Show error dialog if app is ready
  let dialogShown = false;
  if (app.isReady()) {
    try {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Application Error',
        `An unexpected error occurred:\n\n${error.message}\n\n${error.stack || ''}\n\nThe application will now exit.`
      );
      dialogShown = true;
    } catch (err) {
      console.error('Could not show error dialog:', err);
    }
  }
  
  // Exit after a delay to allow error dialog to be shown
  setTimeout(() => {
    app.exit(1);
  }, dialogShown ? 2000 : 100);
});

process.on('unhandledRejection', (reason: unknown) => {
  appLogger.error('Unhandled promise rejection detected', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});
process.on('rejectionHandled', () => {
  appLogger.warn('Application handled previously unhandled rejection');
});

// Synchronous version for backwards compatibility
function bootstrapDatabase() {
  const timer = dbLogger.startTimer('bootstrap-database');
  const dbFile = path.join(app.getPath('userData'), 'sheetpilot.sqlite');
  dbLogger.verbose('Setting database path', { dbFile });
  setDbPath(dbFile);
  
  // Run migrations before ensuring schema (handles version tracking and backups)
  dbLogger.verbose('Running database migrations if needed');
  const migrationResult = runMigrations(getDb(), getDbPath());
  if (!migrationResult.success) {
    dbLogger.error('Database migration failed', { 
      error: migrationResult.error,
      backupPath: migrationResult.backupPath 
    });
    // Continue anyway - ensureSchema will handle basic table creation
  } else if (migrationResult.migrationsRun > 0) {
    dbLogger.info('Database migrations completed', {
      fromVersion: migrationResult.fromVersion,
      toVersion: migrationResult.toVersion,
      migrationsRun: migrationResult.migrationsRun,
      backupPath: migrationResult.backupPath
    });
  }
  
  dbLogger.verbose('Ensuring database schema exists');
  ensureSchema();
  dbLogger.info('Database initialized successfully', { dbPath: getDbPath() });
  timer.done();
}

function createWindow() {
  const windowState = getWindowState();
  
  // Determine icon path for both dev and production
  // In packaged mode, don't set icon - let Electron use the exe's embedded icon
  // Files inside ASAR cannot be used as native window icons
  const iconPath = PACKAGED_LIKE
    ? undefined
    : path.join(__dirname, '..', '..', '..', '..', 'app', 'frontend', 'src', 'assets', 'images', 'icon.ico');

  // Validate preload script exists
  const preloadPath = path.join(__dirname, 'preload.js');
  if (!fs.existsSync(preloadPath)) {
    const errorMsg = `Preload script not found at: ${preloadPath}\n__dirname: ${__dirname}\nPlease rebuild the application.`;
    appLogger.error('Preload script not found', { preloadPath, __dirname });
    const { dialog } = require('electron');
    dialog.showErrorBox('Application Startup Error', errorMsg);
    app.exit(1);
    return;
  }

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: windowState.width,
    height: windowState.height,
    show: false, // Don't show until ready
    backgroundColor: '#ffffff', // Prevent white flash
    autoHideMenuBar: true, // Hide the menu bar
    icon: iconPath, // Application icon
    webPreferences: {
      preload: preloadPath, // Compiled preload script
      contextIsolation: true,
      nodeIntegration: false,
      // Disable sandbox completely to allow renderer to load content
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  };

  // Only add x and y if they are defined
  if (windowState.x !== undefined) {
    windowOptions.x = windowState.x;
  }
  if (windowState.y !== undefined) {
    windowOptions.y = windowState.y;
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  // Forward renderer console to main logs to debug blank screens
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const data = { line, sourceId };
    switch (level) {
      case 0: appLogger.debug(`[Renderer] ${message}`, data); break; // VERBOSE
      case 1: appLogger.info(`[Renderer] ${message}`, data); break;  // INFO
      case 2: appLogger.warn(`[Renderer] ${message}`, data); break;  // WARNING
      case 3: appLogger.error(`[Renderer] ${message}`, data); break; // ERROR
      default: appLogger.info(`[Renderer] ${message}`, data);
    }
  });

  // In smoke mode, auto-open devtools for visibility
  if (IS_SMOKE) {
    try { mainWindow.webContents.openDevTools({ mode: 'detach' }); } catch { /* no-op */ }
  }

  // Restore maximized state if it was maximized
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Show window IMMEDIATELY when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    appLogger.info('Window ready-to-show event fired');
    if (mainWindow) {
      mainWindow.show();
      appLogger.info('Main window shown', { 
        width: windowState.width, 
        height: windowState.height,
        isVisible: mainWindow.isVisible(),
        isDestroyed: mainWindow.isDestroyed()
      });
      
      // Restore window state asynchronously after window is shown
      restoreWindowState(mainWindow).catch(err => {
        appLogger.debug('Could not restore window state', { error: err.message });
      });
    } else {
      appLogger.error('Main window is null in ready-to-show handler');
    }
  });

  // Add error handling for failed loads
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    appLogger.error('Could not load renderer', { 
      errorCode, 
      errorDescription, 
      validatedURL,
      isMainFrame,
      webContentsId: mainWindow ? mainWindow.webContents.id : 'unknown'
    });
    
    // Show error dialog if main frame failed to load
    if (isMainFrame) {
      try {
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Failed to Load Application',
          `Could not load the application interface:\n\nError ${errorCode}: ${errorDescription}\n\nURL: ${validatedURL}\n\nPlease check the log file for more details.`
        );
      } catch (err) {
        appLogger.error('Could not show error dialog', { error: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  // Add success logging
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      appLogger.info('Renderer loaded successfully', {
        url: mainWindow.webContents.getURL(),
        title: mainWindow.webContents.getTitle()
      });
    } else {
      appLogger.info('Renderer loaded successfully (window already destroyed)');
    }
  });

  // Add logging for renderer process crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    appLogger.error('Renderer process crashed', {
      reason: details.reason,
      exitCode: details.exitCode
    });
    
    try {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Renderer Process Crashed',
        `The application interface crashed:\n\nReason: ${details.reason}\nExit Code: ${details.exitCode}\n\nThe application will now exit.`
      );
      setTimeout(() => app.exit(1), 2000);
    } catch (err) {
      appLogger.error('Could not show error dialog', { error: err instanceof Error ? err.message : String(err) });
      app.exit(1);
    }
  });

  // Add logging for when window is actually shown
  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      appLogger.info('Window show event fired', {
        isVisible: mainWindow.isVisible(),
        isFocused: mainWindow.isFocused()
      });
    }
  });

  // Save window state on resize/move
  mainWindow.on('resize', () => {
    if (!mainWindow?.isMaximized()) {
      saveWindowState();
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow?.isMaximized()) {
      saveWindowState();
    }
  });

  mainWindow.on('maximize', () => {
    saveWindowState();
  });

  mainWindow.on('unmaximize', () => {
    saveWindowState();
  });

  // Save window state before closing
  mainWindow.on('close', () => {
    saveWindowState();
  });

  // Check if we're in development mode by trying to connect to Vite dev server
  const isDev = process.env['NODE_ENV'] === 'development' || process.env['ELECTRON_IS_DEV'] === '1';
  if (isDev) {
    appLogger.verbose('Loading development URL with splash', { url: 'http://localhost:5173#splash' });
    mainWindow.loadURL('http://localhost:5173#splash');
  } else {
    // In production/smoke, load compiled renderer from app/frontend/dist
    // Use a relative path with loadFile() - it resolves relative to app.getAppPath()
    // This is the recommended Electron way: loadFile() handles ASAR archives automatically
    // when given relative paths. In packaged mode, app.getAppPath() points to app.asar,
    // and loadFile() correctly resolves relative paths within the ASAR.
    const htmlPath = 'app/frontend/dist/index.html';
    appLogger.verbose('Using relative path with loadFile for ASAR path resolution', { 
      htmlPath, 
      appPath: app.getAppPath(),
      __dirname,
      resourcesPath: process.resourcesPath,
      isPackaged: app.isPackaged
    });
    
    // Verify file exists using absolute path for checking
    // (loadFile will use the relative path, but we need absolute for fs.existsSync)
    const absoluteHtmlPath = path.join(app.getAppPath(), htmlPath);
    const fileExists = fs.existsSync(absoluteHtmlPath);
    let fileStats: { size?: number; readable?: boolean; error?: string; assetReferences?: string[] } = {};
    if (fileExists) {
      try {
        const stats = fs.statSync(absoluteHtmlPath);
        fileStats.size = stats.size;
        // Try to read first few bytes to verify readability
        try {
          const content = fs.readFileSync(absoluteHtmlPath, { encoding: 'utf8', flag: 'r' });
          fileStats.readable = true;
          // Check if HTML references assets that might not be unpacked
          const assetReferences = content.match(/src="([^"]+)"/g) || [];
          fileStats.assetReferences = assetReferences.slice(0, 5); // First 5 asset refs
        } catch (readErr) {
          fileStats.readable = false;
          fileStats.error = readErr instanceof Error ? readErr.message : String(readErr);
        }
      } catch (statErr) {
        fileStats.error = statErr instanceof Error ? statErr.message : String(statErr);
      }
    }
    
    // Check if unpacked directory exists
    const unpackedDir = PACKAGED_LIKE ? path.join(process.resourcesPath, 'app.asar.unpacked') : null;
    let unpackedDirInfo: { exists?: boolean; contents?: string[] } = {};
    if (unpackedDir && fs.existsSync(unpackedDir)) {
      unpackedDirInfo.exists = true;
      try {
        unpackedDirInfo.contents = fs.readdirSync(unpackedDir);
      } catch {
        unpackedDirInfo.contents = [];
      }
    }
    
    appLogger.verbose('Loading production HTML with splash', { 
      htmlPath,
      absoluteHtmlPath, 
      fileExists,
      fileStats,
      unpackedDir,
      unpackedDirInfo,
      __dirname,
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath
    });
    
    if (!fileExists) {
      const errorMsg = `Frontend HTML file not found at: ${absoluteHtmlPath}\nRelative path: ${htmlPath}\n__dirname: ${__dirname}\nresourcesPath: ${process.resourcesPath}\nisPackaged: ${app.isPackaged}\nUnpacked dir exists: ${unpackedDirInfo.exists}\nPlease rebuild the application.`;
      appLogger.error('Frontend HTML file not found', { 
        htmlPath,
        absoluteHtmlPath, 
        __dirname, 
        resourcesPath: process.resourcesPath,
        isPackaged: app.isPackaged,
        unpackedDirInfo
      });
      const { dialog } = require('electron');
      dialog.showErrorBox('Application Startup Error', errorMsg);
      app.exit(1);
      return;
    }
    
    if (fileStats.readable === false) {
      const errorMsg = `Frontend HTML file exists but cannot be read: ${absoluteHtmlPath}\nError: ${fileStats.error}\nPlease check file permissions.`;
      appLogger.error('Frontend HTML file not readable', { 
        htmlPath,
        absoluteHtmlPath,
        fileStats
      });
      const { dialog } = require('electron');
      dialog.showErrorBox('Application Startup Error', errorMsg);
      app.exit(1);
      return;
    }
    
    // Verify assets directory exists (HTML references JS/CSS files)
    const assetsDir = path.join(path.dirname(absoluteHtmlPath), 'assets');
    const assetsDirExists = fs.existsSync(assetsDir);
    appLogger.verbose('Checking assets directory', { assetsDir, assetsDirExists });
    
    if (!assetsDirExists) {
      appLogger.error('Assets directory not found', { assetsDir, htmlPath });
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Application Startup Error',
        `Frontend assets directory not found at: ${assetsDir}\n\nThe HTML file exists but its assets are missing.\n\nPlease rebuild the application.`
      );
      app.exit(1);
      return;
    }
    
    // Use loadFile with relative path - Electron should handle ASAR automatically
    appLogger.verbose('Loading HTML with loadFile (relative path)', { htmlPath, absoluteHtmlPath, assetsDir });
    
    mainWindow.loadFile(htmlPath).then(() => {
      appLogger.info('loadFile promise resolved successfully');
      // Set hash after file loads to show splash screen
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript('window.location.hash = "splash";').catch((err) => {
            appLogger.debug('Could not set splash hash', { error: err instanceof Error ? err.message : String(err) });
          });
        }
      }, 100);
    }).catch((err) => {
      appLogger.error('loadFile promise rejected', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        htmlPath,
        absoluteHtmlPath,
        appPath: app.getAppPath(),
        assetsDir,
        assetsDirExists,
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath
      });
      
      // Show error dialog
      try {
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Failed to Load Application',
          `Could not load the application interface:\n\nError: ${err instanceof Error ? err.message : String(err)}\n\nRelative Path: ${htmlPath}\n\nAbsolute Path: ${absoluteHtmlPath}\n\nApp Path: ${app.getAppPath()}\n\nAssets dir: ${assetsDir} (exists: ${assetsDirExists})\n\nPlease check the log file for more details.`
        );
      } catch (dialogErr) {
        appLogger.error('Could not show error dialog', { error: dialogErr instanceof Error ? dialogErr.message : String(dialogErr) });
      }
    });
    
    // Add timeout to show window even if ready-to-show doesn't fire
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        appLogger.warn('Window not shown after timeout, forcing show', {
          isVisible: mainWindow.isVisible(),
          readyToShow: false
        });
        mainWindow.show();
      }
    }, 5000);
  }
}

// Initialize app when running as main entry point
// Fix desktop shortcut icon on Windows
function fixDesktopShortcutIcon() {
  if (process.platform !== 'win32' || !PACKAGED_LIKE) {
    return; // Only run on Windows in packaged mode
  }
  
  // In packaged mode, use process.resourcesPath
  const scriptPath = path.join(process.resourcesPath, 'app.asar', 'scripts', 'fix-shortcut-icon.ps1');
  
  // Extract script from ASAR to temp location since PowerShell can't read from ASAR
  const tempDir = app.getPath('temp');
  const tempScriptPath = path.join(tempDir, 'sheetpilot-fix-shortcut.ps1');
  
  try {
    // Read from ASAR and write to temp
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    fs.writeFileSync(tempScriptPath, scriptContent, 'utf8');
  } catch (err) {
    appLogger.debug('Could not extract shortcut fix script', { error: err instanceof Error ? err.message : String(err), scriptPath });
    return;
  }
  
  // Run PowerShell script in background
  const { spawn } = require('child_process');
  const ps = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', tempScriptPath
  ], { 
    detached: true,
    stdio: 'ignore'
  });
  
  ps.unref(); // Don't wait for completion
  appLogger.debug('Started desktop shortcut icon fix', { tempScriptPath });
}


app.whenReady().then(() => {
  // Initialize logging first (fast, non-blocking)
  try {
    initializeLogging();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('═══════════════════════════════════════════════════════════');
    console.error('FATAL: Could not initialize logging');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(errorMsg);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    console.error('═══════════════════════════════════════════════════════════');
    
    try {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Application Startup Error',
        `Could not initialize logging system:\n\n${errorMsg}\n\nThe application will now exit.`
      );
      setTimeout(() => app.exit(1), 2000);
    } catch (dialogErr) {
      console.error('Could not show error dialog:', dialogErr);
      app.exit(1);
    }
    return;
  }
  
  appLogger.info('Application startup initiated', {
    version: APP_VERSION,
    isPackaged: app.isPackaged,
    execPath: app.getPath('exe'),
    userDataPath: app.getPath('userData')
  });
  
  // Ensure Windows taskbar uses our app identity (affects icon/notifications)
  try {
    app.setAppUserModelId('com.sheetpilot.app');
    appLogger.debug('AppUserModelID set', { appId: 'com.sheetpilot.app' });
  } catch (err) {
    appLogger.warn('Could not set AppUserModelID', { error: err instanceof Error ? err.message : String(err) });
  }
  
  // Fix desktop shortcut icon if needed (Windows only)
  appLogger.verbose('Fixing desktop shortcut icon (Windows only)');
  fixDesktopShortcutIcon();
  
  // Register default plugins for the plugin system
  appLogger.verbose('Registering default plugins');
  registerDefaultPlugins();
  appLogger.verbose('Default plugins registered');
  
  // Initialize database (sets correct path and ensures schema exists)
  try {
    bootstrapDatabase();
  } catch (err) {
    appLogger.error('Could not initialize database', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    
    // Show error dialog and exit
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Application Startup Error',
      `Could not initialize database:\n\n${err instanceof Error ? err.message : String(err)}\n\nThe application will now exit.`
    );
    app.exit(1);
    return;
  }
  
  // Register IPC handlers BEFORE creating window (prevents race condition)
  // Handlers must be registered before renderer loads to avoid "No handler registered" errors
  try {
    appLogger.verbose('Loading IPC handlers module', { path: './ipc/index' });
    
    // Diagnostic: Check module resolution paths
    appLogger.verbose('Module resolution environment', {
      nodePath: process.env['NODE_PATH'],
      cwd: process.cwd(),
      resourcesPath: process.resourcesPath,
      isPackaged: app.isPackaged
    });
    
    // Check if critical dependencies are resolvable
    const criticalModules = ['zod'];
    for (const moduleName of criticalModules) {
      try {
        require.resolve(moduleName);
        appLogger.verbose('Critical module is resolvable', { module: moduleName });
      } catch (resolveErr) {
        appLogger.warn('Critical module NOT resolvable', { 
          module: moduleName,
          error: resolveErr instanceof Error ? resolveErr.message : String(resolveErr) 
        });
      }
    }
    
    const { registerAllIPCHandlers } = require('./ipc/index');
    appLogger.verbose('IPC handlers module loaded successfully');
    
    registerAllIPCHandlers(null); // Pass null for now, will set mainWindow reference after window creation
    appLogger.info('All IPC handlers registered successfully');
  } catch (err) {
    // Type guard for Error with requireStack property
    interface ErrorWithRequireStack extends Error {
      requireStack?: string;
    }
    
    const errorData: {
      error: string;
      stack?: string | undefined;
      requireStack?: string | undefined;
    } = {
      error: err instanceof Error ? err.message : String(err)
    };
    
    if (err instanceof Error && err.stack !== undefined) {
      errorData.stack = err.stack;
    }
    
    if (err instanceof Error && 'requireStack' in err) {
      const requireStack = (err as ErrorWithRequireStack).requireStack;
      if (requireStack !== undefined) {
        errorData.requireStack = requireStack;
      }
    }
    
    appLogger.error('Could not register IPC handlers', errorData);
    
    // Show error dialog and exit
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Application Startup Error',
      `Could not register IPC handlers:\n\n${err instanceof Error ? err.message : String(err)}\n\nThe application will now exit.`
    );
    app.exit(1);
    return;
  }
  
  // Create main application window (starts loading renderer immediately)
  appLogger.verbose('Creating main application window');
  createWindow();
  appLogger.verbose('Main window created', { 
    width: mainWindow?.getBounds().width, 
    height: mainWindow?.getBounds().height 
  });
  
  // Update mainWindow reference for timesheet handlers (for progress updates)
  if (mainWindow) {
    try {
      appLogger.verbose('Updating mainWindow reference for IPC handlers');
      const { setMainWindow } = require('./ipc/index');
      setMainWindow(mainWindow);
      appLogger.verbose('MainWindow reference updated successfully');
    } catch (err) {
      appLogger.warn('Could not update mainWindow reference', { 
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  }
}).catch((err: unknown) => {
  // Catch any errors in the whenReady promise chain
  const errorMsg = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;
  
  console.error('═══════════════════════════════════════════════════════════');
  console.error('FATAL: Error during app.whenReady()');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('Message:', errorMsg);
  if (errorStack) {
    console.error('Stack:', errorStack);
  }
  console.error('═══════════════════════════════════════════════════════════');
  
  try {
    const { dialog } = require('electron');
    if (app.isReady()) {
      dialog.showErrorBox(
        'Application Startup Error',
        `An error occurred during application startup:\n\n${errorMsg}\n\n${errorStack || ''}\n\nThe application will now exit.`
      );
      setTimeout(() => app.exit(1), 2000);
    } else {
      app.exit(1);
    }
  } catch (dialogErr) {
    console.error('Could not show error dialog:', dialogErr);
    app.exit(1);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
