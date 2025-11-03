import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  setDbPath,
  ensureSchema,
  getDbPath,
  storeCredentials,
  getCredentials,
  listCredentials,
  deleteCredentials,
  getDb,
  createSession,
  validateSession,
  clearSession,
  clearUserSessions,
  clearAllCredentials,
  rebuildDatabase
} from './services/database';
import { submitTimesheets } from './services/timesheet_importer';
// Defer logger import until after preflight; provide lightweight shims for early use
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appLogger: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbLogger: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ipcLogger: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initializeLogging: any;

// Minimal console-based logger used before real logger loads
function createShimLogger(component: string) {
  const prefix = `[${component}]`;
  return {
    error: (message: string, data?: unknown) => console.error(prefix, message, data ?? ''),
    warn: (message: string, data?: unknown) => console.warn(prefix, message, data ?? ''),
    info: (message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    verbose: (message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    debug: (message: string, data?: unknown) => console.debug(prefix, message, data ?? ''),
    audit: (_a: string, message: string, data?: unknown) => console.log(prefix, message, data ?? ''),
    security: (_e: string, message: string, data?: unknown) => console.warn(prefix, message, data ?? ''),
    startTimer: (_op: string) => ({ done: (_m?: unknown) => void 0 })
  };
}

appLogger = createShimLogger('Application');
dbLogger = createShimLogger('Database');
ipcLogger = createShimLogger('IPC');
import {
  CredentialsNotFoundError,
  CredentialsStorageError,
  createUserFriendlyMessage,
  extractErrorCode,
  isAppError
} from '../../shared/errors';

// Playwright uses bundled Chromium for consistent behavior across all systems
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

// Lazy-load electron-updater AFTER module paths are configured
// Skip loading during tests to avoid initialization issues
const { autoUpdater } = (process.env['VITEST'] === 'true' 
  ? { autoUpdater: null as unknown as typeof import('electron-updater').autoUpdater }
  : require('electron-updater')) as typeof import('electron-updater');

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
    console.error('Preflight module resolution failed', { details, nodePath: process.env['NODE_PATH'], resourcesPath: process.resourcesPath });
    app.exit(1);
  }
}

preflightResolve();

// Now import the real logger after preflight passes
// In test mode, use placeholder loggers that will be mocked
if (process.env['VITEST'] === 'true') {
  const mockLogger = () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, verbose: () => {}, silly: () => {}, audit: () => {}, security: () => {}, startTimer: () => ({ done: () => {} }) });
  ({ initializeLogging, appLogger, dbLogger, ipcLogger } = {
    initializeLogging: () => {},
    appLogger: mockLogger(),
    dbLogger: mockLogger(),
    ipcLogger: mockLogger()
  } as any);
} else {
  ({ initializeLogging, appLogger, dbLogger, ipcLogger } = require('../../shared/logger'));
}
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm`);
  }
  return hours * 60 + minutes;
}

function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Note: isDateInCurrentQuarter removed
// Quarter validation is now handled during submission routing, not at save time
// This allows users to enter historical data from any quarter

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

// Update marker file to persist splash across relaunch after install
function getUpdateMarkerPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'updating.json');
}

function writeUpdateMarker(reason: string) {
  try {
    const markerPath = getUpdateMarkerPath();
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, JSON.stringify({ reason, at: Date.now() }));
    appLogger.info('Wrote update marker', { markerPath, reason });
  } catch (err) {
    appLogger.warn('Could not write update marker', { error: err instanceof Error ? err.message : String(err) });
  }
}

function consumeUpdateMarker(): boolean {
  try {
    const markerPath = getUpdateMarkerPath();
    if (fs.existsSync(markerPath)) {
      fs.unlinkSync(markerPath);
      appLogger.info('Consumed update marker', { markerPath });
      return true;
    }
  } catch (err) {
    appLogger.warn('Could not consume update marker', { error: err instanceof Error ? err.message : String(err) });
  }
  return false;
}

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

function saveWindowState() {
  if (!mainWindow) return;
  
  try {
    const userDataPath = app.getPath('userData');
    const windowStatePath = path.join(userDataPath, 'window-state.json');
    
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();
    
    const windowState: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    };
    
    // Ensure directory exists
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(windowStatePath, JSON.stringify(windowState, null, 2));
    
    appLogger.debug('Window state saved', windowState);
  } catch (error: unknown) {
    appLogger.warn('Could not save window state', { error: error instanceof Error ? error.message : String(error) });
  }
}

// Global safety nets for unhandled async errors
process.on('unhandledRejection', (reason: unknown) => {
  appLogger.error('Unhandled promise rejection detected', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});
process.on('rejectionHandled', () => {
  appLogger.warn('Application handled previously unhandled rejection');
});

// Configure auto-updater
function configureAutoUpdater() {
  // Skip auto-updater configuration in test mode
  if (!autoUpdater || process.env['VITEST'] === 'true') {
    return;
  }
  
  // Keep manual control of downloads to show UI before downloading
  autoUpdater.autoDownload = false;
  
  // Configure logging
  autoUpdater.logger = {
    info: (message?: unknown) => appLogger.info('AutoUpdater', { message }),
    warn: (message?: unknown) => appLogger.warn('AutoUpdater', { message }),
    error: (message?: unknown) => appLogger.error('AutoUpdater error', { message }),
    debug: (message?: unknown) => appLogger.debug('AutoUpdater', { message })
  };

  // Event listeners for update process
  autoUpdater.on('checking-for-update', () => {
    appLogger.info('Checking for updates');
  });

  autoUpdater.on('update-available', (info) => {
    const version = info?.version || 'unknown';
    appLogger.info('Update available', { version });
    
    // Send IPC event to splash or main
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('update-available', version);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', version);
    }
    
    // Start downloading the update
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', (info) => {
    appLogger.info('Update not available', { currentVersion: info?.version || 'unknown' });
  });

  autoUpdater.on('download-progress', (progress) => {
    appLogger.info('Download progress', { 
      percent: progress.percent.toFixed(2),
      transferred: progress.transferred,
      total: progress.total
    });
    
    // Send progress to splash or main
    const target = splashWindow && !splashWindow.isDestroyed() ? splashWindow : (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);
    if (target) {
      target.webContents.send('download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    const version = info?.version || 'unknown';
    appLogger.info('Update downloaded', { version });
    
    // Send IPC event to renderer to show installing status
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('update-downloaded', version);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', version);
    }
    
    // Write marker and wait 3 seconds for user to see completion, then install
    setTimeout(() => {
      appLogger.info('Installing update and restarting');
      writeUpdateMarker('update-downloaded');
      autoUpdater.quitAndInstall();
    }, 3000);
  });

  autoUpdater.on('error', (err) => {
    appLogger.error('AutoUpdater error', { error: err.message, stack: err.stack });
    
    // Send error to renderer if window exists
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('update-error', err.message);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });
  
  // IPC handler to cancel update
  ipcMain.on('cancel-update', () => {
    appLogger.info('Update cancelled by user');
    // Download will be cancelled on app close, will resume on next launch
  });
  
  // IPC handler to force quit and install
  ipcMain.on('quit-and-install', () => {
    appLogger.info('Quitting and installing update');
    autoUpdater.quitAndInstall();
  });
}

// Check for updates (called after app is ready)
function checkForUpdates() {
  // Only check for updates in production builds
  if (!app.isPackaged) {
    appLogger.info('Skipping update check in development mode');
    return;
  }

  // On Windows, skip update check on first run due to Squirrel.Windows file lock
  // See: https://github.com/electron/electron/issues/7155
  // Skip update checks in test mode
  if (!autoUpdater || process.env['VITEST'] === 'true') {
    return;
  }
  
  if (process.platform === 'win32' && process.argv.includes('--squirrel-firstrun')) {
    appLogger.info('Skipping update check on first run (Squirrel.Windows file lock)');
    // Schedule update check for 10 seconds later when file lock is released
    setTimeout(() => {
      appLogger.info('Starting delayed update check after first run');
      autoUpdater.checkForUpdates().catch(err => {
        appLogger.error('Could not check for updates', { error: err.message });
      });
    }, 10000);
    return;
  }

  appLogger.info('Starting update check');
  autoUpdater.checkForUpdates().catch(err => {
    appLogger.error('Could not check for updates', { error: err.message });
  });
}

// Synchronous version for backwards compatibility
function bootstrapDatabase() {
  const timer = dbLogger.startTimer('bootstrap-database');
  const dbFile = path.join(app.getPath('userData'), 'sheetpilot.sqlite');
  dbLogger.verbose('Setting database path', { dbFile });
  setDbPath(dbFile);
  ensureSchema();
  dbLogger.info('Database initialized successfully', { dbPath: getDbPath() });
  timer.done();
}

// Asynchronous database initialization (non-blocking)
async function bootstrapDatabaseAsync() {
  return new Promise<void>((resolve) => {
    // Run database initialization in next tick to avoid blocking
    setImmediate(() => {
      try {
        bootstrapDatabase();
        resolve();
      } catch (error) {
        dbLogger.error('Database initialization failed', error);
        resolve(); // Don't block app startup on DB error
      }
    });
  });
}

function createWindow() {
  const windowState = getWindowState();
  
  // Determine icon path for both dev and production
  const iconPath = PACKAGED_LIKE
    ? path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'icon.ico')
    : path.join(__dirname, '..', '..', '..', '..', 'app', 'frontend', 'src', 'assets', 'images', 'icon.ico');

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: windowState.width,
    height: windowState.height,
    show: false, // Don't show until ready
    backgroundColor: '#ffffff', // Prevent white flash
    autoHideMenuBar: true, // Hide the menu bar
    icon: iconPath, // Application icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Compiled preload script
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true, // Enable web security
      allowRunningInsecureContent: false, // Disable insecure content
      experimentalFeatures: false // Disable experimental features
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
    mainWindow?.show();
    appLogger.info('Main window shown', { 
      width: windowState.width, 
      height: windowState.height
    });
    
    // Restore window state asynchronously after window is shown
    if (mainWindow) {
      restoreWindowState(mainWindow).catch(err => {
        appLogger.debug('Could not restore window state', { error: err.message });
      });
    }
  });

  // Add error handling for failed loads
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL);
    console.error('Error code:', errorCode);
    console.error('Error description:', errorDescription);
    appLogger.error('Could not load renderer', { errorCode, errorDescription, validatedURL });
  });

  // Add success logging
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Renderer loaded successfully');
    appLogger.info('Renderer loaded successfully');
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
    console.log('Loading development URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production/smoke, load compiled renderer from app/frontend/dist
    // __dirname = build/dist/backend/src → go up 4 to project root
    const htmlPath = path.join(__dirname, '..', '..', '..', '..', 'app', 'frontend', 'dist', 'index.html');
    console.log('Loading production HTML from:', htmlPath);
    console.log('File exists:', fs.existsSync(htmlPath));
    mainWindow.loadFile(htmlPath);
  }
}

 function createSplashWindow(hash: string = '#splash') {
  // Small, centered window; keep invisible menu, minimal chrome
  // Determine icon path for both dev and production
  const iconPath = PACKAGED_LIKE
    ? path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'icon.ico')
    : path.join(__dirname, '..', '..', '..', '..', 'app', 'frontend', 'src', 'assets', 'images', 'icon.ico');

   const options: Electron.BrowserWindowConstructorOptions = {
    width: 500,
    height: 420,
    resizable: false,
    movable: true,
    fullscreenable: false,
    frame: true,
    show: false,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    icon: iconPath, // Application icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  };

  splashWindow = new BrowserWindow(options);
  splashWindow.once('ready-to-show', () => splashWindow?.show());

  const isDev = process.env['NODE_ENV'] === 'development' || process.env['ELECTRON_IS_DEV'] === '1';
  if (isDev) {
    splashWindow.loadURL(`http://localhost:5173/${hash}`);
  } else {
    const htmlPath = path.join(__dirname, '..', '..', '..', '..', 'app', 'frontend', 'dist', 'index.html');
    splashWindow.loadFile(htmlPath, { hash });
  }
}

function showMainAndCloseSplash() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// Global flag to prevent concurrent timesheet submissions
let isSubmissionInProgress = false;

// Export function to register IPC handlers (for testing)
export function registerIPCHandlers() {
  // Example: typed IPC handler
  ipcMain.handle('ping', async (_event, msg: string): Promise<string> => {
    return `pong: ${msg}`;
  });
  

  // Handler for timesheet submission (submit pending data from database)
  ipcMain.handle('timesheet:submit', async (_event, token: string) => {
    console.log('[Main] timesheet:submit IPC handler called');
    const timer = ipcLogger.startTimer('timesheet-submit');
    
    // Check if submission is already in progress
    if (isSubmissionInProgress) {
      ipcLogger.warn('Submission already in progress, rejecting concurrent request');
      timer.done({ outcome: 'error', reason: 'concurrent-submission-blocked' });
      return { 
        error: 'A submission is already in progress. Please wait for it to complete.'
      };
    }
    
    ipcLogger.info('Timesheet submission initiated by user');
    
    try {
      // Set flag to block concurrent submissions
      isSubmissionInProgress = true;
      
      // Validate session and check if admin
      if (!token) {
        timer.done({ outcome: 'error', reason: 'no-session' });
        return { 
          error: 'Session token is required. Please log in to submit timesheets.'
        };
      }

      const session = validateSession(token);
      if (!session.valid) {
        timer.done({ outcome: 'error', reason: 'invalid-session' });
        return { 
          error: 'Session is invalid or expired. Please log in again.'
        };
      }

      // Reject submission if admin
      if (session.isAdmin) {
        ipcLogger.warn('Admin attempted timesheet submission', { email: session.email });
        timer.done({ outcome: 'error', reason: 'admin-not-allowed' });
        return { 
          error: 'Admin users cannot submit timesheet entries to SmartSheet.'
        };
      }

      console.log('[Main] Checking credentials...');
      // Check credentials for submission
      const credentials = getCredentials('smartsheet');
      console.log('[Main] Credentials check result:', credentials ? 'found' : 'not found');
      
      if (!credentials) {
        ipcLogger.warn('Submission: credentials not found', { service: 'smartsheet' });
        timer.done({ outcome: 'error', reason: 'credentials-not-found' });
        return { 
          error: 'SmartSheet credentials not found. Please add your credentials to submit timesheets.'
        };
      }

      ipcLogger.verbose('Credentials retrieved, proceeding with submission', { 
        service: 'smartsheet',
        email: credentials.email 
      });
      console.log('[Main] Calling submitTimesheets...');
      
      // Submit pending data from database
      const submitResult = await submitTimesheets(credentials.email, credentials.password);
      console.log('[Main] submitTimesheets completed:', submitResult);
      
      // Check if submission was successful
      if (!submitResult.ok) {
        ipcLogger.warn('Timesheet submission failed', { 
          submitResult,
          successCount: submitResult.successCount,
          removedCount: submitResult.removedCount,
          totalProcessed: submitResult.totalProcessed
        });
      }
      
      ipcLogger.info('Timesheet submission completed successfully', { 
        submitResult,
        dbPath: getDbPath() 
      });
      timer.done({ outcome: 'success', submitResult });
      
      return { 
        submitResult,
        dbPath: getDbPath() 
      };
    } catch (err: unknown) {
      const errorCode = extractErrorCode(err);
      const errorMessage = createUserFriendlyMessage(err);
      const errorDetails = err instanceof Error ? {
        code: errorCode,
        message: errorMessage,
        name: err.name,
        stack: err.stack
      } : { code: errorCode, message: errorMessage };
      
      ipcLogger.error('Timesheet submission failed', errorDetails);
      timer.done({ outcome: 'error', errorCode });
      
      return { error: errorMessage };
    } finally {
      // Always clear the submission lock
      isSubmissionInProgress = false;
    }
  });


  // Handler for storing credentials
  ipcMain.handle('credentials:store', async (_event, service: string, email: string, password: string) => {
    // Validate parameters
    if (!service || !email || !password) {
      return { success: false, error: 'Invalid parameters: service, email, and password are required' };
    }
    
    ipcLogger.audit('store-credentials', 'User storing credentials', { service, email });
    try {
      const result = storeCredentials(service, email, password);
      ipcLogger.info('Credentials stored successfully', { service, email, changes: result.changes });
      return result;
    } catch (err: unknown) {
      // Check if this is a credentials error for audit logging
      const isCredentialsError = err instanceof Error && err.name.includes('Credentials');
      
      if (isCredentialsError) {
        ipcLogger.security('credentials-storage-error', 'Could not store credentials', { service, error: err });
      } else {
        ipcLogger.error('Could not store credentials', err);
      }
      
      throw new CredentialsStorageError(service, {
        error: err instanceof Error ? err.message : String(err),
        originalError: err instanceof Error ? err.name : 'Unknown'
      });
    }
  });

  // Handler for getting credentials
  ipcMain.handle('credentials:get', async (_event, service: string) => {
    // Validate service parameter
    if (!service) {
      return { success: false, error: 'Service name is required' };
    }
    
    try {
      const credentials = getCredentials(service);
      if (!credentials) {
        throw new CredentialsNotFoundError(service);
      }
      return { success: true, credentials };
    } catch (err: unknown) {
      if (isAppError(err)) {
        ipcLogger.error('Credentials retrieval failed', {
          code: err.code,
          category: err.category,
          context: err.context
        });
        return { success: false, error: err.toUserMessage() };
      }
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      ipcLogger.error('Could not retrieve credentials', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler for listing credentials
  ipcMain.handle('credentials:list', async () => {
    try {
      const credentials = listCredentials();
      return { success: true, credentials };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, credentials: [] };
    }
  });

  // Handler for deleting credentials
  ipcMain.handle('credentials:delete', async (_event, service: string) => {
    // Validate service parameter
    if (!service) {
      return { success: false, error: 'Service name is required' };
    }
    
    ipcLogger.audit('delete-credentials', 'User deleting credentials', { service });
    try {
      const result = deleteCredentials(service);
      ipcLogger.info('Credentials deleted', { service, changes: result.changes });
      return result;
    } catch (err: unknown) {
      ipcLogger.error('Could not delete credentials', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, changes: 0 };
    }
  });

  // ============================================================================
  // AUTHENTICATION HANDLERS
  // ============================================================================

  // Admin credentials constants
  const ADMIN_USERNAME = 'Admin';
  const ADMIN_PASSWORD = 'SWFL_ADMIN';

  // Handler for user login
  ipcMain.handle('auth:login', async (_event, email: string, password: string, stayLoggedIn: boolean) => {
    // Validate parameters
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    ipcLogger.audit('login-attempt', 'User attempting login', { email });
    
    try {
      let isAdmin = false;
      
      // Check if this is an admin login
      if (email === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        isAdmin = true;
        ipcLogger.info('Admin login successful', { email });
      } else {
        // For regular users, store credentials (service: 'smartsheet')
        ipcLogger.verbose('Storing user credentials', { email });
        const storeResult = storeCredentials('smartsheet', email, password);
        if (!storeResult.success) {
          return { success: false, error: storeResult.message };
        }
      }

      // Create session
      const sessionToken = createSession(email, stayLoggedIn, isAdmin);
      
      ipcLogger.info('Login successful', { email, isAdmin });
      return {
        success: true,
        token: sessionToken,
        isAdmin
      };
    } catch (err: unknown) {
      ipcLogger.error('Could not login', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for session validation
  ipcMain.handle('auth:validateSession', async (_event, token: string) => {
    if (!token) {
      return { valid: false };
    }

    try {
      const result = validateSession(token);
      return result;
    } catch (err: unknown) {
      ipcLogger.error('Could not validate session', err);
      return { valid: false };
    }
  });

  // Handler for logout
  ipcMain.handle('auth:logout', async (_event, token: string) => {
    if (!token) {
      return { success: false, error: 'Session token is required' };
    }

    ipcLogger.audit('logout', 'User logging out', { token: token.substring(0, 8) + '...' });
    
    try {
      // Get session info before clearing
      const session = validateSession(token);
      if (session.valid && session.email) {
        clearUserSessions(session.email);
        ipcLogger.info('Logout successful', { email: session.email });
      } else {
        clearSession(token);
      }
      
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not logout', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Handler for getting current session
  ipcMain.handle('auth:getCurrentSession', async (_event, token: string) => {
    if (!token) {
      return null;
    }

    try {
      const session = validateSession(token);
      if (session.valid && session.email) {
        return {
          email: session.email,
          token,
          isAdmin: session.isAdmin || false
        };
      }
      return null;
    } catch (err: unknown) {
      ipcLogger.error('Could not get current session', err);
      return null;
    }
  });

  // ============================================================================
  // ADMIN HANDLERS
  // ============================================================================

  // Handler for admin to clear all credentials
  ipcMain.handle('admin:clearCredentials', async (_event, token: string) => {
    // Validate admin session
    if (!token) {
      return { success: false, error: 'Session token is required' };
    }

    const session = validateSession(token);
    if (!session.valid || !session.isAdmin) {
      ipcLogger.security('admin-action-denied', 'Unauthorized admin action attempted', { token: token.substring(0, 8) + '...' });
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    ipcLogger.audit('admin-clear-credentials', 'Admin clearing all credentials', { email: session.email });
    
    try {
      clearAllCredentials();
      ipcLogger.info('All credentials cleared by admin', { email: session.email });
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not clear credentials', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Handler for admin to rebuild database
  ipcMain.handle('admin:rebuildDatabase', async (_event, token: string) => {
    // Validate admin session
    if (!token) {
      return { success: false, error: 'Session token is required' };
    }

    const session = validateSession(token);
    if (!session.valid || !session.isAdmin) {
      ipcLogger.security('admin-action-denied', 'Unauthorized admin action attempted', { token: token.substring(0, 8) + '...' });
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    ipcLogger.audit('admin-rebuild-database', 'Admin rebuilding database', { email: session.email });
    
    try {
      rebuildDatabase();
      ipcLogger.info('Database rebuilt by admin', { email: session.email });
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not rebuild database', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Handler for getting all timesheet entries (for database viewer)
  ipcMain.handle('database:getAllTimesheetEntries', async (_event, token: string) => {
    // Validate session
    if (!token) {
      ipcLogger.security('database-access-denied', 'Unauthorized database access attempted', { handler: 'getAllTimesheetEntries' });
      return { success: false, error: 'Session token is required. Please log in to view archive data.', entries: [] };
    }

    const session = validateSession(token);
    if (!session.valid) {
      ipcLogger.security('database-access-denied', 'Invalid session attempting database access', { handler: 'getAllTimesheetEntries', token: token.substring(0, 8) + '...' });
      return { success: false, error: 'Session is invalid or expired. Please log in again.', entries: [] };
    }

    ipcLogger.verbose('Fetching all timesheet entries (Archive - Complete only)', { email: session.email });
    try {
      const db = getDb();
      const getAll = db.prepare('SELECT * FROM timesheet WHERE status = \'Complete\' ORDER BY date ASC, time_in ASC');
      const entries = getAll.all();
      ipcLogger.verbose('Archive timesheet entries retrieved', { count: entries.length, email: session.email });
      return { success: true, entries };
    } catch (err: unknown) {
      ipcLogger.error('Could not get timesheet entries', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, entries: [] };
    }
  });

  // Handler for getting all credentials (for database viewer)
  ipcMain.handle('database:getAllCredentials', async () => {
    ipcLogger.verbose('Fetching all credentials');
    try {
      const db = getDb();
      const getAll = db.prepare('SELECT id, service, email, created_at, updated_at FROM credentials ORDER BY service');
      const credentials = getAll.all();
      ipcLogger.verbose('Credentials retrieved', { count: credentials.length });
      return { success: true, credentials };
    } catch (err: unknown) {
      ipcLogger.error('Could not get credentials', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, credentials: [] };
    }
  });

  // Handler for CSV export
  ipcMain.handle('timesheet:exportToCSV', async () => {
    ipcLogger.verbose('Exporting timesheet data to CSV');
    try {
      const { getSubmittedTimesheetEntriesForExport } = await import('./services/database');
      const entries = getSubmittedTimesheetEntriesForExport();
      
      if (entries.length === 0) {
        return {
          success: false,
          error: 'No submitted timesheet entries found to export'
        };
      }

      // Format time from minutes to HH:MM
      const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      };

      // CSV headers
      const headers = [
        'Date',
        'Start Time',
        'End Time', 
        'Hours',
        'Project',
        'Tool',
        'Charge Code',
        'Task Description',
        'Status',
        'Submitted At'
      ];

      // Convert data to CSV format
      const csvRows = [headers.join(',')];
      
      for (const entry of entries) {
        // Type assertion to access properties safely
        const typedEntry = entry as {
          date: string;
          time_in: number;
          time_out: number;
          hours: number;
          project: string;
          tool?: string;
          detail_charge_code?: string;
          task_description: string;
          status: string;
          submitted_at: string;
        };
        
        const row = [
          typedEntry.date,
          formatTime(typedEntry.time_in),
          formatTime(typedEntry.time_out),
          typedEntry.hours,
          `"${typedEntry.project.replace(/"/g, '""')}"`, // Escape quotes in project name
          `"${(typedEntry.tool || '').replace(/"/g, '""')}"`, // Escape quotes in tool
          `"${(typedEntry.detail_charge_code || '').replace(/"/g, '""')}"`, // Escape quotes in charge code
          `"${typedEntry.task_description.replace(/"/g, '""')}"`, // Escape quotes in task description
          typedEntry.status,
          typedEntry.submitted_at
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');
      
      ipcLogger.info('CSV export completed', { 
        entryCount: entries.length,
        csvSize: csvContent.length 
      });

      return {
        success: true,
        csvData: csvContent,
        csvContent, // Keep for backward compatibility
        entryCount: entries.length,
        filename: `timesheet_export_${new Date().toISOString().split('T')[0]}.csv`
      };
    } catch (err: unknown) {
      ipcLogger.error('Could not export CSV', err);
      const errorMessage = err instanceof Error ? err.message : 'Could not export timesheet data';
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  // Handler for getting log file path
  ipcMain.handle('logs:getLogPath', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const logFiles = fs.readdirSync(userDataPath).filter((file: string) => file.startsWith('sheetpilot_') && file.endsWith('.log'));
      
      if (logFiles.length === 0) {
        return { success: false, error: 'No log files found' };
      }
      
      // Get the most recent log file
      const latestLogFile = logFiles.sort().pop();
      const logPath = path.join(userDataPath, latestLogFile!);
      
      return { success: true, logPath, logFiles };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for reading log file contents
  ipcMain.handle('logs:readLogFile', async (_event, logPath: string) => {
    try {
      const logContent = fs.readFileSync(logPath, 'utf8');
      const lines = logContent.split('\n').filter((line: string) => line.trim() !== '');
      
      // Parse JSON log entries
      const parsedLogs = lines.map((line: string, index: number) => {
        try {
          const parsed = JSON.parse(line);
          return { lineNumber: index + 1, ...parsed };
        } catch {
          return { lineNumber: index + 1, raw: line };
        }
      });
      
      return { success: true, logs: parsedLogs, totalLines: lines.length };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for exporting logs
  ipcMain.handle('logs:exportLogs', async (_event, logPath: string, exportFormat: 'json' | 'txt' = 'txt') => {
    try {
      const logContent = fs.readFileSync(logPath, 'utf8');
      
      if (exportFormat === 'json') {
        // Export as formatted JSON
        const lines = logContent.split('\n').filter((line: string) => line.trim() !== '');
        const parsedLogs = lines.map((line: string) => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        });
        
        return {
          success: true,
          content: JSON.stringify(parsedLogs, null, 2),
          filename: `sheetpilot_logs_${new Date().toISOString().split('T')[0]}.json`,
          mimeType: 'application/json'
        };
      } else {
        // Export as plain text
        return {
          success: true,
          content: logContent,
          filename: `sheetpilot_logs_${new Date().toISOString().split('T')[0]}.txt`,
          mimeType: 'text/plain'
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for clearing the entire database (dev only)
  ipcMain.handle('database:clearDatabase', async () => {
    ipcLogger.audit('clear-database', 'User clearing entire database');
    try {
      const db = getDb();
      db.exec('DELETE FROM timesheet');
      db.exec('DELETE FROM credentials');
      ipcLogger.warn('Database cleared - all data removed');
      return { success: true, message: 'Database cleared successfully' };
    } catch (err: unknown) {
      ipcLogger.error('Could not clear database', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  });

  // Handler for saving draft timesheet entries
  ipcMain.handle('timesheet:saveDraft', async (_event, row: {
    id?: number;
    date: string;
    timeIn: string;
    timeOut: string;
    project: string;
    tool?: string | null;
    chargeCode?: string | null;
    taskDescription: string;
  }) => {
    const timer = ipcLogger.startTimer('save-draft');
    try {
      // Validate required fields
      if (!row.date) {
        return { success: false, error: 'Date is required' };
      }
      if (!row.project) {
        return { success: false, error: 'Project is required' };
      }
      if (!row.taskDescription) {
        return { success: false, error: 'Task description is required' };
      }
      
      ipcLogger.verbose('Saving draft timesheet entry', { 
        id: row.id,
        date: row.date,
        project: row.project 
      });
      
      // Convert time strings (HH:mm) to minutes since midnight
      const timeInMinutes = parseTimeToMinutes(row.timeIn);
      const timeOutMinutes = parseTimeToMinutes(row.timeOut);
      
      ipcLogger.debug('Parsed time values', { 
        timeIn: row.timeIn,
        timeInMinutes,
        timeOut: row.timeOut,
        timeOutMinutes 
      });
      
      // Note: Quarter validation happens during submission routing, not at save time
      // This allows users to enter historical data from any quarter
      
      // Validate times are 15-minute increments
      if (timeInMinutes % 15 !== 0 || timeOutMinutes % 15 !== 0) {
        throw new Error('Times must be in 15-minute increments');
      }
      
      // Validate timeOut > timeIn
      if (timeOutMinutes <= timeInMinutes) {
        throw new Error('Time Out must be after Time In');
      }
      
      const db = getDb();
      let result;
      
      // If row has an id, UPDATE the existing row
      if (row.id !== undefined && row.id !== null) {
        ipcLogger.debug('Updating existing timesheet entry', { id: row.id });
        const update = db.prepare(`
          UPDATE timesheet
          SET date = ?,
              time_in = ?,
              time_out = ?,
              project = ?,
              tool = ?,
              detail_charge_code = ?,
              task_description = ?,
              status = NULL
          WHERE id = ?
        `);
        
        result = update.run(
          row.date,
          timeInMinutes,
          timeOutMinutes,
          row.project,
          row.tool || null,
          row.chargeCode || null,
          row.taskDescription,
          row.id
        );
      } else {
        // If no id, INSERT a new row (with deduplication)
        ipcLogger.debug('Inserting new timesheet entry');
        const insert = db.prepare(`
          INSERT INTO timesheet
          (date, time_in, time_out, project, tool, detail_charge_code, task_description, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(date, time_in, project, task_description) DO UPDATE SET
            time_out = excluded.time_out,
            tool = excluded.tool,
            detail_charge_code = excluded.detail_charge_code,
            status = NULL
        `);
        
        result = insert.run(
          row.date,
          timeInMinutes,
          timeOutMinutes,
          row.project,
          row.tool || null,
          row.chargeCode || null,
        row.taskDescription
      );
    }
    
    ipcLogger.info('Draft timesheet entry saved', {
        id: row.id,
        changes: result.changes,
        date: row.date,
        project: row.project 
      });
      timer.done({ changes: result.changes });
      return { success: true, changes: result.changes };
    } catch (err: unknown) {
      ipcLogger.error('Could not save draft timesheet entry', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler for deleting draft timesheet entries
  ipcMain.handle('timesheet:deleteDraft', async (_event, id: number) => {
    const timer = ipcLogger.startTimer('delete-draft');
    try {
      if (!id || typeof id !== 'number') {
        return { success: false, error: 'Valid ID is required' };
      }

      ipcLogger.verbose('Deleting draft timesheet entry', { id });
      
      const db = getDb();
      const deleteStmt = db.prepare(`
        DELETE FROM timesheet 
        WHERE id = ? AND status IS NULL
      `);
      
      const result = deleteStmt.run(id);
      
      if (result.changes === 0) {
        ipcLogger.warn('No draft entry found to delete', { id });
        timer.done({ outcome: 'not_found' });
        return { success: false, error: 'Draft entry not found' };
      }
      
      ipcLogger.info('Draft timesheet entry deleted', { 
        id,
        changes: result.changes
      });
      timer.done({ changes: result.changes });
      return { success: true };
    } catch (err: unknown) {
      ipcLogger.error('Could not delete draft timesheet entry', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler for loading draft timesheet entries (pending only)
  ipcMain.handle('timesheet:loadDraft', async () => {
    const timer = ipcLogger.startTimer('load-draft');
    try {
      ipcLogger.verbose('Loading draft timesheet entries');
      
      const db = getDb();
      const getPending = db.prepare(`
        SELECT * FROM timesheet 
        WHERE status IS NULL
        ORDER BY date ASC, time_in ASC
      `);
      
      const entries = getPending.all() as Array<{
        id: number;
        date: string;
        time_in: number;
        time_out: number;
        project: string;
        tool?: string;
        detail_charge_code?: string;
        task_description: string;
      }>;
      
      // Convert database format to grid format
      const gridData = entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        timeIn: formatMinutesToTime(entry.time_in),
        timeOut: formatMinutesToTime(entry.time_out),
        project: entry.project,
        tool: entry.tool || null,
        chargeCode: entry.detail_charge_code || null,
        taskDescription: entry.task_description
      }));
      
      ipcLogger.info('Draft timesheet entries loaded', { count: gridData.length });
      timer.done({ count: gridData.length });
      
      // Return one blank row if no entries, otherwise return the entries
      const entriesToReturn = gridData.length > 0 ? gridData : [{}];
      return { success: true, entries: entriesToReturn };
    } catch (err: unknown) {
      ipcLogger.error('Could not load draft timesheet entries', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { success: false, error: errorMessage, entries: [] };
    }
  });

  // Renderer logging bridge - route renderer logs to main process logger
  ipcMain.on('logger:error', (_event, message: string, data?: unknown) => {
    ipcLogger.error(message, data);
  });

  ipcMain.on('logger:warn', (_event, message: string, data?: unknown) => {
    ipcLogger.warn(message, data);
  });

  ipcMain.on('logger:info', (_event, message: string, data?: unknown) => {
    ipcLogger.info(message, data);
  });

  ipcMain.on('logger:verbose', (_event, message: string, data?: unknown) => {
    ipcLogger.verbose(message, data);
  });

  ipcMain.on('logger:debug', (_event, message: string, data?: unknown) => {
    ipcLogger.debug(message, data);
  });

  // User action tracking
  ipcMain.on('logger:user-action', (_event, action: string, data?: unknown) => {
    ipcLogger.info(`User action: ${action}`, data);
  });

  // Decide whether to show splash first
  const isDev = process.env['NODE_ENV'] === 'development' || process.env['ELECTRON_IS_DEV'] === '1';
  const forceSplashInDev = process.env['VITE_FORCE_SPLASH'] === 'true';
  const shouldShowSplash = app.isPackaged || (isDev && forceSplashInDev);

  // If we detect a previous update marker, show finalize splash
  let showedFinalizeSplash = false;
  if (shouldShowSplash && fs.existsSync(getUpdateMarkerPath())) {
    // Do not consume immediately; renderer may need to know
    createSplashWindow('#splash?state=finalize');
    showedFinalizeSplash = true;
    // Consume marker shortly after splash is shown
    setTimeout(() => {
      consumeUpdateMarker();
      // After brief finalize, show main
      setTimeout(() => showMainAndCloseSplash(), 1000);
    }, 500);
  } else if (shouldShowSplash) {
    createSplashWindow('#splash');
  } else {
    createWindow();
  }

  // Initialize database asynchronously (non-blocking)
  bootstrapDatabaseAsync().then(() => {
    dbLogger.info('Database ready for operations');
  }).catch(err => {
    dbLogger.error('Database initialization failed', err);
  });
  
  // Configure and check for updates asynchronously (non-blocking)
  setImmediate(() => {
    try {
      configureAutoUpdater();
      if (app.isPackaged) {
        checkForUpdates();
      } else if (!shouldShowSplash) {
        // In dev without splash, still allow update UI in main if wired
        checkForUpdates();
      }
    } catch (err) {
      appLogger.error('Auto-updater setup failed', err);
    }
  });

  // If we showed a non-finalize splash in production but no update is available, we will close it
  // on the 'update-not-available' event by showing main. Hook that here by listening once.
  if (autoUpdater && process.env['VITEST'] !== 'true') {
    autoUpdater.once('update-not-available', () => {
      if (shouldShowSplash && !showedFinalizeSplash) {
        showMainAndCloseSplash();
      }
    });
    // On updater error, do not block the app
    autoUpdater.once('error', () => {
      if (shouldShowSplash && !showedFinalizeSplash) {
        showMainAndCloseSplash();
      }
    });
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
  initializeLogging();
  appLogger.info('Application startup initiated');
  
  // Ensure Windows taskbar uses our app identity (affects icon/notifications)
  try {
    app.setAppUserModelId('com.sheetpilot.app');
    appLogger.debug('AppUserModelID set', { appId: 'com.sheetpilot.app' });
  } catch (err) {
    appLogger.warn('Could not set AppUserModelID', { error: err instanceof Error ? err.message : String(err) });
  }
  
  // Fix desktop shortcut icon if needed (Windows only)
  fixDesktopShortcutIcon();
  
  // Register default plugins for the plugin system
  registerDefaultPlugins();
  
  // Register IPC handlers immediately (required for renderer communication)
  registerIPCHandlers();
  
  // Note: bootstrapDatabase() is now called asynchronously inside registerIPCHandlers()
  // This allows the window to show before database is fully initialized
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
