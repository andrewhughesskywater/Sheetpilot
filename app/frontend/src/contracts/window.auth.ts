/**
 * @fileoverview Window API - Authentication
 */

export {};

declare global {
  interface Window {
    /**
     * Authentication and session management
     *
     * Token-based authentication with session persistence.
     * Tokens validated on each use and expire after inactivity.
     */
    auth?: {
      /** Authenticate user and create session */
      login: (
        email: string,
        password: string,
        stayLoggedIn: boolean
      ) => Promise<{
        success: boolean;
        token?: string;
        isAdmin?: boolean;
        error?: string;
      }>;
      /** Validate existing session token */
      validateSession: (
        token: string
      ) => Promise<{ valid: boolean; email?: string; isAdmin?: boolean }>;
      /** End session and invalidate token */
      logout: (token: string) => Promise<{ success: boolean; error?: string }>;
      /** Get current session info */
      getCurrentSession: (
        token: string
      ) => Promise<{ email: string; token: string; isAdmin: boolean } | null>;
    };
  }
}
