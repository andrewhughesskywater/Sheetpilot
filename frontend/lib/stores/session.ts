import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

interface SessionState {
  token: string | null;
  email: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
}

const initialState: SessionState = {
  token: null,
  email: null,
  isAdmin: false,
  isLoggedIn: false,
  isLoading: true,
};

function createSessionStore() {
  const { subscribe, set, update } = writable<SessionState>(initialState);

  return {
    subscribe,

    async initialize() {
      update((state) => ({ ...state, isLoading: true }));

      // Try to restore session from localStorage
      const savedToken = localStorage.getItem('session_token');
      if (savedToken) {
        const valid = await this.validateSession(savedToken);
        if (!valid) {
          localStorage.removeItem('session_token');
        }
      }

      update((state) => ({ ...state, isLoading: false }));
    },

    async login(
      email: string,
      password: string,
      stayLoggedIn: boolean
    ): Promise<{ success: boolean; error?: string }> {
      try {
        const response = await invoke<{
          success: boolean;
          token?: string;
          is_admin: boolean;
          error?: string;
        }>('auth_login', { email, password, stayLoggedIn });

        if (response.success && response.token) {
          const token = response.token;

          if (stayLoggedIn) {
            localStorage.setItem('session_token', token);
          }

          update((state) => ({
            ...state,
            token,
            email,
            isAdmin: response.is_admin,
            isLoggedIn: true,
          }));

          return { success: true };
        } else {
          return { success: false, error: response.error || 'Login failed' };
        }
      } catch (error) {
        console.error('Login error:', error);
        await invoke('frontend_log', {
          level: 'error',
          message: 'Login failed',
          context: { action: 'login', error: String(error) },
        });
        return { success: false, error: String(error) };
      }
    },

    async logout() {
      let token: string | null = null;
      update((state) => {
        token = state.token;
        return state;
      });

      if (token) {
        try {
          await invoke('auth_logout', { token });
        } catch (error) {
          console.error('Logout error:', error);
          await invoke('frontend_log', {
            level: 'error',
            message: 'Logout failed',
            context: { action: 'logout', error: String(error) },
          });
        }
      }

      localStorage.removeItem('session_token');
      set(initialState);
    },

    async validateSession(token: string): Promise<boolean> {
      try {
        const response = await invoke<{
          valid: boolean;
          email?: string;
          is_admin: boolean;
        }>('auth_validate_session', { token });

        if (response.valid && response.email) {
          update((state) => ({
            ...state,
            token,
            email: response.email!,
            isAdmin: response.is_admin,
            isLoggedIn: true,
          }));
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error('Session validation error:', error);
        await invoke('frontend_log', {
          level: 'error',
          message: 'Session validation failed',
          context: { action: 'validate_session', error: String(error) },
        });
        return false;
      }
    },
  };
}

export const sessionStore = createSessionStore();

// Derived stores for convenience
export const isLoggedIn = derived(sessionStore, ($session) => $session.isLoggedIn);
export const isAdmin = derived(sessionStore, ($session) => $session.isAdmin);
export const currentUser = derived(sessionStore, ($session) => $session.email);
