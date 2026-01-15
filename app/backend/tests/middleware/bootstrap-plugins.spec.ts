import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import {
  registerDefaultPlugins,
  getDataService,
  getCredentialService,
  getSubmissionService
} from '../../src/middleware/bootstrap-plugins';
import { PluginRegistry } from '../../../shared/plugin-registry';
import { loadPluginConfig } from '../../../shared/plugin-config';
import { SQLiteDataService } from '../../src/services/plugins/sqlite-data-service';
import { MemoryDataService } from '../../src/services/plugins/memory-data-service';
import { SQLiteCredentialService } from '../../src/services/plugins/sqlite-credential-service';
import { ElectronBotService } from '../../src/services/plugins/electron-bot-service';
import { MockSubmissionService } from '../../src/services/plugins/mock-submission-service';
// Mock dependencies
vi.mock('../../../shared/plugin-registry');
vi.mock('../../../shared/plugin-config');
vi.mock('../../src/services/plugins/sqlite-data-service');
vi.mock('../../src/services/plugins/memory-data-service');
vi.mock('../../src/services/plugins/sqlite-credential-service');
vi.mock('../../src/services/plugins/electron-bot-service');
vi.mock('../../src/services/plugins/mock-submission-service');
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/'))
  };
});

describe('bootstrap-plugins', () => {
  let mockRegistry: {
    loadConfig: ReturnType<typeof vi.fn>;
    registerPlugin: ReturnType<typeof vi.fn>;
    getActivePluginName: ReturnType<typeof vi.fn>;
    getPlugin: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockRegistry = {
      loadConfig: vi.fn(),
      registerPlugin: vi.fn().mockResolvedValue(undefined),
      getActivePluginName: vi.fn((type: string) => {
        const names: Record<string, string> = {
          data: 'sqlite',
          credentials: 'sqlite',
          submission: 'electron'
        };
        return names[type] || null;
      }),
      getPlugin: vi.fn()
    };

    vi.mocked(PluginRegistry.getInstance).mockReturnValue(mockRegistry as unknown as PluginRegistry);
    vi.mocked(loadPluginConfig).mockResolvedValue({} as Awaited<ReturnType<typeof loadPluginConfig>>);
  });

  describe('registerDefaultPlugins', () => {
    const mockLogger = {
      info: vi.fn(),
      verbose: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      silly: vi.fn(),
      audit: vi.fn(),
      security: vi.fn(),
      startTimer: vi.fn(() => ({ done: vi.fn() }))
    };

    it('should load plugin configuration', async () => {
      await registerDefaultPlugins(mockLogger);

      expect(path.join).toHaveBeenCalledWith(process.cwd(), 'plugin-config.json');
      expect(loadPluginConfig).toHaveBeenCalled();
      expect(mockRegistry.loadConfig).toHaveBeenCalled();
    });

    it('should register all data services', async () => {
      await registerDefaultPlugins(mockLogger);

      expect(mockRegistry.registerPlugin).toHaveBeenCalledWith(
        'data',
        'sqlite',
        expect.any(SQLiteDataService)
      );
      expect(mockRegistry.registerPlugin).toHaveBeenCalledWith(
        'data',
        'memory',
        expect.any(MemoryDataService)
      );
    });

    it('should register credential service', async () => {
      await registerDefaultPlugins(mockLogger);

      expect(mockRegistry.registerPlugin).toHaveBeenCalledWith(
        'credentials',
        'sqlite',
        expect.any(SQLiteCredentialService)
      );
    });

    it('should register submission services', async () => {
      await registerDefaultPlugins(mockLogger);

      expect(mockRegistry.registerPlugin).toHaveBeenCalledWith(
        'submission',
        'electron',
        expect.any(ElectronBotService)
      );
      expect(mockRegistry.registerPlugin).toHaveBeenCalledWith(
        'submission',
        'mock',
        expect.any(MockSubmissionService)
      );
    });

    it('should log success message', async () => {
      await registerDefaultPlugins(mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith('Default plugins registered successfully');
    });

    it('should log active plugins configuration', async () => {
      await registerDefaultPlugins(mockLogger);

      expect(mockLogger.verbose).toHaveBeenCalledWith(
        'Active plugins configured',
        {
          data: 'sqlite',
          credentials: 'sqlite',
          submission: 'electron'
        }
      );
    });
  });

  describe('getDataService', () => {
    it('should return plugin from registry for data type', () => {
      const mockService = {};
      mockRegistry.getPlugin = vi.fn().mockReturnValue(mockService);

      const result = getDataService();

      expect(PluginRegistry.getInstance).toHaveBeenCalled();
      expect(mockRegistry.getPlugin).toHaveBeenCalledWith('data');
      expect(result).toBe(mockService);
    });
  });

  describe('getCredentialService', () => {
    it('should return plugin from registry for credentials type', () => {
      const mockService = {};
      mockRegistry.getPlugin = vi.fn().mockReturnValue(mockService);

      const result = getCredentialService();

      expect(PluginRegistry.getInstance).toHaveBeenCalled();
      expect(mockRegistry.getPlugin).toHaveBeenCalledWith('credentials');
      expect(result).toBe(mockService);
    });
  });

  describe('getSubmissionService', () => {
    it('should return plugin from registry for submission type', () => {
      const mockService = {};
      mockRegistry.getPlugin = vi.fn().mockReturnValue(mockService);

      const result = getSubmissionService();

      expect(PluginRegistry.getInstance).toHaveBeenCalled();
      expect(mockRegistry.getPlugin).toHaveBeenCalledWith('submission');
      expect(result).toBe(mockService);
    });
  });
});

