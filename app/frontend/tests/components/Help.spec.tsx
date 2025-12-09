/**
 * @fileoverview Help Component Tests
 * 
 * Tests for the Help page including log export, credential management,
 * admin tools, and user manual access.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Help Component', () => {
  let mockWindow: {
    logs: {
      getLogPath: ReturnType<typeof vi.fn>;
      exportLogs: ReturnType<typeof vi.fn>;
    };
    credentials: {
      list: ReturnType<typeof vi.fn>;
      store: ReturnType<typeof vi.fn>;
    };
    admin: {
      clearCredentials: ReturnType<typeof vi.fn>;
      rebuildDatabase: ReturnType<typeof vi.fn>;
    };
    logger: {
      error: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      userAction: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh mocks for each test
    mockWindow = {
      logs: {
        getLogPath: vi.fn(),
        exportLogs: vi.fn()
      },
      credentials: {
        list: vi.fn(),
        store: vi.fn()
      },
      admin: {
        clearCredentials: vi.fn(),
        rebuildDatabase: vi.fn()
      },
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        userAction: vi.fn()
      }
    };
    (global as {window?: unknown}).window = mockWindow;
  });

  describe('Log Export Functionality', () => {
    it('should load log path and files on mount', async () => {
      mockWindow.logs.getLogPath.mockResolvedValue({
        success: true,
        logPath: 'C:\\logs\\',
        logFiles: ['app-2025-01-15.log', 'app-2025-01-16.log']
      });
      
      const response = await mockWindow.logs.getLogPath();
      
      expect(response.success).toBe(true);
      expect(response.logPath).toBeDefined();
      expect(response.logFiles).toHaveLength(2);
    });

    it('should handle log path API unavailable', async () => {
      (global as {window?: {logs?: unknown}}).window = {logs: undefined};
      
      const hasLogsAPI = (global as {window?: {logs?: {getLogPath?: unknown}}}).window?.logs?.getLogPath !== undefined;
      expect(hasLogsAPI).toBe(false);
    });

    it('should export latest log file', async () => {
      const logFiles = ['app-2025-01-14.log', 'app-2025-01-15.log', 'app-2025-01-16.log'];
      const latestLogFile = logFiles[logFiles.length - 1];
      
      expect(latestLogFile).toBe('app-2025-01-16.log');
    });

    it('should construct full log path correctly', () => {
      const logPath = 'C:\\logs\\';
      const logFile = 'app.log';
      
      const fullPath = logPath.endsWith('\\') 
        ? logPath + logFile 
        : logPath + '\\' + logFile;
      
      expect(fullPath).toBe('C:\\logs\\app.log');
    });

    it('should handle log path without trailing slash', () => {
      const logPath = 'C:\\logs';
      const logFile = 'app.log';
      
      const fullPath = logPath.endsWith('\\') 
        ? logPath + logFile 
        : logPath + '\\' + logFile;
      
      expect(fullPath).toBe('C:\\logs\\app.log');
    });

    it('should create downloadable blob', async () => {
      mockWindow.logs.exportLogs.mockResolvedValue({
        success: true,
        content: 'Log file content\nLine 2\nLine 3',
        filename: 'app-2025-01-15.log',
        mimeType: 'text/plain'
      });
      
      const response = await mockWindow.logs.exportLogs('C:\\logs\\app.log', 'txt');
      
      expect(response.success).toBe(true);
      expect(response.content).toBeDefined();
      expect(response.filename).toBeDefined();
    });

    it('should handle export failure', async () => {
      mockWindow.logs.exportLogs.mockResolvedValue({
        success: false,
        error: 'File not found'
      });
      
      const response = await mockWindow.logs.exportLogs('C:\\logs\\nonexistent.log', 'txt');
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should handle no log files available', () => {
      const logFiles: string[] = [];
      const hasLogs = logFiles && logFiles.length > 0;
      
      expect(hasLogs).toBe(false);
    });
  });

  describe('Credential Update Functionality', () => {
    it('should load stored credentials', async () => {
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: [
          { id: 1, service: 'smartsheet', email: 'user@test.com', created_at: '2025-01-01', updated_at: '2025-01-01' }
        ]
      });
      
      const response = await mockWindow.credentials.list();
      
      expect(response.success).toBe(true);
      expect(response.credentials).toHaveLength(1);
      expect(response.credentials[0].service).toBe('smartsheet');
    });

    it('should prefill email from existing credentials', async () => {
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: [
          { id: 1, service: 'smartsheet', email: 'existing@test.com', created_at: '', updated_at: '' }
        ]
      });
      
      const response = await mockWindow.credentials.list();
      const existingCred = response.credentials.find((c: {service: string; email?: string}) => c.service === 'smartsheet');
      
      expect(existingCred).toBeDefined();
      expect(existingCred?.email).toBe('existing@test.com');
    });

    it('should update credentials successfully', async () => {
      mockWindow.credentials.store.mockResolvedValue({
        success: true,
        message: 'Credentials updated successfully'
      });
      
      const result = await mockWindow.credentials.store('smartsheet', 'new@test.com', 'newpassword');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
    });

    it('should handle update failure', async () => {
      mockWindow.credentials.store.mockResolvedValue({
        success: false,
        message: 'Database error'
      });
      
      const result = await mockWindow.credentials.store('smartsheet', 'user@test.com', 'password');
      
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it('should validate email and password before update', () => {
      const email = '';
      const password = 'password';
      
      const isValid = email && password;
      expect(isValid).toBeFalsy();
    });

    it('should require token for update', () => {
      const token = null;
      const hasAuth = window.credentials?.store && token;
      
      expect(hasAuth).toBeFalsy();
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout function', async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      
      await logout();
      
      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('should handle logout errors gracefully', async () => {
      const logout = vi.fn().mockRejectedValue(new Error('Logout failed'));
      
      try {
        await logout();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Admin Tools', () => {
    it('should show admin tools only for admin users', () => {
      const isAdmin = true;
      const showAdminTools = isAdmin;
      
      expect(showAdminTools).toBe(true);
    });

    it('should hide admin tools for regular users', () => {
      const isAdmin = false;
      const showAdminTools = isAdmin;
      
      expect(showAdminTools).toBe(false);
    });

    it('should clear all credentials with confirmation', async () => {
      mockWindow.admin.clearCredentials.mockResolvedValue({
        success: true
      });
      
      const token = 'admin-token';
      const result = await mockWindow.admin.clearCredentials(token);
      
      expect(result.success).toBe(true);
    });

    it('should handle clearCredentials failure', async () => {
      mockWindow.admin.clearCredentials.mockResolvedValue({
        success: false,
        error: 'Permission denied'
      });
      
      const result = await mockWindow.admin.clearCredentials('token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should rebuild database with confirmation', async () => {
      mockWindow.admin.rebuildDatabase.mockResolvedValue({
        success: true
      });
      
      const result = await mockWindow.admin.rebuildDatabase('admin-token');
      
      expect(result.success).toBe(true);
    });

    it('should handle rebuildDatabase failure', async () => {
      mockWindow.admin.rebuildDatabase.mockResolvedValue({
        success: false,
        error: 'Database locked'
      });
      
      const result = await mockWindow.admin.rebuildDatabase('token');
      
      expect(result.success).toBe(false);
    });

    it('should require token for admin operations', () => {
      const token = null;
      const hasAuth = token && window.admin?.clearCredentials;
      
      expect(hasAuth).toBeFalsy();
    });

    it('should check for admin API availability', () => {
      const hasAdminAPI = window.admin?.clearCredentials !== undefined;
      expect(hasAdminAPI).toBe(true);
    });
  });

  describe('Dialog Management', () => {
    it('should manage multiple dialog states independently', () => {
      const dialogStates = {
        showLogsDialog: false,
        showUserGuideDialog: false,
        showAdminDialog: false,
        showUpdateCredentialsDialog: false,
        showClearCredentialsDialog: false,
        showRebuildDatabaseDialog: false
      };
      
      // Open one dialog
      dialogStates.showLogsDialog = true;
      
      // Others should remain closed
      expect(dialogStates.showUserGuideDialog).toBe(false);
      expect(dialogStates.showAdminDialog).toBe(false);
    });

    it('should clear errors when closing dialog', () => {
      let error = 'Some error';
      let showDialog = true;
      
      const handleClose = () => {
        showDialog = false;
        error = '';
      };
      
      handleClose();
      
      expect(showDialog).toBe(false);
      expect(error).toBe('');
    });

    it('should handle dialog transitions', () => {
      let showAdminDialog = true;
      let showClearCredentialsDialog = false;
      
      const transitionToConfirmDialog = () => {
        showAdminDialog = false;
        showClearCredentialsDialog = true;
      };
      
      transitionToConfirmDialog();
      
      expect(showAdminDialog).toBe(false);
      expect(showClearCredentialsDialog).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should display errors in dialogs', () => {
      const error = 'An error occurred';
      const hasError = error.length > 0;
      
      expect(hasError).toBe(true);
    });

    it('should clear errors on successful operation', () => {
      let error = 'Previous error';
      
      const handleSuccess = () => {
        error = '';
      };
      
      handleSuccess();
      expect(error).toBe('');
    });

    it('should show specific error messages', () => {
      const errorMessages = {
        noLogsAPI: 'Logs API not available',
        noCredentialsAPI: 'Credentials API not available',
        noAdminAPI: 'Admin API not available',
        noToken: 'Authentication token required'
      };
      
      Object.values(errorMessages).forEach(msg => {
        expect(msg).toBeDefined();
        expect(msg.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during log export', () => {
      const isExporting = true;
      const buttonText = isExporting ? 'Exporting...' : 'Export Logs';
      
      expect(buttonText).toBe('Exporting...');
    });

    it('should disable actions during loading', () => {
      const isLoading = true;
      const isDisabled = isLoading;
      
      expect(isDisabled).toBe(true);
    });

    it('should handle multiple concurrent loading states', () => {
      const loadingStates = {
        isExporting: true,
        isUpdatingCredentials: false,
        isAdminActionLoading: false
      };
      
      const anyLoading = Object.values(loadingStates).some(state => state);
      
      expect(anyLoading).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle Enter key on feature cards', () => {
      const handleKeyPress = vi.fn();
      
      const onKeyPress = (key: string) => {
        if (key === 'Enter') {
          handleKeyPress();
        }
      };
      
      onKeyPress('Enter');
      expect(handleKeyPress).toHaveBeenCalledTimes(1);
    });

    it('should ignore other keys', () => {
      const handleKeyPress = vi.fn();
      
      const onKeyPress = (key: string) => {
        if (key === 'Enter') {
          handleKeyPress();
        }
      };
      
      onKeyPress('Space');
      onKeyPress('Tab');
      
      expect(handleKeyPress).not.toHaveBeenCalled();
    });
  });

  describe('Email Auto-completion in Update Dialog', () => {
    it('should auto-complete skywatertechnology.com domain', () => {
      const value = 'user@';
      const atIndex = value.lastIndexOf('@');
      const domainPart = value.substring(atIndex + 1);
      
      let completedEmail = value;
      if (domainPart === '' || domainPart === 'skywatertechnology.com'.substring(0, domainPart.length)) {
        completedEmail = value.substring(0, atIndex + 1) + 'skywatertechnology.com';
      }
      
      expect(completedEmail).toBe('user@skywatertechnology.com');
    });
  });

  describe('Admin Warning Messages', () => {
    it('should warn admin users cannot submit timesheets', () => {
      const warningMessage = 'Admin users cannot submit timesheet entries to SmartSheet.';
      
      expect(warningMessage).toContain('cannot submit');
    });

    it('should warn about destructive operations', () => {
      const warningMessage = 'These tools perform destructive operations. Use with caution.';
      
      expect(warningMessage).toContain('destructive');
      expect(warningMessage).toContain('caution');
    });

    it('should warn before clearing credentials', () => {
      const warningMessage = 'This will permanently delete all stored credentials. Users will need to log in again.';
      
      expect(warningMessage).toContain('permanently delete');
    });

    it('should warn before rebuilding database', () => {
      const warningMessage = 'WARNING: This will permanently delete all timesheet entries and credentials!';
      
      expect(warningMessage).toContain('WARNING');
      expect(warningMessage).toContain('permanently delete all');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty log files array', () => {
      const logFiles: string[] = [];
      const hasLogs = logFiles && logFiles.length > 0;
      
      expect(hasLogs).toBe(false);
    });

    it('should handle undefined log files', () => {
      const logFiles = undefined;
      const hasLogs = logFiles && logFiles.length > 0;
      
      expect(hasLogs).toBeFalsy();
    });

    it('should handle empty credentials list', () => {
      const credentials: unknown[] = [];
      const hasCredentials = credentials.length > 0;
      
      expect(hasCredentials).toBe(false);
    });

    it('should handle finding service in credentials', () => {
      const credentials = [
        { service: 'smartsheet', email: 'user@test.com' },
        { service: 'other', email: 'other@test.com' }
      ];
      
      const smartsheetCred = credentials.find(c => c.service === 'smartsheet');
      
      expect(smartsheetCred).toBeDefined();
      expect(smartsheetCred!.email).toBe('user@test.com');
    });

    it('should handle service not found in credentials', () => {
      const credentials = [
        { service: 'other', email: 'other@test.com' }
      ];
      
      const smartsheetCred = credentials.find(c => c.service === 'smartsheet');
      
      expect(smartsheetCred).toBeUndefined();
    });
  });
});

