import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PluginRegistryConfig } from '@sheetpilot/shared/plugin-types';

// Create mock functions that will be used
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockPathResolve = vi.fn((p: string) => p);

// Mock fs and path for Node.js environment
// Use vi.importActual to get the real module and override specific methods
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync
    },
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync
  };
});

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return {
    ...actual,
    default: {
      ...actual,
      resolve: mockPathResolve
    },
    resolve: mockPathResolve
  };
});

// Import after mocks are set up
import { loadPluginConfig } from '@sheetpilot/shared/plugin-config';

describe('plugin-config', () => {
  const originalWindow = globalThis.window;
  const originalProcessEnv = process.env;
  const _originalConsole = console;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks
    mockExistsSync.mockClear();
    mockReadFileSync.mockClear();
    mockPathResolve.mockClear();
    // Ensure we're in Node.js environment
    delete (globalThis as { window?: typeof window }).window;
    // Reset process.env
    process.env = { ...originalProcessEnv };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as { window: typeof window }).window = originalWindow;
    process.env = originalProcessEnv;
    vi.restoreAllMocks();
  });

  describe('loadPluginConfig', () => {
    it('should return default config when no file path provided', async () => {
      const config = await loadPluginConfig();
      
      expect(config).toBeDefined();
      expect(config.plugins).toBeDefined();
      expect(config.plugins.data.active).toBe('sqlite');
      expect(config.plugins.credentials.active).toBe('sqlite');
      expect(config.plugins.submission.active).toBe('electron');
    });

    it('should load config from file when path provided', async () => {
      const mockConfig: PluginRegistryConfig = {
        plugins: {
          data: { active: 'memory', alternatives: ['sqlite'] },
          credentials: { active: 'sqlite' },
          submission: { active: 'mock', alternatives: ['electron'] }
        },
        featureFlags: {
          experimentalGrid: { enabled: true, variant: 'simple-table' }
        }
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = await loadPluginConfig('/path/to/config.json');

      expect(config.plugins.data.active).toBe('memory');
      expect(config.plugins.submission.active).toBe('mock');
      expect(console.log).toHaveBeenCalledWith(
        'Loaded plugin configuration from file',
        expect.objectContaining({ path: expect.any(String) })
      );
    });

    it('should return default config when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const config = await loadPluginConfig('/path/to/nonexistent.json');

      expect(config.plugins.data.active).toBe('sqlite');
    });

    it('should handle file read errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const config = await loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error loading plugin config'),
        expect.any(Error)
      );
    });

    it('should handle invalid JSON in config file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const config = await loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
      expect(console.error).toHaveBeenCalled();
    });

    it('should load config from environment variable', async () => {
      const envConfig: PluginRegistryConfig = {
        plugins: {
          data: { active: 'memory' },
          credentials: { active: 'sqlite' },
          submission: { active: 'mock' }
        },
        featureFlags: {}
      };

      process.env.SHEETPILOT_PLUGIN_CONFIG = JSON.stringify(envConfig);

      const config = await loadPluginConfig();

      expect(config.plugins.data.active).toBe('memory');
      expect(config.plugins.submission.active).toBe('mock');
    });

    it('should handle invalid environment variable JSON', async () => {
      process.env.SHEETPILOT_PLUGIN_CONFIG = 'invalid json';

      const config = await loadPluginConfig();

      expect(config).toBeDefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing SHEETPILOT_PLUGIN_CONFIG'),
        expect.any(Error)
      );
    });

    it('should merge user config with defaults', async () => {
      const userConfig: Partial<PluginRegistryConfig> = {
        plugins: {
          data: { active: 'memory' }
        }
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(userConfig));

      const config = await loadPluginConfig('/path/to/config.json');

      expect(config.plugins.data.active).toBe('memory');
      expect(config.plugins.credentials.active).toBe('sqlite'); // From defaults
      expect(config.plugins.submission.active).toBe('electron'); // From defaults
    });

    it('should return default config in browser environment', async () => {
      (globalThis as { window?: typeof window }).window = {} as Window & typeof globalThis;

      const config = await loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
      expect(config.plugins.data.active).toBe('sqlite');
    });
  });
});


