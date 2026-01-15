/**
 * @fileoverview Window API - Administrative operations
 */

export {};

declare global {
  interface Window {
    /**
     * Administrative operations (destructive)
     *
     * Requires admin token. All operations are irreversible.
     * Admin users cannot submit timesheets (read-only access).
     */
    admin?: {
      /** Delete all stored credentials (destructive) */
      clearCredentials: (
        token: string
      ) => Promise<{ success: boolean; error?: string }>;
      /** Rebuild database from scratch (destructive - deletes all data) */
      rebuildDatabase: (
        token: string
      ) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
