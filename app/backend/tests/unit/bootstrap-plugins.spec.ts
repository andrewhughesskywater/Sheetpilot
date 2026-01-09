import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import {
  registerDefaultPlugins,
  getDataService,
  getCredentialService,
  getSubmissionService
} from '@/middleware/bootstrap-plugins';
import { PluginRegistry } from '@sheetpilot/shared/plugin-registry';
import { loadPluginConfig } from '@sheetpilot/shared/plugin-config';
import { SQLiteDataService } from '@/services/plugins/sqlite-data-service';
import { MemoryDataService } from '@/services/plugins/memory-data-service';
import { SQLiteCredentialService } from '@/services/plugins/sqlite-credential-service';
import { ElectronBotService } from '@/services/plugins/electron-bot-service';
import { MockSubmissionService } from '@/services/plugins/mock-submission-service';
import { appLogger } from '@sheetpilot/shared/logger';

// Mock dependencies
vi.mock('../../../shared/plugin-registry');
vi.mock('../../../shared/plugin-config');
vi.mock('@/services/plugins/sqlite-data-service');
vi.mock('@/services/plugins/memory-data-service');
vi.mock('@/services/plugins/sqlite-credential-service');
vi.mock('@/services/plugins/electron-bot-service');
vi.mock('@/services/plugins/mock-submission-service');
vi.mock('../../../shared/logger');
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
    vi.mocked(loadPluginConfig).mockReturnValue({} as ReturnType<typeof loadPluginConfig>);
  });

  describe('registerDefaultPlugins', () => {
    it('should load plugin configuration', async () => {
      await registerDefaultPlugins();

      expect(path.join).toHaveBeenCalledWith(process.cwd(), 'plugin-config.json');
      expect(loadPluginConfig).toHaveBeenCalled();
      expect(mockRegistry.loadConfig).toHaveBeenCalled();
    });

    it('should register all data services', async () => {
      await registerDefaultPlugins();

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
      await registerDefaultPlugins();

      expect(mockRegistry.registerPlugin).toHaveBeenCalledWith(
        'credentials',
        'sqlite',
        expect.any(SQLiteCredentialService)
      );
    });

    it('should register submission services', async () => {
      await registerDefaultPlugins();

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
      await registerDefaultPlugins();

      expect(appLogger.info).toHaveBeenCalledWith('Default plugins registered successfully');
    });

    it('should log active plugins configuration', async () => {
      await registerDefaultPlugins();

      expect(appLogger.verbose).toHaveBeenCalledWith(
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

