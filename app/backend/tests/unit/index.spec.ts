import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserWindow } from 'electron';
import { registerAllIPCHandlers } from '../../src/ipc/index';
import { registerAuthHandlers } from '../../src/ipc/auth-handlers';
import { registerCredentialsHandlers } from '../../src/ipc/credentials-handlers';
import { registerTimesheetHandlers, setMainWindow } from '../../src/ipc/timesheet-handlers';
import { registerAdminHandlers } from '../../src/ipc/admin-handlers';
import { registerDatabaseHandlers } from '../../src/ipc/database-handlers';
import { registerLogsHandlers } from '../../src/ipc/logs-handlers';
import { registerLoggerHandlers } from '../../src/ipc/logger-handlers';
import { registerSettingsHandlers } from '../../src/ipc/settings-handlers';
import { appLogger } from '../../../shared/logger';

// Mock all handler modules
vi.mock('../../src/ipc/auth-handlers');
vi.mock('../../src/ipc/credentials-handlers');
vi.mock('../../src/ipc/timesheet-handlers');
vi.mock('../../src/ipc/admin-handlers');
vi.mock('../../src/ipc/database-handlers');
vi.mock('../../src/ipc/logs-handlers');
vi.mock('../../src/ipc/logger-handlers');
vi.mock('../../src/ipc/settings-handlers');
vi.mock('../../../shared/logger');

describe('ipc/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAllIPCHandlers', () => {
    it('should register all IPC handler modules', () => {
      registerAllIPCHandlers();

      expect(registerAuthHandlers).toHaveBeenCalled();
      expect(registerCredentialsHandlers).toHaveBeenCalled();
      expect(registerTimesheetHandlers).toHaveBeenCalled();
      expect(registerAdminHandlers).toHaveBeenCalled();
      expect(registerDatabaseHandlers).toHaveBeenCalled();
      expect(registerLogsHandlers).toHaveBeenCalled();
      expect(registerLoggerHandlers).toHaveBeenCalled();
      expect(registerSettingsHandlers).toHaveBeenCalled();
    });

    it('should log verbose messages for each handler registration', () => {
      registerAllIPCHandlers();

      expect(appLogger.verbose).toHaveBeenCalledWith('Starting IPC handler registration', { hasMainWindow: false });
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering auth handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Auth handlers registered successfully');
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering credentials handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Credentials handlers registered successfully');
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering timesheet handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Timesheet handlers registered successfully');
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering admin handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Admin handlers registered successfully');
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering database handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Database handlers registered successfully');
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering logs handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Logs handlers registered successfully');
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering logger handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Logger handlers registered successfully');
      expect(appLogger.verbose).toHaveBeenCalledWith('Registering settings handlers');
      expect(appLogger.verbose).toHaveBeenCalledWith('Settings handlers registered successfully');
    });

    it('should log success message with all modules', () => {
      registerAllIPCHandlers();

      expect(appLogger.info).toHaveBeenCalledWith(
        'All IPC handler modules registered successfully',
        {
          modulesRegistered: [
            'auth',
            'credentials',
            'timesheet',
            'admin',
            'database',
            'logs',
            'logger',
            'settings'
          ]
        }
      );
    });

    it('should set main window when provided', () => {
      const mockWindow = {} as BrowserWindow;

      registerAllIPCHandlers(mockWindow);

      expect(appLogger.verbose).toHaveBeenCalledWith('Starting IPC handler registration', { hasMainWindow: true });
      expect(appLogger.verbose).toHaveBeenCalledWith('Setting main window reference for timesheet handlers');
      expect(setMainWindow).toHaveBeenCalledWith(mockWindow);
    });

    it('should not set main window when null', () => {
      registerAllIPCHandlers(null);

      expect(appLogger.verbose).toHaveBeenCalledWith('Starting IPC handler registration', { hasMainWindow: false });
      expect(setMainWindow).not.toHaveBeenCalled();
    });

    it('should not set main window when undefined', () => {
      registerAllIPCHandlers(undefined);

      expect(appLogger.verbose).toHaveBeenCalledWith('Starting IPC handler registration', { hasMainWindow: false });
      expect(setMainWindow).not.toHaveBeenCalled();
    });

    it('should handle registration errors', () => {
      const error = new Error('Registration failed');
      vi.mocked(registerAuthHandlers).mockImplementation(() => {
        throw error;
      });

      expect(() => registerAllIPCHandlers()).toThrow('Registration failed');

      expect(appLogger.error).toHaveBeenCalledWith(
        'Failed to register IPC handler module',
        {
          error: 'Registration failed',
          stack: expect.any(String)
        }
      );
    });

    it('should handle non-Error exceptions', () => {
      const error = 'String error';
      vi.mocked(registerAuthHandlers).mockImplementation(() => {
        throw error;
      });

      expect(() => registerAllIPCHandlers()).toThrow();

      expect(appLogger.error).toHaveBeenCalledWith(
        'Failed to register IPC handler module',
        {
          error: 'String error',
          stack: undefined
        }
      );
    });
  });
});


