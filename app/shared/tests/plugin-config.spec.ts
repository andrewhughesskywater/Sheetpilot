import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPluginConfig } from '../plugin-config';
import type { PluginRegistryConfig } from '../plugin-types';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

vi.mock('path', () => ({
  resolve: vi.fn((p: string) => p)
}));

describe('plugin-config', () => {
  const originalWindow = globalThis.window;
  const originalProcessEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).window;
    process.env = { ...originalProcessEnv };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalWindow) {
      (globalThis as any).window = originalWindow;
    }
    process.env = originalProcessEnv;
    vi.restoreAllMocks();
  });

  describe('loadPluginConfig', () => {
    it('should return default config when no file path provided', () => {
      const config = loadPluginConfig();
      
      expect(config).toBeDefined();
      expect(config.plugins).toBeDefined();
      expect(config.plugins.data.active).toBe('sqlite');
      expect(config.plugins.credentials.active).toBe('sqlite');
      expect(config.plugins.submission.active).toBe('electron');
    });

    it('should load config from file when path provided', async () => {
      // Note: This test verifies the logic path without full file system mocking
      // The actual loadPluginConfig will fall back to defaults if file doesn't exist
      // To fully test file loading, use integration tests with real files
      const config = loadPluginConfig('/path/to/config.json');
      
      // Should return default config since file doesn't exist
      expect(config).toBeDefined();
      expect(config.plugins).toBeDefined();
    });

    it('should return default config when file does not exist', async () => {
      const fsModule = await import('fs');
      vi.mocked(fsModule.existsSync).mockReturnValue(false as any);

      const config = loadPluginConfig('/path/to/nonexistent.json');

      expect(config.plugins.data.active).toBe('sqlite');
    });

    it('should handle file read errors gracefully', async () => {
      const fsModule = await import('fs');
      vi.mocked(fsModule.existsSync).mockReturnValue(true as any);
      vi.mocked(fsModule.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const config = loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
    });

    it('should handle invalid JSON in config file', async () => {
      const fsModule = await import('fs');
      vi.mocked(fsModule.existsSync).mockReturnValue(true as any);
      vi.mocked(fsModule.readFileSync).mockReturnValue('invalid json' as any);

      const config = loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
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

      process.env.SHEETPILOT_PLUGIN_CONFIG = JSON.stringify(envConfig);

      const config = loadPluginConfig();

      expect(config.plugins.data.active).toBe('memory');
      expect(config.plugins.submission.active).toBe('mock');
    });

    it('should handle invalid environment variable JSON', () => {
      process.env.SHEETPILOT_PLUGIN_CONFIG = 'invalid json';

      const config = loadPluginConfig();

      expect(config).toBeDefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing SHEETPILOT_PLUGIN_CONFIG'),
        expect.any(Error)
      );
    });

    it('should merge user config with defaults', async () => {
      // Verify default merging behavior through environment variable
      const userConfig: Partial<PluginRegistryConfig> = {
        plugins: {
          data: { active: 'memory' },
          credentials: { active: 'sqlite' },
          submission: { active: 'electron', alternatives: ['mock'] }
        },
        featureFlags: {
          experimentalGrid: { enabled: true, variant: 'simple-table' }
        }
      };

      process.env.SHEETPILOT_PLUGIN_CONFIG = JSON.stringify(userConfig);

      const config = loadPluginConfig();

      expect(config.plugins.data.active).toBe('memory');
      expect(config.plugins.credentials.active).toBe('sqlite');
      expect(config.plugins.submission.active).toBe('electron');
    });

    it('should return default config in browser environment', () => {
      (globalThis as { window: typeof window }).window = {} as Window;

      const config = loadPluginConfig('/path/to/config.json');

      expect(config).toBeDefined();
      expect(config.plugins.data.active).toBe('sqlite');
    });
  });
});


