/**
 * @fileoverview Plugin Configuration Loader
 * 
 * Handles loading plugin configuration from JSON files or environment variables,
 * feature flag resolution, and plugin selection logic.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { PluginRegistryConfig, FeatureFlag } from './plugin-types';

/**
 * Default plugin configuration
 * Used when no config file is present
 */
const DEFAULT_CONFIG: PluginRegistryConfig = {
  plugins: {
    data: { active: 'sqlite', alternatives: ['memory'] },
    credentials: { active: 'sqlite' },
    submission: { active: 'playwright', alternatives: ['mock'] },
    ui: { 
      active: 'handsontable',
      alternatives: ['simple-table']
    }
  },
  featureFlags: {
    experimentalGrid: { enabled: false, variant: 'simple-table' },
    mockSubmission: { enabled: false }
  }
};

/**
 * Load plugin configuration from a JSON object or file
 * @param configPath Optional path to config file (for Node.js/Electron main process)
 * @returns Plugin registry configuration
 */
export function loadPluginConfig(configPath?: string): PluginRegistryConfig {
  // In browser/renderer, we can't load files directly
  // Configuration should be passed via IPC or bundled
  if (typeof window !== 'undefined') {
    return loadConfigFromEnvironment() || DEFAULT_CONFIG;
  }

  // In Node.js/Electron main process, try to load from file
  if (configPath) {
    try {
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.resolve(configPath);
      
      if (fs.existsSync(fullPath)) {
        const configData = fs.readFileSync(fullPath, 'utf-8');
        const config = JSON.parse(configData) as PluginRegistryConfig;
        console.log(`Loaded plugin configuration from ${fullPath}`);
        return mergeWithDefaults(config);
      }
    } catch (error) {
      console.error(`Error loading plugin config from ${configPath}:`, error);
    }
  }

  // Fall back to environment variables or defaults
  return loadConfigFromEnvironment() || DEFAULT_CONFIG;
}

/**
 * Load configuration from environment variables
 * @returns Plugin configuration from environment or null
 */
function loadConfigFromEnvironment(): PluginRegistryConfig | null {
  const envConfig = process.env['SHEETPILOT_PLUGIN_CONFIG'];
  
  if (envConfig) {
    try {
      return JSON.parse(envConfig) as PluginRegistryConfig;
    } catch (error) {
      console.error('Error parsing SHEETPILOT_PLUGIN_CONFIG environment variable:', error);
    }
  }
  
  return null;
}

/**
 * Merge user configuration with defaults
 * @param userConfig User-provided configuration
 * @returns Merged configuration
 */
function mergeWithDefaults(userConfig: Partial<PluginRegistryConfig>): PluginRegistryConfig {
  return {
    plugins: {
      ...DEFAULT_CONFIG.plugins,
      ...userConfig.plugins
    },
    featureFlags: {
      ...DEFAULT_CONFIG.featureFlags,
      ...userConfig.featureFlags
    }
  };
}

/**
 * Resolve which plugin variant to use based on feature flags
 * @param namespace Plugin namespace
 * @param config Plugin registry configuration
 * @returns Plugin name to use
 */
export function resolvePluginVariant(namespace: string, config: PluginRegistryConfig): string {
  const pluginConfig = config.plugins[namespace];
  
  if (!pluginConfig || typeof pluginConfig !== 'object') {
    throw new Error(`No configuration found for namespace: ${namespace}`);
  }

  const baseActive = 'active' in pluginConfig ? pluginConfig.active as string : '';
  
  // Check feature flags that might override the active plugin
  if (config.featureFlags) {
    for (const [flagName, flag] of Object.entries(config.featureFlags)) {
      if (flag.enabled && flag.variant && flagName.toLowerCase().includes(namespace.toLowerCase())) {
        // Feature flag is enabled and specifies a variant
        if (shouldEnableForUser(flag)) {
          console.log(`Feature flag ${flagName} enabled, using variant: ${flag.variant}`);
          return flag.variant;
        }
      }
    }
  }
  
  return baseActive;
}

/**
 * Determine if a feature flag should be enabled for the current user
 * @param flag Feature flag configuration
 * @returns True if feature should be enabled
 */
function shouldEnableForUser(flag: FeatureFlag): boolean {
  if (!flag.enabled) {
    return false;
  }
  
  // Check deny list first
  if (flag.denyList && flag.denyList.length > 0) {
    const userId = getCurrentUserId();
    if (userId && flag.denyList.includes(userId)) {
      return false;
    }
  }
  
  // Check allow list
  if (flag.allowList && flag.allowList.length > 0) {
    const userId = getCurrentUserId();
    if (userId && flag.allowList.includes(userId)) {
      return true;
    }
    // If allow list exists but user not in it, don't enable unless rollout says so
  }
  
  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined) {
    const userHash = getUserHash();
    const threshold = flag.rolloutPercentage / 100;
    return userHash < threshold;
  }
  
  // Default: enabled
  return true;
}

/**
 * Get current user ID from environment or system
 * @returns User ID or null
 */
function getCurrentUserId(): string | null {
  // Try environment variable first
  if (process.env['SHEETPILOT_USER_ID']) {
    return process.env['SHEETPILOT_USER_ID'];
  }
  
  // Try to get from OS username
  if (typeof process !== 'undefined' && process.env) {
    return process.env['USERNAME'] || process.env['USER'] || null;
  }
  
  return null;
}

/**
 * Get a deterministic hash for the current user (0.0 to 1.0)
 * Used for rollout percentage calculations
 * @returns Hash value between 0 and 1
 */
function getUserHash(): number {
  const userId = getCurrentUserId() || 'anonymous';
  
  // Simple hash function (not cryptographically secure, but deterministic)
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Normalize to 0-1 range
  return Math.abs(hash % 1000) / 1000;
}

/**
 * Create a plugin configuration object
 * @param overrides Configuration overrides
 * @returns Complete plugin configuration
 */
export function createPluginConfig(overrides?: Partial<PluginRegistryConfig>): PluginRegistryConfig {
  return mergeWithDefaults(overrides || {});
}

