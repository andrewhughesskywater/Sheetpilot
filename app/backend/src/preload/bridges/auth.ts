import { ipcRenderer } from 'electron';

export const authBridge = {
  login: (
    email: string,
    password: string,
    stayLoggedIn: boolean
  ): Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }> =>
    ipcRenderer.invoke('auth:login', email, password, stayLoggedIn),
  validateSession: (token: string): Promise<{ valid: boolean; email?: string; isAdmin?: boolean }> =>
    ipcRenderer.invoke('auth:validateSession', token),
  logout: (token: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('auth:logout', token),
  getCurrentSession: (token: string): Promise<{ email: string; token: string; isAdmin: boolean } | null> =>
    ipcRenderer.invoke('auth:getCurrentSession', token)
};


