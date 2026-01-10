/**
 * @fileoverview Plugin Registry System
 *
 * Central plugin management system that handles registration, resolution,
 * and lifecycle management for all plugins in the application.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { createLogger } from "./logger";
import type { IPlugin, PluginConfiguration, PluginRegistryConfig, PluginResolution } from './plugin-types';

const logger = createLogger('plugin-registry');


/**
 * Central registry for managing all application plugins
 * Implements singleton pattern for global access
 */
export class PluginRegistry {
  private static instance: PluginRegistry | null = null;

  /** Registered plugins organized by namespace and name */
  private plugins: Map<string, Map<string, unknown>> = new Map();

  /** Active plugin names by namespace */
  private activePlugins: Map<string, string> = new Map();

  /** Plugin configurations loaded from config file */
  private config: PluginRegistryConfig | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance of the plugin registry
   */
  public static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    PluginRegistry.instance = null;
  }

  /**
   * Load configuration from a config object
   * @param config Plugin registry configuration
   */
  public loadConfig(config: PluginRegistryConfig): void {
    this.config = config;

    // Set active plugins from configuration
    for (const [namespace, pluginConfig] of Object.entries(config.plugins)) {
      if (typeof pluginConfig === 'object' && pluginConfig !== null && 'active' in pluginConfig) {
        this.activePlugins.set(namespace, (pluginConfig as PluginConfiguration).active);
      }
    }
  }

  /**
   * Register a plugin in the registry
   * @param namespace Plugin namespace (e.g., 'data', 'ui', 'credentials')
   * @param name Plugin name within the namespace
   * @param implementation Plugin implementation
   * @returns Promise that resolves when plugin is registered and initialized
   * @throws Error if plugin initialization fails
   */
  public async registerPlugin<T>(namespace: string, name: string, implementation: T): Promise<void> {
    if (!this.plugins.has(namespace)) {
      this.plugins.set(namespace, new Map());
    }

    const namespacePlugins = this.plugins.get(namespace)!;

    if (namespacePlugins.has(name)) {
      console.warn(`Plugin ${namespace}:${name} is already registered. Overwriting.`);
    }

    namespacePlugins.set(name, implementation);

    // Initialize plugin if it implements IPlugin interface
    if (implementation && typeof implementation === 'object' && 'initialize' in implementation) {
      const plugin = implementation as unknown as IPlugin;
      if (plugin.initialize) {
        try {
          await Promise.resolve(plugin.initialize());
        } catch (err) {
          // Remove plugin from registry if initialization fails
          namespacePlugins.delete(name);
          const errorMessage = err instanceof Error ? err.message : String(err);
          throw new Error(`Could not initialize plugin ${namespace}:${name}: ${errorMessage}`);
        }
      }
    }
  }

  /**
   * Get a plugin by namespace and name
   * @param namespace Plugin namespace
   * @param name Plugin name (optional, uses active plugin if not specified)
   * @returns The plugin instance or null if not found
   */
  public getPlugin<T = unknown>(namespace: string, name?: string): T | null {
    const targetName = name || this.activePlugins.get(namespace);

    if (!targetName) {
      // Use debug level during initialization to avoid noise
      logger.verbose(`No plugin name specified and no active plugin for namespace: ${namespace}`);
      return null;
    }

    const namespacePlugins = this.plugins.get(namespace);
    if (!namespacePlugins) {
      logger.verbose(`No plugins registered for namespace: ${namespace}`);
      return null;
    }

    const plugin = namespacePlugins.get(targetName);
    if (!plugin) {
      logger.warn(`Plugin ${namespace}:${targetName} not found`);
      return null;
    }

    return plugin as T;
  }

  /**
   * Get a plugin with fallback support
   * @param namespace Plugin namespace
   * @param name Plugin name
   * @param fallbackName Fallback plugin name if primary not found
   * @returns Plugin resolution result
   */
  public getPluginWithFallback<T = unknown>(
    namespace: string,
    name: string,
    fallbackName?: string
  ): PluginResolution<T> | null {
    let plugin = this.getPlugin<T>(namespace, name);

    if (plugin) {
      return {
        plugin,
        name,
        isFallback: false,
      };
    }

    if (fallbackName) {
      plugin = this.getPlugin<T>(namespace, fallbackName);
      if (plugin) {
        console.warn(`Using fallback plugin ${namespace}:${fallbackName} instead of ${name}`);
        return {
          plugin,
          name: fallbackName,
          isFallback: true,
        };
      }
    }

    return null;
  }

  /**
   * Get the active plugin name for a namespace
   * @param namespace Plugin namespace
   * @returns Active plugin name or null
   */
  public getActivePluginName(namespace: string): string | null {
    return this.activePlugins.get(namespace) || null;
  }

  /**
   * Set the active plugin for a namespace
   * @param namespace Plugin namespace
   * @param name Plugin name to make active
   */
  public setActivePlugin(namespace: string, name: string): void {
    const namespacePlugins = this.plugins.get(namespace);
    if (!namespacePlugins || !namespacePlugins.has(name)) {
      throw new Error(`Cannot set active plugin: ${namespace}:${name} is not registered`);
    }

    this.activePlugins.set(namespace, name);
  }

  /**
   * List all registered plugins in a namespace
   * @param namespace Plugin namespace
   * @returns Array of plugin names
   */
  public listPlugins(namespace: string): string[] {
    const namespacePlugins = this.plugins.get(namespace);
    if (!namespacePlugins) {
      return [];
    }

    return Array.from(namespacePlugins.keys());
  }

  /**
   * List all namespaces
   * @returns Array of namespace names
   */
  public listNamespaces(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if a plugin is registered
   * @param namespace Plugin namespace
   * @param name Plugin name
   * @returns True if plugin is registered
   */
  public hasPlugin(namespace: string, name: string): boolean {
    const namespacePlugins = this.plugins.get(namespace);
    return namespacePlugins ? namespacePlugins.has(name) : false;
  }

  /**
   * Unregister a plugin
   * @param namespace Plugin namespace
   * @param name Plugin name
   * @throws Error if plugin disposal fails
   */
  public async unregisterPlugin(namespace: string, name: string): Promise<void> {
    const namespacePlugins = this.plugins.get(namespace);
    if (!namespacePlugins) {
      return;
    }

    const plugin = namespacePlugins.get(name);
    if (!plugin) {
      return;
    }

    // Dispose plugin if it implements IPlugin interface
    if (plugin && typeof plugin === 'object' && 'dispose' in plugin) {
      const pluginWithDispose = plugin as unknown as IPlugin;
      if (pluginWithDispose.dispose) {
        try {
          await Promise.resolve(pluginWithDispose.dispose());
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          throw new Error(`Could not dispose plugin ${namespace}:${name}: ${errorMessage}`);
        }
      }
    }

    namespacePlugins.delete(name);

    // If this was the active plugin, clear it
    if (this.activePlugins.get(namespace) === name) {
      this.activePlugins.delete(namespace);
    }
  }

  /**
   * Get the configuration for a namespace
   * @param namespace Plugin namespace
   * @returns Plugin configuration or null
   */
  public getNamespaceConfig(namespace: string): PluginConfiguration | null {
    if (!this.config || !this.config.plugins[namespace]) {
      return null;
    }

    const config = this.config.plugins[namespace];
    if (typeof config === 'object' && config !== null && 'active' in config) {
      return config as PluginConfiguration;
    }

    return null;
  }

  /**
   * Get a feature flag value
   * @param flagName Feature flag name
   * @returns Feature flag or null if not found
   */
  public getFeatureFlag(flagName: string): boolean {
    if (!this.config || !this.config.featureFlags) {
      return false;
    }

    const flag = this.config.featureFlags[flagName];
    return flag ? flag.enabled : false;
  }

  /**
   * Get feature flag configuration
   * @param flagName Feature flag name
   * @returns Complete feature flag configuration or null
   */
  public getFeatureFlagConfig(flagName: string): import('./plugin-types').FeatureFlag | null {
    if (!this.config || !this.config.featureFlags) {
      return null;
    }

    return this.config.featureFlags[flagName] || null;
  }
}
