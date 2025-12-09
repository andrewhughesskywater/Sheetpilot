/**
 * @fileoverview Session Context Provider
 * 
 * Manages user authentication state and session persistence across app lifecycle.
 * Provides login/logout functionality with token-based authentication and role management.
 * 
 * Session lifecycle:
 * - On mount: Attempts to restore session from localStorage
 * - On login: Stores session token and user info
 * - On logout: Clears session and notifies backend
 * 
 * Security features:
 * - Token validation on session restore
 * - Automatic session invalidation on validation failure
 * - Admin role tracking for permission-based UI
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';

/**
 * Session context interface providing authentication state and actions
 */
interface SessionContextType {
  isLoggedIn: boolean;
  token: string | null;
  email: string | null;
  isAdmin: boolean;
  login: (token: string, email: string, isAdmin: boolean) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

/**
 * Hook to access session context
 * 
 * Provides access to authentication state and session management functions.
 * Must be used within a SessionProvider component.
 * 
 * @returns Session context with auth state and actions
 * @throws Error if used outside SessionProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Session provider component
 * 
 * Manages authentication state and session persistence throughout app lifecycle.
 * 
 * Initialization flow:
 * 1. Attempts to restore session from localStorage
 * 2. Validates token with backend
 * 3. Either restores session or clears invalid token
 * 4. Sets loading to false when ready
 * 
 * @param props - Provider props with children
 * @returns Provider component wrapping children with session context
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Restore session from localStorage on mount
   * 
   * WHY: Implements "stay logged in" feature by persisting tokens.
   * Validates restored tokens to ensure they haven't expired or been invalidated.
   * Critical for UX - users don't want to login every time they open the app.
   */
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = localStorage.getItem('sessionToken');
        if (storedToken && window.auth?.validateSession) {
          const result = await window.auth.validateSession(storedToken);
          if (result.valid && result.email) {
            setToken(storedToken);
            setEmail(result.email);
            setIsAdmin(result.isAdmin || false);
            window.logger?.info('Session restored', { email: result.email });
          } else {
            // Session invalid, clear it
            localStorage.removeItem('sessionToken');
            window.logger?.verbose('Session invalid, cleared');
          }
        }
      } catch (err) {
        window.logger?.error('Could not load session', { error: err });
        localStorage.removeItem('sessionToken');
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  /**
   * Log in user and persist session
   * 
   * @param newToken - Authentication token from backend
   * @param newEmail - User's email address
   * @param newIsAdmin - Whether user has admin privileges
   */
  const login = useCallback((newToken: string, newEmail: string, newIsAdmin: boolean) => {
    setToken(newToken);
    setEmail(newEmail);
    setIsAdmin(newIsAdmin);
    localStorage.setItem('sessionToken', newToken);
    window.logger?.info('User logged in', { email: newEmail, isAdmin: newIsAdmin });
  }, []);

  /**
   * Log out user and clear session
   * 
   * Notifies backend to invalidate token, then clears all local session state.
   * Continues with logout even if backend notification fails (fail-safe).
   */
  const logout = useCallback(async () => {
    const currentToken = token;
    if (currentToken && window.auth?.logout) {
      try {
        await window.auth.logout(currentToken);
      } catch (err) {
        window.logger?.error('Could not logout', { error: err });
      }
    }
    
    setToken(null);
    setEmail(null);
    setIsAdmin(false);
    localStorage.removeItem('sessionToken');
    window.logger?.info('User logged out');
  }, [token]);

  const value: SessionContextType = useMemo(() => ({
    isLoggedIn: !!token,
    token,
    email,
    isAdmin,
    login,
    logout,
    isLoading
  }), [token, email, isAdmin, login, logout, isLoading]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

