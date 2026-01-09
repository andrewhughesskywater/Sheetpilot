/**
 * @fileoverview Plugin Registry Utilities
 *
 * Utilities for working with the plugin registry in the middleware layer.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { loadPluginConfig } from '@sheetpilot/shared/plugin-config';
import { PluginRegistry } from '@sheetpilot/shared/plugin-registry';

/**
 * Get the plugin registry instance
 */
export function getRegistry(): PluginRegistry {
  return PluginRegistry.getInstance();
}

/**
 * Load plugin configuration into the registry
 */
export function loadRegistryConfig(configPath: string): void {
  const config = loadPluginConfig(configPath);
  getRegistry().loadConfig(config);
}
