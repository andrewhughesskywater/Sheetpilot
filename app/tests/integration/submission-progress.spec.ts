/**
 * @fileoverview Submission Progress Integration Test
 * 
 * End-to-end test that mocks timesheet submission and verifies
 * progress bar updates are correctly sent from backend to frontend.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

declare global {
  // Storage for mocked IPC handlers used by tests
  // eslint-disable-next-line no-var
  var __test_handlers: Record<string, (...args: unknown[]) => unknown> | undefined;
}

// Ensure handler storage exists
(globalThis as unknown as { __test_handlers?: Record<string, (...args: unknown[]) => unknown> }).__test_handlers = {};

// Track progress events sent to renderer
const progressEvents: Array<{ percent: number; current: number; total: number; message: string }> = [];

// Mock BrowserWindow
const mockMainWindow: Partial<BrowserWindow> = {
  webContents: {
    send: vi.fn((channel: string, data: unknown) => {
      if (channel === 'timesheet:progress') {
        progressEvents.push(data as { percent: number; current: number; total: number; message: string });
      }
    }),
    on: vi.fn(),
    once: vi.fn(),
    executeJavaScript: vi.fn(),
  } as any,
  isDestroyed: vi.fn(() => false) as any,
} as Partial<BrowserWindow>;

// Mock electron modules
vi.mock('electron', () => {
  const ipcMain = {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      (globalThis.__test_handlers as Record<string, (...args: unknown[]) => unknown>)[channel] = async (...args: unknown[]) => {
        return fn(null, ...args);
      };
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  };

  return {
    app: {
      getPath: vi.fn(() => ':memory:'),
      getAppPath: vi.fn(() => '/test'),
      getVersion: vi.fn(() => '1.0.0'),
      isPackaged: false,
    },
    ipcMain,
    BrowserWindow: vi.fn(() => mockMainWindow),
  };
});

// Mock electron-updater
vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(() => Promise.resolve()),
  },
}));

// Mock the database module
vi.mock('../../../app/backend/src/services/database', () => ({
  ensureSchema: vi.fn(),
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ changes: 1 })),
      get: vi.fn(() => null),
      all: vi.fn(() => []),
    })),
  })),
  getDbPath: vi.fn(() => ':memory:'),
  getPendingTimesheetEntries: vi.fn(() => [
    { id: 1, date: '2025-01-15', time_in: 480, time_out: 540, project: 'Project A', task_description: 'Task 1' },
    { id: 2, date: '2025-01-16', time_in: 480, time_out: 540, project: 'Project B', task_description: 'Task 2' },
    { id: 3, date: '2025-01-17', time_in: 480, time_out: 540, project: 'Project C', task_description: 'Task 3' },
  ]),
  markTimesheetEntriesAsInProgress: vi.fn(),
  markTimesheetEntriesAsSubmitted: vi.fn(),
  removeFailedTimesheetEntries: vi.fn(),
  validateSession: vi.fn(() => ({ valid: true, email: 'test@example.com', isAdmin: false })),
  getCredentials: vi.fn(() => ({ email: 'test@example.com', password: 'password123' })),
  getTimesheetEntriesByIds: vi.fn(() => []),
}));

// Mock logger
vi.mock('../../../shared/logger', () => ({
  ipcLogger: {
    verbose: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    startTimer: vi.fn(() => ({
      done: vi.fn(),
    })),
  },
  botLogger: {
    verbose: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    startTimer: vi.fn(() => ({
      done: vi.fn(),
    })),
  },
}));

// Create a mock submission service that emits progress updates
const createMockSubmissionService = () => {
  return {
    metadata: {
      name: 'mock-submission-service',
      version: '1.0.0',
      author: 'Test',
      description: 'Mock submission service for testing',
    },
    async submit(
      entries: Array<{ id?: number }>,
      _credentials: { email: string; password: string },
      progressCallback?: (percent: number, message: string) => void
    ) {
      // Simulate progressive submission with progress updates
      const totalEntries = entries.length;
      const submittedIds: number[] = [];

      // Initial progress (10%)
      progressCallback?.(10, 'Logging in');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Login complete (20%)
      progressCallback?.(20, 'Login complete');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Process each entry with progress updates
      for (let i = 0; i < totalEntries; i++) {
        const entry = entries[i];
        if (entry?.id) {
          submittedIds.push(entry.id);
        }

        // Calculate progress (20% to 80% for processing entries)
        const progress = 20 + Math.floor((60 * (i + 1)) / totalEntries);
        const message = `Processed ${i + 1}/${totalEntries} rows`;
        progressCallback?.(progress, message);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Completion (100%)
      progressCallback?.(100, 'Submission complete');

      return {
        ok: true,
        submittedIds,
        removedIds: [],
        totalProcessed: totalEntries,
        successCount: submittedIds.length,
        removedCount: 0,
      };
    },
    validateEntry: vi.fn(() => ({ valid: true, errors: [] })),
    isAvailable: vi.fn(() => Promise.resolve(true)),
  };
};

// Mock the plugin system
vi.mock('../../../app/backend/src/middleware/bootstrap-plugins', () => ({
  getSubmissionService: vi.fn(() => createMockSubmissionService()),
  registerDefaultPlugins: vi.fn(),
}));

describe('Submission Progress Integration Test', () => {
  beforeEach(() => {
    // Clear progress events
    progressEvents.length = 0;
    vi.clearAllMocks();
    
    // Reset handler storage
    globalThis.__test_handlers = {};
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should send progress updates during submission', async () => {
    // Import and register handlers after mocks are set up
    const { registerTimesheetHandlers, setMainWindow } = await import('../../../app/backend/src/ipc/timesheet-handlers');
    
    // Set main window reference
    setMainWindow(mockMainWindow as BrowserWindow);
    
    // Register handlers
    registerTimesheetHandlers();

    // Get the submission handler
    const submitHandler = globalThis.__test_handlers?.['timesheet:submit'];
    expect(submitHandler).toBeDefined();

    // Call the submit handler with a valid token
    const result = await submitHandler?.('valid-token');

    // Verify the submission was successful
    expect(result).toBeDefined();
    expect(result).toHaveProperty('submitResult');
    expect(result.submitResult).toMatchObject({
      ok: true,
      successCount: 3,
      totalProcessed: 3,
    });

    // Verify progress events were sent
    expect(progressEvents.length).toBeGreaterThan(0);
    
    // Verify initial progress event (10% - Logging in)
    expect(progressEvents[0]).toMatchObject({
      percent: 10,
      message: 'Logging in',
    });

    // Verify login complete event (20%)
    expect(progressEvents[1]).toMatchObject({
      percent: 20,
      message: 'Login complete',
    });

    // Verify processing progress events (20% to 80%)
    const processingEvents = progressEvents.slice(2, -1);
    expect(processingEvents.length).toBeGreaterThan(0);
    
    // Check that progress increases
    for (let i = 1; i < processingEvents.length; i++) {
      expect(processingEvents[i]?.percent).toBeGreaterThanOrEqual(processingEvents[i - 1]?.percent || 0);
    }

    // Verify final progress event (100%)
    const lastEvent = progressEvents[progressEvents.length - 1];
    expect(lastEvent).toMatchObject({
      percent: 100,
      message: 'Submission complete',
    });

    // Verify webContents.send was called with progress updates
    expect(mockMainWindow.webContents?.send).toHaveBeenCalledWith(
      'timesheet:progress',
      expect.objectContaining({
        percent: expect.any(Number),
        current: expect.any(Number),
        total: expect.any(Number),
        message: expect.any(String),
      })
    );
  });

  it('should calculate current/total from progress percentage', async () => {
    // Import and register handlers
    const { registerTimesheetHandlers, setMainWindow } = await import('../../../app/backend/src/ipc/timesheet-handlers');
    setMainWindow(mockMainWindow as BrowserWindow);
    registerTimesheetHandlers();

    // Get the submission handler
    const submitHandler = globalThis.__test_handlers?.['timesheet:submit'];
    
    // Call the submit handler
    await submitHandler?.('valid-token');

    // Verify that current/total are calculated correctly
    const processingEvents = progressEvents.filter(e => e.percent > 20 && e.percent < 100);
    
    processingEvents.forEach(event => {
      // Verify current is within valid range
      expect(event.current).toBeGreaterThanOrEqual(0);
      expect(event.current).toBeLessThanOrEqual(event.total);
      
      // Verify total matches the number of pending entries
      expect(event.total).toBe(3);
      
      // Verify message format
      expect(event.message).toBeTruthy();
    });
  });

  it('should handle submission with no pending entries', async () => {
    // Mock getPendingTimesheetEntries to return empty array
    const { getPendingTimesheetEntries } = await import('../../../app/backend/src/services/database');
    vi.mocked(getPendingTimesheetEntries).mockReturnValueOnce([]);

    // Import and register handlers
    const { registerTimesheetHandlers, setMainWindow } = await import('../../../app/backend/src/ipc/timesheet-handlers');
    setMainWindow(mockMainWindow as BrowserWindow);
    registerTimesheetHandlers();

    // Clear previous events
    progressEvents.length = 0;

    // Get the submission handler
    const submitHandler = globalThis.__test_handlers?.['timesheet:submit'];
    
    // Call the submit handler
    const result = await submitHandler?.('valid-token');

    // Verify result
    expect(result).toMatchObject({
      submitResult: {
        ok: true,
        successCount: 0,
        totalProcessed: 0,
      },
    });

    // No progress events should be sent for empty submissions
    expect(progressEvents.length).toBe(0);
  });

  it('should handle window destroyed during submission', async () => {
    // Mock window as destroyed
    vi.mocked(mockMainWindow.isDestroyed as any).mockReturnValueOnce(true);

    // Import and register handlers
    const { registerTimesheetHandlers, setMainWindow } = await import('../../../app/backend/src/ipc/timesheet-handlers');
    setMainWindow(mockMainWindow as BrowserWindow);
    registerTimesheetHandlers();

    // Clear previous events
    progressEvents.length = 0;

    // Get the submission handler
    const submitHandler = globalThis.__test_handlers?.['timesheet:submit'];
    
    // Call the submit handler - should not throw
    const result = await submitHandler?.('valid-token');

    // Verify submission still completes
    expect(result).toBeDefined();
    expect(result.submitResult).toBeDefined();
  });

  it('should send progress updates with correct structure', async () => {
    // Import and register handlers
    const { registerTimesheetHandlers, setMainWindow } = await import('../../../app/backend/src/ipc/timesheet-handlers');
    setMainWindow(mockMainWindow as BrowserWindow);
    registerTimesheetHandlers();

    // Get the submission handler
    const submitHandler = globalThis.__test_handlers?.['timesheet:submit'];
    
    // Call the submit handler
    await submitHandler?.('valid-token');

    // Verify all progress events have required structure
    progressEvents.forEach(event => {
      expect(event).toHaveProperty('percent');
      expect(event).toHaveProperty('current');
      expect(event).toHaveProperty('total');
      expect(event).toHaveProperty('message');

      // Verify types
      expect(typeof event.percent).toBe('number');
      expect(typeof event.current).toBe('number');
      expect(typeof event.total).toBe('number');
      expect(typeof event.message).toBe('string');

      // Verify percent is clamped to 0-100
      expect(event.percent).toBeGreaterThanOrEqual(0);
      expect(event.percent).toBeLessThanOrEqual(100);
    });
  });

  it('should handle progress updates in sequential order', async () => {
    // Import and register handlers
    const { registerTimesheetHandlers, setMainWindow } = await import('../../../app/backend/src/ipc/timesheet-handlers');
    setMainWindow(mockMainWindow as BrowserWindow);
    registerTimesheetHandlers();

    // Get the submission handler
    const submitHandler = globalThis.__test_handlers?.['timesheet:submit'];
    
    // Call the submit handler
    await submitHandler?.('valid-token');

    // Verify progress increases monotonically (or stays the same)
    for (let i = 1; i < progressEvents.length; i++) {
      const prevPercent = progressEvents[i - 1]?.percent || 0;
      const currentPercent = progressEvents[i]?.percent || 0;
      
      expect(currentPercent).toBeGreaterThanOrEqual(prevPercent);
    }
  });

  it('should match progress bar component expectations', async () => {
    // Import and register handlers
    const { registerTimesheetHandlers, setMainWindow } = await import('../../../app/backend/src/ipc/timesheet-handlers');
    setMainWindow(mockMainWindow as BrowserWindow);
    registerTimesheetHandlers();

    // Get the submission handler
    const submitHandler = globalThis.__test_handlers?.['timesheet:submit'];
    
    // Call the submit handler
    await submitHandler?.('valid-token');

    // Verify progress events match what SubmitProgressBar component expects
    progressEvents.forEach(event => {
      // Component expects these exact properties
      expect(event).toEqual(
        expect.objectContaining({
          percent: expect.any(Number),
          current: expect.any(Number),
          total: expect.any(Number),
          message: expect.any(String),
        })
      );

      // Simulate component state updates
      const isSubmitting = true;
      const progress = event.percent;
      const currentEntry = event.current;
      const totalEntries = event.total;
      const progressMessage = event.message;

      // Verify component would render correctly
      expect(isSubmitting).toBe(true);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
      expect(currentEntry).toBeGreaterThanOrEqual(0);
      expect(currentEntry).toBeLessThanOrEqual(totalEntries);
      expect(progressMessage).toBeTruthy();
    });
  });
});

