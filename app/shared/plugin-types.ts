/**
 * @fileoverview Plugin Type Definitions
 * 
 * Core type definitions for the plugin system, including metadata,
 * configuration, and feature flags for A/B testing.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

/**
 * Plugin metadata containing information about the plugin
 */
export interface PluginMetadata {
  /** Plugin name (must be unique within namespace) */
  name: string;
  /** Plugin version following semver */
  version: string;
  /** Plugin author */
  author: string;
  /** Plugin description */
  description?: string;
  /** Minimum required host version */
  minHostVersion?: string;
  /** Plugin dependencies (other plugins required) */
  dependencies?: string[];
}

/**
 * Base interface that all plugins must implement
 */
export interface IPlugin {
  /** Plugin metadata */
  readonly metadata: PluginMetadata;
  /** Initialize the plugin */
  initialize?(): Promise<void> | void;
  /** Cleanup when plugin is unloaded */
  dispose?(): Promise<void> | void;
}

/**
 * Plugin configuration for runtime behavior
 */
export interface PluginConfiguration {
  /** Active plugin name for this namespace */
  active: string;
  /** Alternative plugin names available */
  alternatives?: string[];
  /** Plugin-specific configuration options */
  options?: Record<string, unknown>;
}

/**
 * Feature flag configuration for A/B testing
 */
export interface FeatureFlag {
  /** Whether the feature flag is enabled */
  enabled: boolean;
  /** Which variant to use when enabled */
  variant?: string;
  /** Percentage of users to enable (0-100) */
  rolloutPercentage?: number;
  /** User IDs or emails to force enable */
  allowList?: string[];
  /** User IDs or emails to force disable */
  denyList?: string[];
}

/**
 * Complete plugin registry configuration
 */
export interface PluginRegistryConfig {
  /** Plugin configurations by namespace */
  plugins: Record<string, PluginConfiguration>;
  /** Feature flags for A/B testing */
  featureFlags?: Record<string, FeatureFlag>;
}

/**
 * Plugin resolution result
 */
export interface PluginResolution<T = unknown> {
  /** The resolved plugin instance */
  plugin: T;
  /** The name of the plugin that was resolved */
  name: string;
  /** Whether this was the requested plugin or a fallback */
  isFallback: boolean;
}

