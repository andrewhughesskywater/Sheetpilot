/**
 * @fileoverview Window API - Application settings
 */

export {};

declare global {
  interface Window {
    /**
     * Application settings
     *
     * Persistent key-value storage for application configuration.
     */
    settings?: {
      /** Get setting value by key */
      get: (
        key: string
      ) => Promise<{ success: boolean; value?: unknown; error?: string }>;
      /** Set setting value by key */
      set: (
        key: string,
        value: unknown
      ) => Promise<{ success: boolean; error?: string }>;
      /** Get all settings */
      getAll: () => Promise<{
        success: boolean;
        settings?: Record<string, unknown>;
        error?: string;
      }>;
    };
  }
}
