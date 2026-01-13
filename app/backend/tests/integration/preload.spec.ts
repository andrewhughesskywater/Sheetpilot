import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextBridge, ipcRenderer } from 'electron';

// Mock electron
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  }
}));

describe('preload.ts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    // Import preload fresh for each test
    await import('../src/preload');
  });

  it('should expose api.ping handler', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'api',
      expect.objectContaining({
        ping: expect.any(Function)
      })
    );

    // Test ping handler
    const exposed = vi.mocked(contextBridge.exposeInMainWorld).mock.calls.find(
      call => call[0] === 'api'
    )?.[1] as { ping: (msg: string) => Promise<string> };

    vi.mocked(ipcRenderer.invoke).mockResolvedValue('pong');
    const result = await exposed.ping('test');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('ping', 'test');
    expect(result).toBe('pong');
  });

  it('should expose timesheet handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'timesheet',
      expect.objectContaining({
        submit: expect.any(Function),
        cancel: expect.any(Function),
        saveDraft: expect.any(Function),
        loadDraft: expect.any(Function),
        loadDraftById: expect.any(Function),
        deleteDraft: expect.any(Function),
        resetInProgress: expect.any(Function),
        exportToCSV: expect.any(Function),
        onSubmissionProgress: expect.any(Function),
        removeProgressListener: expect.any(Function)
      })
    );
  });

  it('should expose credentials handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'credentials',
      expect.objectContaining({
        store: expect.any(Function),
        list: expect.any(Function),
        delete: expect.any(Function)
      })
    );
  });

  it('should expose auth handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'auth',
      expect.objectContaining({
        login: expect.any(Function),
        validateSession: expect.any(Function),
        logout: expect.any(Function),
        getCurrentSession: expect.any(Function)
      })
    );
  });

  it('should expose admin handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'admin',
      expect.objectContaining({
        clearCredentials: expect.any(Function),
        rebuildDatabase: expect.any(Function)
      })
    );
  });

  it('should expose database handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'database',
      expect.objectContaining({
        getAllTimesheetEntries: expect.any(Function),
        getAllArchiveData: expect.any(Function)
      })
    );
  });

  it('should expose logs handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'logs',
      expect.objectContaining({
        getLogPath: expect.any(Function),
        exportLogs: expect.any(Function)
      })
    );
  });

  it('should expose logger handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'logger',
      expect.objectContaining({
        error: expect.any(Function),
        warn: expect.any(Function),
        info: expect.any(Function),
        verbose: expect.any(Function),
        debug: expect.any(Function),
        userAction: expect.any(Function)
      })
    );
  });

  it('should expose updates handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'updates',
      expect.objectContaining({
        onUpdateAvailable: expect.any(Function),
        onDownloadProgress: expect.any(Function),
        onUpdateDownloaded: expect.any(Function),
        cancelUpdate: expect.any(Function),
        quitAndInstall: expect.any(Function),
        removeAllListeners: expect.any(Function)
      })
    );
  });

  it('should expose settings handlers', async () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'settings',
      expect.objectContaining({
        get: expect.any(Function),
        set: expect.any(Function),
        getAll: expect.any(Function)
      })
    );
  });

  it('should handle timesheet progress listener setup', async () => {
    const exposed = vi.mocked(contextBridge.exposeInMainWorld).mock.calls.find(
      call => call[0] === 'timesheet'
    )?.[1] as {
      onSubmissionProgress: (callback: (progress: unknown) => void) => void;
      removeProgressListener: () => void;
    };

    const callback = vi.fn();
    exposed.onSubmissionProgress(callback);

    expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('timesheet:progress');
    expect(ipcRenderer.on).toHaveBeenCalledWith('timesheet:progress', expect.any(Function));

    exposed.removeProgressListener();
    expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('timesheet:progress');
  });

  it('should handle logger methods correctly', async () => {
    const exposed = vi.mocked(contextBridge.exposeInMainWorld).mock.calls.find(
      call => call[0] === 'logger'
    )?.[1] as {
      error: (message: string, data?: unknown) => void;
      warn: (message: string, data?: unknown) => void;
      info: (message: string, data?: unknown) => void;
    };

    exposed.error('Error message', { errorCode: 123 });
    expect(ipcRenderer.send).toHaveBeenCalledWith('logger:error', 'Error message', { errorCode: 123 });

    exposed.warn('Warning message', { warningType: 'deprecated' });
    expect(ipcRenderer.send).toHaveBeenCalledWith('logger:warn', 'Warning message', { warningType: 'deprecated' });

    exposed.info('Info message', { userId: 456 });
    expect(ipcRenderer.send).toHaveBeenCalledWith('logger:info', 'Info message', { userId: 456 });
  });
});

