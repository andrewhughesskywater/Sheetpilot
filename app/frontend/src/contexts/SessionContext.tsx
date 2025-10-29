import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

export function SessionProvider({ children }: SessionProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load session from localStorage on mount
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

  const login = (newToken: string, newEmail: string, newIsAdmin: boolean) => {
    setToken(newToken);
    setEmail(newEmail);
    setIsAdmin(newIsAdmin);
    localStorage.setItem('sessionToken', newToken);
    window.logger?.info('User logged in', { email: newEmail, isAdmin: newIsAdmin });
  };

  const logout = async () => {
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
  };

  const value: SessionContextType = {
    isLoggedIn: !!token,
    token,
    email,
    isAdmin,
    login,
    logout,
    isLoading
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

