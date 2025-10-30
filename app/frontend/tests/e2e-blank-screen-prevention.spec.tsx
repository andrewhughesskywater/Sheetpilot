import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';

describe('End-to-End Blank Screen Prevention Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Mock console methods to prevent test output noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Original Blank Screen Scenario', () => {
    it('should prevent blank screen when APIs are undefined (original issue)', async () => {
      // Simulate the exact scenario that caused the blank screen
      vi.stubEnv('DEV', true);
      vi.stubEnv('NODE_ENV', 'development');
      
      // Ensure no APIs are available (simulating browser environment)
      delete (window as unknown as Record<string, unknown>).logger;
      delete (window as unknown as Record<string, unknown>).timesheet;
      delete (window as unknown as Record<string, unknown>).credentials;
      delete (window as unknown as Record<string, unknown>).database;
      delete (window as unknown as Record<string, unknown>).logs;
      delete (window as unknown as Record<string, unknown>).api;

      // Render the app
      render(
        <App />
      );

      // Wait for the app to render - look for the logo which should be present
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify the app is not blank
      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });

    it('should handle the exact error sequence that caused blank screen', async () => {
      // Simulate the exact error sequence from the original issue
      vi.stubEnv('DEV', true);
      
      // Start with no APIs (browser environment)
      delete (window as unknown as Record<string, unknown>).logger;
      delete (window as unknown as Record<string, unknown>).timesheet;
      delete (window as unknown as Record<string, unknown>).credentials;
      delete (window as unknown as Record<string, unknown>).database;
      delete (window as unknown as Record<string, unknown>).logs;

      // Render the app
      render(
        <App />
      );

      // Wait for the app to render
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify the app renders successfully
      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });
  });

  describe('Development vs Production Environment Tests', () => {
    it('should work correctly in development environment', async () => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('NODE_ENV', 'development');

      render(
        <App />
      );

      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });

    it('should work correctly in production environment', async () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('NODE_ENV', 'production');
      
      // Mock production APIs (simulating Electron environment)
      (window as unknown as Record<string, unknown>).logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
        userAction: vi.fn()
      };
      (window as unknown as Record<string, unknown>).timesheet = {
        loadDraft: vi.fn().mockResolvedValue({ success: true, entries: [] }),
        saveDraft: vi.fn(),
        deleteDraft: vi.fn(),
        submit: vi.fn(),
        exportToCSV: vi.fn()
      };
      (window as unknown as Record<string, unknown>).credentials = {
        store: vi.fn(),
        get: vi.fn(),
        list: vi.fn().mockResolvedValue({ success: true, credentials: [] }),
        delete: vi.fn()
      };
      (window as unknown as Record<string, unknown>).database = {
        getAllTimesheetEntries: vi.fn(),
        getAllCredentials: vi.fn(),
        clearDatabase: vi.fn()
      };
      (window as unknown as Record<string, unknown>).logs = {
        getLogPath: vi.fn(),
        readLogFile: vi.fn(),
        exportLogs: vi.fn()
      };

      render(
        <App />
      );

      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });
  });

  describe('API Error Scenarios', () => {
    it('should handle API timeouts gracefully', async () => {
      vi.stubEnv('DEV', true);
      
      // Mock APIs that timeout
      (window as unknown as Record<string, unknown>).timesheet = {
        loadDraft: vi.fn().mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
        ),
        saveDraft: vi.fn(),
        deleteDraft: vi.fn(),
        submit: vi.fn(),
        exportToCSV: vi.fn()
      };
      (window as unknown as Record<string, unknown>).credentials = {
        store: vi.fn(),
        get: vi.fn(),
        list: vi.fn().mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
        ),
        delete: vi.fn()
      };
      (window as unknown as Record<string, unknown>).logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
        userAction: vi.fn()
      };

      render(
        <App />
      );

      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });

    it('should handle malformed API responses gracefully', async () => {
      vi.stubEnv('DEV', true);
      
      // Mock APIs that return malformed data
      (window as unknown as Record<string, unknown>).timesheet = {
        loadDraft: vi.fn().mockResolvedValue(null),
        saveDraft: vi.fn(),
        deleteDraft: vi.fn(),
        submit: vi.fn(),
        exportToCSV: vi.fn()
      };
      (window as unknown as Record<string, unknown>).credentials = {
        store: vi.fn(),
        get: vi.fn(),
        list: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn()
      };
      (window as unknown as Record<string, unknown>).logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
        userAction: vi.fn()
      };

      render(
        <App />
      );

      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });
  });
});
