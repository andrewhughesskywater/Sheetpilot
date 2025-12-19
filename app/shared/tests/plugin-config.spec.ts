import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPluginConfig } from '../plugin-config';
import type { PluginRegistryConfig } from '../plugin-types';

// Mock fs and path for Node.js environment
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn()
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    resolve: vi.fn((p: string) => p)
  };
});

describe('plugin-config', () => {
  const originalWindow = globalThis.window;
  const originalProcessEnv = process.env;
  const _originalConsole = console;

  beforeEach(() => {
    vi.clearAllMocks();
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
    it('should return default config when no file path provided', () => {
      const config = loadPluginConfig();
      
      expect(config).toBeDefined();
      expect(config.plugins).toBeDefined();
      expect(config.plugins['data'].active).toBe('sqlite');
      expect(config.plugins['credentials'].active).toBe('sqlite');
      expect(config.plugins['submission'].active).toBe('electron');
    });

    it('should load config from file when path provided', () => {
      const fs = require('fs');
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

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const config = loadPluginConfig('/path/to/config.json');

      expect(config.plugins['data'].active).toBe('memory');
      expect(config.plugins['submission'].active).toBe('mock');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Loaded plugin configuration')
      );
    });

    it('should return default config when file does not exist', () => {
      const fs = require('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = loadPluginConfig('/path/to/nonexistent.json');

      expect(config.plugins['data'].active).toBe('sqlite');
    });

    it('should handle file read errors gracefully', () => {
      const fs = require('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const config = loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error loading plugin config'),
        expect.any(Error)
      );
    });

    it('should handle invalid JSON in config file', () => {
      const fs = require('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const config = loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
      expect(console.error).toHaveBeenCalled();
    });

    it('should load config from environment variable', () => {
      const envConfig: PluginRegistryConfig = {
        plugins: {
          data: { active: 'memory' },
          credentials: { active: 'sqlite' },
          submission: { active: 'mock' }
        },
        featureFlags: {}
      };

      process['env']['SHEETPILOT_PLUGIN_CONFIG'] = JSON.stringify(envConfig);

      const config = loadPluginConfig();

      expect(config.plugins['data'].active).toBe('memory');
      expect(config.plugins['submission'].active).toBe('mock');
    });

    it('should handle invalid environment variable JSON', () => {
      process['env']['SHEETPILOT_PLUGIN_CONFIG'] = 'invalid json';

      const config = loadPluginConfig();

      expect(config).toBeDefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing SHEETPILOT_PLUGIN_CONFIG'),
        expect.any(Error)
      );
    });

    it('should merge user config with defaults', () => {
      const fs = require('fs');
      const userConfig: Partial<PluginRegistryConfig> = {
        plugins: {
          data: { active: 'memory' }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(userConfig));

      const config = loadPluginConfig('/path/to/config.json');

      expect(config.plugins['data'].active).toBe('memory');
      expect(config.plugins['credentials'].active).toBe('sqlite'); // From defaults
      expect(config.plugins['submission'].active).toBe('electron'); // From defaults
    });

    it('should return default config in browser environment', () => {
      (globalThis as { window: typeof window }).window = {} as Window & typeof globalThis;

      const config = loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
      expect(config.plugins['data'].active).toBe('sqlite');
    });
  });
});


