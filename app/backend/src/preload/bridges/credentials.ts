import { ipcRenderer } from 'electron';

export const credentialsBridge = {
  store: (
    service: string,
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    message: string;
    changes: number;
  }> => ipcRenderer.invoke('credentials:store', service, email, password),
  list: (): Promise<{
    success: boolean;
    credentials: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>;
    error?: string;
  }> => ipcRenderer.invoke('credentials:list'),
  delete: (
    service: string
  ): Promise<{
    success: boolean;
    message: string;
    changes: number;
  }> => ipcRenderer.invoke('credentials:delete', service)
};


