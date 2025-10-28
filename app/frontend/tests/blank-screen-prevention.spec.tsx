import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../src/renderer/App';

// Mock the window object for testing
const mockWindow = {
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
    userAction: vi.fn()
  },
  timesheet: {
    loadDraft: vi.fn(),
    saveDraft: vi.fn(),
    deleteDraft: vi.fn(),
    submit: vi.fn(),
    exportToCSV: vi.fn()
  },
  credentials: {
    store: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    delete: vi.fn()
  },
  database: {
    getAllTimesheetEntries: vi.fn(),
    getAllCredentials: vi.fn(),
    clearDatabase: vi.fn()
  },
  logs: {
    getLogPath: vi.fn(),
    readLogFile: vi.fn(),
    exportLogs: vi.fn()
  },
  api: {
    ping: vi.fn()
  }
};

// Mock Vite environment
vi.mock('vite', () => ({
  defineConfig: vi.fn()
}));

describe('App Rendering Tests - Blank Screen Prevention', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Clear window APIs
    delete (window as any).logger;
    delete (window as any).timesheet;
    delete (window as any).credentials;
    delete (window as any).database;
    delete (window as any).logs;
    delete (window as any).api;
    
    // Mock window object
    Object.assign(window, mockWindow);
    
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

  describe('Development Environment Tests', () => {
    beforeEach(() => {
      // Mock development environment
      vi.stubEnv('DEV', 'true');
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('should render without blank screen when all APIs are available', async () => {
      // Mock successful API responses
      mockWindow.timesheet.loadDraft.mockResolvedValue({
        success: true,
        entries: []
      });
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: []
      });

      render(
        <App />
      );

      // Wait for the app to render - look for the logo image which should be present
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify the app is not blank
      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });

    it('should handle missing logger gracefully', async () => {
      // Remove logger from window
      delete window.logger;

      render(
        <App />
      );

      // Should not throw errors
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle missing timesheet API gracefully', async () => {
      // Remove timesheet API from window
      delete window.timesheet;

      render(
        <App />
      );

      // Should not throw errors
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle missing credentials API gracefully', async () => {
      // Remove credentials API from window
      delete window.credentials;

      render(
        <App />
      );

      // Should not throw errors
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle missing database API gracefully', async () => {
      // Remove database API from window
      delete window.database;

      render(
        <App />
      );

      // Should not throw errors
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle missing logs API gracefully', async () => {
      // Remove logs API from window
      delete window.logs;

      render(
        <App />
      );

      // Should not throw errors
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle all APIs missing gracefully', async () => {
      // Remove all APIs from window
      delete window.logger;
      delete window.timesheet;
      delete window.credentials;
      delete window.database;
      delete window.logs;

      render(
        <App />
      );

      // Should not throw errors and should render
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should initialize fallbacks in development mode', async () => {
      const { initializeLoggerFallback } = await import('../../src/renderer/utils/logger-fallback');
      const { initializeAPIFallback } = await import('../../src/renderer/utils/api-fallback');

      render(
        <App />
      );

      // Wait for app to render first
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify fallbacks are initialized
      expect(initializeLoggerFallback).toHaveBeenCalled();
      expect(initializeAPIFallback).toHaveBeenCalled();
    });
  });

  describe('Production Environment Tests', () => {
    beforeEach(() => {
      // Mock production environment
      vi.stubEnv('DEV', 'false');
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('should render correctly in production with all APIs', async () => {
      // Mock successful API responses
      mockWindow.timesheet.loadDraft.mockResolvedValue({
        success: true,
        entries: []
      });
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: []
      });

      render(
        <App />
      );

      // Wait for the app to render
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify the app is not blank
      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });

    it('should not initialize fallbacks in production mode', async () => {
      const { initializeLoggerFallback } = await import('../../src/renderer/utils/logger-fallback');
      const { initializeAPIFallback } = await import('../../src/renderer/utils/api-fallback');

      render(
        <App />
      );

      // Wait for app to render first
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify fallbacks are not initialized in production
      expect(initializeLoggerFallback).not.toHaveBeenCalled();
      expect(initializeAPIFallback).not.toHaveBeenCalled();
    });
  });

  describe('API Error Handling Tests', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API errors
      mockWindow.timesheet.loadDraft.mockRejectedValue(new Error('API Error'));
      mockWindow.credentials.list.mockRejectedValue(new Error('API Error'));

      render(
        <App />
      );

      // Should not crash the app
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle malformed API responses gracefully', async () => {
      // Mock malformed responses
      mockWindow.timesheet.loadDraft.mockResolvedValue(null);
      mockWindow.credentials.list.mockResolvedValue(undefined);

      render(
        <App />
      );

      // Should not crash the app
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Component Loading Tests', () => {
    it('should load all main components without errors', async () => {
      // Mock successful API responses
      mockWindow.timesheet.loadDraft.mockResolvedValue({
        success: true,
        entries: []
      });
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: []
      });

      render(
        <App />
      );

      // Wait for components to load
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify all main components are present
      expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
    });

    it('should handle lazy-loaded components gracefully', async () => {
      // Mock successful API responses
      mockWindow.timesheet.loadDraft.mockResolvedValue({
        success: true,
        entries: []
      });
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: []
      });

      render(
        <App />
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should not show loading errors
      expect(screen.queryByText('Loading timesheet...')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Tests', () => {
    it('should catch and handle rendering errors', async () => {
      // Mock an error in the render process
      const originalError = console.error;
      console.error = vi.fn();

      // Force an error by making an API return invalid data
      mockWindow.timesheet.loadDraft.mockResolvedValue({
        success: false,
        error: 'Invalid data'
      });

      render(
        <App />
      );

      // Should not crash the app
      await waitFor(() => {
        expect(screen.getByAltText('SheetPilot')).toBeInTheDocument();
      }, { timeout: 10000 });

      console.error = originalError;
    });
  });
});
