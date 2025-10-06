import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { setDbPath, ensureSchema, getDbPath, storeCredentials, getCredentials, listCredentials, deleteCredentials, openDb } from './backend/database'
import { submitTimesheets } from './backend/timesheet_importer';
import { initializeLogging, appLogger, dbLogger, ipcLogger } from './shared/logger';

// Helper functions for timesheet validation
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
  
  try {
    const userDataPath = app.getPath('userData');
    const fs = require('fs');
    const windowStatePath = path.join(userDataPath, 'window-state.json');
    
    if (fs.existsSync(windowStatePath)) {
      const data = fs.readFileSync(windowStatePath, 'utf8');
      const savedState = JSON.parse(data);
      
      // Validate saved state and ensure it's within screen bounds
      const { width, height, x, y, isMaximized } = savedState;
      const display = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = display.workAreaSize;
      
      // Ensure window is not larger than screen
      const validWidth = Math.min(width || defaultWidth, screenWidth);
      const validHeight = Math.min(height || defaultHeight, screenHeight);
      
      // Ensure window position is within screen bounds
      let validX = x;
      let validY = y;
      
      if (validX !== undefined && validY !== undefined) {
        validX = Math.max(0, Math.min(validX, screenWidth - validWidth));
        validY = Math.max(0, Math.min(validY, screenHeight - validHeight));
      }
      
      return {
        width: validWidth,
        height: validHeight,
        x: validX,
        y: validY,
        isMaximized: isMaximized || false
      };
    }
  } catch (error: any) {
    appLogger.warn('Failed to load window state, using defaults', { error: error?.message || String(error) });
  }
  
  return {
    width: defaultWidth,
    height: defaultHeight,
    isMaximized: false
  };
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
  } catch (error: any) {
    appLogger.warn('Failed to save window state', { error: error?.message || String(error) });
  }
}

// Global safety nets for unhandled async errors
process.on('unhandledRejection', (reason: any) => {
  appLogger.error('Unhandled promise rejection detected', {
    reason: String((reason && reason.message) || reason),
    stack: reason && reason.stack,
  });
});
process.on('rejectionHandled', () => {
  appLogger.warn('Previously unhandled rejection was handled later');
});

// Configure auto-updater
function configureAutoUpdater() {
  // Disable auto-download initially - we'll trigger it after checking
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Configure logging
  autoUpdater.logger = {
    info: (message?: any) => appLogger.info('AutoUpdater', { message }),
    warn: (message?: any) => appLogger.warn('AutoUpdater', { message }),
    error: (message?: any) => appLogger.error('AutoUpdater error', { message }),
    debug: (message?: any) => appLogger.debug('AutoUpdater', { message })
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

  appLogger.info('Starting update check');
  autoUpdater.checkForUpdates().catch(err => {
    appLogger.error('Failed to check for updates', { error: err.message });
  });
}

function bootstrapDatabase() {
  const timer = dbLogger.startTimer('bootstrap-database');
  const dbFile = path.join(app.getPath('userData'), 'sheetpilot.sqlite');
  dbLogger.verbose('Setting database path', { dbFile });
  setDbPath(dbFile);
  ensureSchema();
  dbLogger.info('Database initialized successfully', { dbPath: getDbPath() });
  timer.done();
}

function createWindow() {
  const windowState = getWindowState();
  
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: windowState.width,
    height: windowState.height,
    show: false, // Don't show until ready
    icon: path.join(__dirname, 'icon.ico'), // Set window icon
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

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    appLogger.info('Main window created and shown', { 
      width: windowState.width, 
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      isMaximized: windowState.isMaximized
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
  initializeLogging();
  appLogger.info('Application ready event received');
  bootstrapDatabase();
  

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
    } catch (err: any) {
      ipcLogger.error('Timesheet submission failed', err);
      timer.done({ outcome: 'error', error: err?.message });
      return { error: String(err?.message ?? err) };
    }
  });


  // Handler for storing credentials
  ipcMain.handle('credentials:store', async (_event, service: string, email: string, password: string) => {
    ipcLogger.audit('store-credentials', 'User storing credentials', { service, email });
    try {
      const result = storeCredentials(service, email, password);
      ipcLogger.info('Credentials stored successfully', { service, email, changes: result.changes });
      return result;
    } catch (err: any) {
      ipcLogger.error('Failed to store credentials', err);
      return { success: false, message: String(err?.message ?? err), changes: 0 };
    }
  });

  // Handler for getting credentials
  ipcMain.handle('credentials:get', async (_event, service: string) => {
    try {
      const credentials = getCredentials(service);
      return credentials;
    } catch (err: any) {
      return null;
    }
  });

  // Handler for listing credentials
  ipcMain.handle('credentials:list', async () => {
    try {
      const credentials = listCredentials();
      return credentials;
    } catch (err: any) {
      return [];
    }
  });

  // Handler for deleting credentials
  ipcMain.handle('credentials:delete', async (_event, service: string) => {
    ipcLogger.audit('delete-credentials', 'User deleting credentials', { service });
    try {
      const result = deleteCredentials(service);
      ipcLogger.info('Credentials deleted', { service, changes: result.changes });
      return result;
    } catch (err: any) {
      ipcLogger.error('Failed to delete credentials', err);
      return { success: false, message: String(err?.message ?? err), changes: 0 };
    }
  });

  // Handler for getting all timesheet entries (for database viewer)
  ipcMain.handle('database:getAllTimesheetEntries', async () => {
    ipcLogger.verbose('Fetching all timesheet entries');
    try {
      const db = openDb();
      const getAll = db.prepare('SELECT * FROM timesheet ORDER BY date ASC, time_in ASC');
      const entries = getAll.all();
      db.close();
      ipcLogger.verbose('Timesheet entries retrieved', { count: entries.length });
      return entries;
    } catch (err: any) {
      ipcLogger.error('Failed to get timesheet entries', err);
      return [];
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
      return credentials;
    } catch (err: any) {
      ipcLogger.error('Failed to get credentials', err);
      return [];
    }
  });

  // Handler for CSV export
  ipcMain.handle('timesheet:exportToCSV', async () => {
    ipcLogger.verbose('Exporting timesheet data to CSV');
    try {
      const { getSubmittedTimesheetEntriesForExport } = await import('./backend/database');
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
        'Time In',
        'Time Out', 
        'Hours',
        'Project',
        'Tool',
        'Detail Charge Code',
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
        csvContent,
        entryCount: entries.length,
        filename: `timesheet_export_${new Date().toISOString().split('T')[0]}.csv`
      };
    } catch (err: any) {
      ipcLogger.error('Failed to export CSV', err);
      return {
        success: false,
        error: err.message || 'Failed to export timesheet data'
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
      return { success: true };
    } catch (err: any) {
      ipcLogger.error('Failed to clear database', err);
      return { success: false, error: String(err?.message ?? err) };
    }
  });

  // Handler for saving draft timesheet entries
  ipcMain.handle('timesheet:saveDraft', async (_event, row: {
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
      ipcLogger.verbose('Saving draft timesheet entry', { 
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
      
      // Insert or update the timesheet entry
      const db = openDb();
      const insert = db.prepare(`
        INSERT INTO timesheet
        (date, time_in, time_out, project, tool, detail_charge_code, task_description, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(date, time_in, project, task_description) DO UPDATE SET
          time_out = excluded.time_out,
          tool = excluded.tool,
          detail_charge_code = excluded.detail_charge_code,
          task_description = excluded.task_description,
          status = NULL
      `);
      
      const result = insert.run(
        row.date,
        timeInMinutes,
        timeOutMinutes,
        row.project,
        row.tool || null,
        row.chargeCode || null,
        row.taskDescription
      );
      
      db.close();
      
      ipcLogger.info('Draft timesheet entry saved', { 
        changes: result.changes,
        date: row.date,
        project: row.project 
      });
      timer.done({ changes: result.changes });
      return { success: true, changes: result.changes };
    } catch (err: any) {
      ipcLogger.error('Failed to save draft timesheet entry', err);
      timer.done({ outcome: 'error', error: err?.message });
      return { success: false, error: String(err?.message ?? err) };
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
      
      const entries = getPending.all();
      db.close();
      
      // Convert database format to grid format
      const gridData = entries.map((entry: any) => ({
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
      return gridData;
    } catch (err: any) {
      ipcLogger.error('Failed to load draft timesheet entries', err);
      timer.done({ outcome: 'error', error: err?.message });
      return [];
    }
  });

  createWindow();
  
  // Configure and check for updates after window is created
  configureAutoUpdater();
  checkForUpdates();
}

// Initialize app when running as main entry point
app.whenReady().then(() => {
  initializeLogging();
  appLogger.info('Application ready event received');
  bootstrapDatabase();
  registerIPCHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
