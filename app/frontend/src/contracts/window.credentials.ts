/**
 * @fileoverview Window API - Credential storage
 */

export {};

declare global {
  interface Window {
    /**
     * Secure credential storage
     *
     * Stores encrypted credentials in system keychain/credential store.
     * Passwords never stored in plain text.
     */
    credentials?: {
      /** Store credentials securely */
      store: (
        service: string,
        email: string,
        password: string
      ) => Promise<{ success: boolean; message: string; changes: number }>;
      /** List all stored credential services */
      list: () => Promise<{
        success: boolean;
        credentials: Array<{
          id: number;
          service: string;
          email: string;
          created_at: string;
          updated_at: string;
        }>;
        error?: string;
      }>;
      /** Delete credentials for a service */
      delete: (
        service: string
      ) => Promise<{ success: boolean; message: string; changes: number }>;
    };
  }
}
