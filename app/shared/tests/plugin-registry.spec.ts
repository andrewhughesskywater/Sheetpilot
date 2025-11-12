/**
 * @fileoverview Plugin Registry Tests
 * 
 * Tests for the central plugin management system including registration,
 * resolution, lifecycle management, and fallback mechanisms.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry } from '../plugin-registry';
import type { IPlugin } from '../plugin-types';

describe('Plugin Registry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    // Reset singleton before each test
    PluginRegistry.resetInstance();
    registry = PluginRegistry.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple getInstance calls', () => {
      const instance1 = PluginRegistry.getInstance();
      const instance2 = PluginRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = PluginRegistry.getInstance();
      PluginRegistry.resetInstance();
      const instance2 = PluginRegistry.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Plugin Registration', () => {
    it('should register plugin successfully', () => {
      const mockPlugin: IPlugin = { 
        metadata: { name: 'test', version: '1.0.0', author: 'test' },
        initialize: vi.fn() 
      };
      
      registry.registerPlugin('data', 'mock-plugin', mockPlugin);
      
      expect(registry.hasPlugin('data', 'mock-plugin')).toBe(true);
    });

    it('should register plugins in different namespaces', () => {
      registry.registerPlugin('data', 'plugin1', { 
        metadata: { name: 'data-plugin', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('ui', 'plugin2', { 
        metadata: { name: 'ui-plugin', version: '1.0.0', author: 'test' } 
      });
      
      expect(registry.hasPlugin('data', 'plugin1')).toBe(true);
      expect(registry.hasPlugin('ui', 'plugin2')).toBe(true);
    });

    it('should warn when overwriting existing plugin', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      registry.registerPlugin('data', 'plugin', { 
        metadata: { name: 'version1', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('data', 'plugin', { 
        metadata: { name: 'version2', version: '1.0.0', author: 'test' } 
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should call initialize on plugin registration', async () => {
      const mockPlugin: IPlugin = {
        metadata: { name: 'test', version: '1.0.0', author: 'test' },
        initialize: vi.fn().mockResolvedValue(undefined)
      };
      
      registry.registerPlugin('data', 'test-plugin', mockPlugin);
      
      // Give initialization a moment to run
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockPlugin.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const mockPlugin: IPlugin = {
        metadata: { name: 'test', version: '1.0.0', author: 'test' },
        initialize: vi.fn().mockRejectedValue(new Error('Init failed'))
      };
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      registry.registerPlugin('data', 'failing-plugin', mockPlugin);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('Plugin Resolution', () => {
    beforeEach(() => {
      registry.registerPlugin('data', 'sqlite', { 
        metadata: { name: 'sqlite-plugin', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('data', 'memory', { 
        metadata: { name: 'memory-plugin', version: '1.0.0', author: 'test' } 
      });
      registry.setActivePlugin('data', 'sqlite');
    });

    it('should get plugin by namespace and name', () => {
      const plugin = registry.getPlugin<IPlugin>('data', 'sqlite');
      
      expect(plugin).toBeDefined();
      expect(plugin!.metadata.name).toBe('sqlite-plugin');
    });

    it('should get active plugin when name not specified', () => {
      const plugin = registry.getPlugin<IPlugin>('data');
      
      expect(plugin).toBeDefined();
      expect(plugin!.metadata.name).toBe('sqlite-plugin');
    });

    it('should return null for non-existent plugin', () => {
      const plugin = registry.getPlugin('data', 'nonexistent');
      
      expect(plugin).toBeNull();
    });

    it('should return null for non-existent namespace', () => {
      const plugin = registry.getPlugin('nonexistent', 'plugin');
      
      expect(plugin).toBeNull();
    });

    it('should return null when no active plugin set', () => {
      PluginRegistry.resetInstance();
      const newRegistry = PluginRegistry.getInstance();
      
      const plugin = newRegistry.getPlugin('data');
      
      expect(plugin).toBeNull();
    });
  });

  describe('Plugin Fallback', () => {
    beforeEach(() => {
      registry.registerPlugin('data', 'primary', { 
        metadata: { name: 'primary-plugin', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('data', 'fallback', { 
        metadata: { name: 'fallback-plugin', version: '1.0.0', author: 'test' } 
      });
    });

    it('should return primary plugin when available', () => {
      const result = registry.getPluginWithFallback('data', 'primary', 'fallback');
      
      expect(result).toBeDefined();
      expect(result!.name).toBe('primary');
      expect(result!.isFallback).toBe(false);
    });

    it('should return fallback when primary unavailable', () => {
      const result = registry.getPluginWithFallback('data', 'nonexistent', 'fallback');
      
      expect(result).toBeDefined();
      expect(result!.name).toBe('fallback');
      expect(result!.isFallback).toBe(true);
    });

    it('should return null when both unavailable', () => {
      const result = registry.getPluginWithFallback('data', 'nonexistent1', 'nonexistent2');
      
      expect(result).toBeNull();
    });

    it('should warn when using fallback', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      registry.getPluginWithFallback('data', 'nonexistent', 'fallback');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Active Plugin Management', () => {
    beforeEach(() => {
      registry.registerPlugin('data', 'sqlite', { 
        metadata: { name: 'sqlite', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('data', 'memory', { 
        metadata: { name: 'memory', version: '1.0.0', author: 'test' } 
      });
    });

    it('should set active plugin', () => {
      registry.setActivePlugin('data', 'sqlite');
      
      const activeName = registry.getActivePluginName('data');
      expect(activeName).toBe('sqlite');
    });

    it('should change active plugin', () => {
      registry.setActivePlugin('data', 'sqlite');
      expect(registry.getActivePluginName('data')).toBe('sqlite');
      
      registry.setActivePlugin('data', 'memory');
      expect(registry.getActivePluginName('data')).toBe('memory');
    });

    it('should throw when setting non-existent plugin as active', () => {
      expect(() => {
        registry.setActivePlugin('data', 'nonexistent');
      }).toThrow();
    });

    it('should return null for namespace without active plugin', () => {
      const activeName = registry.getActivePluginName('nonexistent');
      expect(activeName).toBeNull();
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should call dispose on plugin unregistration', async () => {
      const mockPlugin: IPlugin = {
        metadata: { name: 'test', version: '1.0.0', author: 'test' },
        initialize: vi.fn(),
        dispose: vi.fn().mockResolvedValue(undefined)
      };
      
      registry.registerPlugin('data', 'disposable', mockPlugin);
      await registry.unregisterPlugin('data', 'disposable');
      
      expect(mockPlugin.dispose).toHaveBeenCalled();
    });

    it('should handle dispose errors gracefully', async () => {
      const mockPlugin: IPlugin = {
        metadata: { name: 'test', version: '1.0.0', author: 'test' },
        dispose: vi.fn().mockRejectedValue(new Error('Dispose failed'))
      };
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      registry.registerPlugin('data', 'failing', mockPlugin);
      await registry.unregisterPlugin('data', 'failing');
      
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('should clear active plugin on unregister', async () => {
      registry.registerPlugin('data', 'plugin', { 
        metadata: { name: 'test', version: '1.0.0', author: 'test' } 
      });
      registry.setActivePlugin('data', 'plugin');
      
      await registry.unregisterPlugin('data', 'plugin');
      
      expect(registry.getActivePluginName('data')).toBeNull();
    });

    it('should handle unregistering non-existent plugin', async () => {
      await expect(registry.unregisterPlugin('data', 'nonexistent')).resolves.not.toThrow();
    });
  });

  describe('Plugin Discovery', () => {
    beforeEach(() => {
      registry.registerPlugin('data', 'sqlite', { 
        metadata: { name: 'sqlite', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('data', 'memory', { 
        metadata: { name: 'memory', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('ui', 'theme', { 
        metadata: { name: 'theme', version: '1.0.0', author: 'test' } 
      });
    });

    it('should list all plugins in namespace', () => {
      const plugins = registry.listPlugins('data');
      
      expect(plugins).toContain('sqlite');
      expect(plugins).toContain('memory');
      expect(plugins).toHaveLength(2);
    });

    it('should return empty array for non-existent namespace', () => {
      const plugins = registry.listPlugins('nonexistent');
      
      expect(plugins).toEqual([]);
    });

    it('should list all namespaces', () => {
      const namespaces = registry.listNamespaces();
      
      expect(namespaces).toContain('data');
      expect(namespaces).toContain('ui');
    });

    it('should check if plugin exists', () => {
      expect(registry.hasPlugin('data', 'sqlite')).toBe(true);
      expect(registry.hasPlugin('data', 'nonexistent')).toBe(false);
      expect(registry.hasPlugin('nonexistent', 'plugin')).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should load configuration', () => {
      const config = {
        plugins: {
          data: {
            active: 'sqlite',
            fallback: 'memory'
          }
        },
        featureFlags: {}
      };
      
      registry.loadConfig(config);
      
      expect(registry.getActivePluginName('data')).toBe('sqlite');
    });

    it('should get namespace configuration', () => {
      const config = {
        plugins: {
          data: {
            active: 'sqlite',
            fallback: 'memory'
          }
        },
        featureFlags: {}
      };
      
      registry.loadConfig(config);
      
      const namespaceConfig = registry.getNamespaceConfig('data');
      expect(namespaceConfig).toBeDefined();
      expect(namespaceConfig!.active).toBe('sqlite');
    });

    it('should return null for non-existent namespace config', () => {
      const config = registry.getNamespaceConfig('nonexistent');
      expect(config).toBeNull();
    });
  });

  describe('Feature Flags', () => {
    it('should get feature flag value', () => {
      const config = {
        plugins: {},
        featureFlags: {
          'new-feature': { enabled: true, description: 'Test feature' }
        }
      };
      
      registry.loadConfig(config);
      
      const flag = registry.getFeatureFlag('new-feature');
      expect(flag).toBe(true);
    });

    it('should return false for non-existent flag', () => {
      const flag = registry.getFeatureFlag('nonexistent');
      expect(flag).toBe(false);
    });

    it('should get full feature flag configuration', () => {
      const config = {
        plugins: {},
        featureFlags: {
          'test-flag': { enabled: true, variant: 'test-variant', rolloutPercentage: 50 }
        }
      };
      
      registry.loadConfig(config);
      
      const flagConfig = registry.getFeatureFlagConfig('test-flag');
      expect(flagConfig).toBeDefined();
      expect(flagConfig!.enabled).toBe(true);
      expect(flagConfig!.variant).toBe('test-variant');
    });
  });

  describe('Namespace Isolation', () => {
    it('should isolate plugins in different namespaces', () => {
      registry.registerPlugin('namespace1', 'plugin', { 
        metadata: { name: 'plugin1', version: '1.0.0', author: 'test' } 
      });
      registry.registerPlugin('namespace2', 'plugin', { 
        metadata: { name: 'plugin2', version: '1.0.0', author: 'test' } 
      });
      
      const plugin1 = registry.getPlugin<IPlugin>('namespace1', 'plugin');
      const plugin2 = registry.getPlugin<IPlugin>('namespace2', 'plugin');
      
      expect(plugin1!.metadata.name).toBe('plugin1');
      expect(plugin2!.metadata.name).toBe('plugin2');
    });

    it('should not leak plugins across namespaces', () => {
      registry.registerPlugin('namespace1', 'plugin1', { 
        metadata: { name: 'test', version: '1.0.0', author: 'test' } 
      });
      
      expect(registry.hasPlugin('namespace1', 'plugin1')).toBe(true);
      expect(registry.hasPlugin('namespace2', 'plugin1')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty namespace name', () => {
      registry.registerPlugin('', 'plugin', { 
        metadata: { name: 'test', version: '1.0.0', author: 'test' } 
      });
      
      expect(registry.hasPlugin('', 'plugin')).toBe(true);
    });

    it('should handle empty plugin name', () => {
      registry.registerPlugin('data', '', { 
        metadata: { name: 'test', version: '1.0.0', author: 'test' } 
      });
      
      expect(registry.hasPlugin('data', '')).toBe(true);
    });

    it('should handle null plugin implementation', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        registry.registerPlugin('data', 'null-plugin', null as any);
      }).not.toThrow();
    });

    it('should handle undefined plugin implementation', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        registry.registerPlugin('data', 'undefined-plugin', undefined as any);
      }).not.toThrow();
    });

    it('should handle registering non-IPlugin objects', () => {
      const plainObject = { data: 'test' };
      
      registry.registerPlugin('data', 'plain', plainObject);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retrieved = registry.getPlugin<any>('data', 'plain');
      expect(retrieved).toEqual(plainObject);
    });
  });

  describe('Plugin Discovery Performance', () => {
    it('should handle many plugins efficiently', () => {
      // Register 100 plugins
      for (let i = 0; i < 100; i++) {
        registry.registerPlugin('data', `plugin${i}`, { 
          metadata: { name: `plugin${i}`, version: '1.0.0', author: 'test' } 
        });
      }
      
      const startTime = Date.now();
      const plugins = registry.listPlugins('data');
      const duration = Date.now() - startTime;
      
      expect(plugins).toHaveLength(100);
      expect(duration).toBeLessThan(100);
    });

    it('should lookup plugins efficiently', () => {
      for (let i = 0; i < 100; i++) {
        registry.registerPlugin('data', `plugin${i}`, { 
          metadata: { name: `plugin${i}`, version: '1.0.0', author: 'test' } 
        });
      }
      
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        registry.getPlugin('data', `plugin${i}`);
      }
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100);
    });
  });
});

