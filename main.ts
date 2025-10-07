import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import {
  setDbPath,
  ensureSchema,
  getDbPath,
  storeCredentials,
  getCredentials,
  listCredentials,
  deleteCredentials,
  openDb
} from './src/services/database';
import { submitTimesheets } from './src/services/timesheet_importer';
import {
  initializeLogging,
  appLogger,
  dbLogger,
  ipcLogger
} from './src/shared/logger';
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

function isDateInCurrentQuarter(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  
  // Get current quarter (1-4)
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const dateQuarter = Math.floor(date.getMonth() / 3) + 1;
  
  // Check if date is in current quarter and current year
  return date.getFullYear() === now.getFullYear() && dateQuarter === currentQuarter;
}

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
    const fs = require('fs').promises;
    const windowStatePath = path.join(userDataPath, 'window-state.json');
    
    const data = await fs.readFile(windowStatePath, 'utf8');
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
    const fs = require('fs');
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
  // Disable auto-download initially - we'll trigger it after checking
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
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
    appLogger.info('Update available', { version: info?.version || 'unknown' });
    // Automatically download the update
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
  });

  autoUpdater.on('update-downloaded', (info) => {
    appLogger.info('Update downloaded', { version: info?.version || 'unknown' });
    appLogger.info('Update will be installed on app quit');
    // The update will be installed automatically when the app quits
    // due to autoInstallOnAppQuit = true
  });

  autoUpdater.on('error', (err) => {
    appLogger.error('AutoUpdater error', { error: err.message, stack: err.stack });
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
  
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: windowState.width,
    height: windowState.height,
    show: false, // Don't show until ready
    backgroundColor: '#ffffff', // Prevent white flash
    icon: path.join(__dirname, '..', 'assets', 'images', 'icon.ico'), // Set window icon
    autoHideMenuBar: true, // Hide the menu bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // in dev still JS, will point to compiled .js later
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
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
    restoreWindowState(mainWindow).catch(err => {
      appLogger.debug('Could not restore window state', { error: err.message });
    });
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

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production, __dirname is 'dist/', so go up one level to reach root
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }
}

// Export function to register IPC handlers (for testing)
export function registerIPCHandlers() {
  // Example: typed IPC handler
  ipcMain.handle('ping', async (_event, msg: string): Promise<string> => {
    return `pong: ${msg}`;
  });
  

  // Handler for timesheet submission (submit pending data from database)
  ipcMain.handle('timesheet:submit', async () => {
    const timer = ipcLogger.startTimer('timesheet-submit');
    ipcLogger.info('Timesheet submission initiated by user');
    
    try {
      // Check credentials for submission
      const credentials = getCredentials('smartsheet');
      
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
      
      // Submit pending data from database
      const submitResult = await submitTimesheets(credentials.email, credentials.password);
      
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
      ipcLogger.error('Timesheet submission failed', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      timer.done({ outcome: 'error', error: errorMessage });
      return { error: errorMessage };
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
      ipcLogger.error('Could not store credentials', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage, changes: 0 };
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
        return { success: false, error: 'Credentials not found for service: ' + service };
      }
      return { success: true, credentials };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
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

  // Handler for getting all timesheet entries (for database viewer)
  ipcMain.handle('database:getAllTimesheetEntries', async () => {
    ipcLogger.verbose('Fetching all timesheet entries (Archive - Complete only)');
    try {
      const db = openDb();
      const getAll = db.prepare('SELECT * FROM timesheet WHERE status = \'Complete\' ORDER BY date ASC, time_in ASC');
      const entries = getAll.all();
      db.close();
      ipcLogger.verbose('Archive timesheet entries retrieved', { count: entries.length });
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
      const db = openDb();
      const getAll = db.prepare('SELECT id, service, email, created_at, updated_at FROM credentials ORDER BY service');
      const credentials = getAll.all();
      db.close();
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
      const { getSubmittedTimesheetEntriesForExport } = await import('./src/services/database');
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

  // Handler for clearing the entire database (dev only)
  ipcMain.handle('database:clearDatabase', async () => {
    ipcLogger.audit('clear-database', 'User clearing entire database');
    try {
      const db = openDb();
      db.exec('DELETE FROM timesheet');
      db.exec('DELETE FROM credentials');
      db.close();
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
      
      // Validate date is in current quarter
      if (!isDateInCurrentQuarter(row.date)) {
        throw new Error(`Date ${row.date} is not in the current quarter`);
      }
      
      // Validate times are 15-minute increments
      if (timeInMinutes % 15 !== 0 || timeOutMinutes % 15 !== 0) {
        throw new Error('Times must be in 15-minute increments');
      }
      
      // Validate timeOut > timeIn
      if (timeOutMinutes <= timeInMinutes) {
        throw new Error('Time Out must be after Time In');
      }
      
      const db = openDb();
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
      
      db.close();
      
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
      
      const db = openDb();
      const deleteStmt = db.prepare(`
        DELETE FROM timesheet 
        WHERE id = ? AND status IS NULL
      `);
      
      const result = deleteStmt.run(id);
      db.close();
      
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
      
      const db = openDb();
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
      db.close();
      
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

  // Create and show window FIRST (immediate visual feedback)
  createWindow();
  
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
      checkForUpdates();
    } catch (err) {
      appLogger.error('Auto-updater setup failed', err);
    }
  });
}

// Initialize app when running as main entry point
app.whenReady().then(() => {
  // Initialize logging first (fast, non-blocking)
  initializeLogging();
  appLogger.info('Application startup initiated');
  
  // Register IPC handlers immediately (required for renderer communication)
  registerIPCHandlers();
  
  // Note: bootstrapDatabase() is now called asynchronously inside registerIPCHandlers()
  // This allows the window to show before database is fully initialized
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
