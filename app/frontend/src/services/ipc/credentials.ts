export async function listCredentials(): Promise<{
  success: boolean;
  credentials?: Array<{ id: number; service: string; email: string; created_at: string; updated_at: string }>;
  error?: string;
}> {
  if (!window.credentials?.list) {
    return { success: false, error: 'Credentials API not available', credentials: [] };
  }
  return window.credentials.list();
}

export async function storeCredentials(
  service: string,
  email: string,
  password: string
): Promise<{
  success: boolean;
  message: string;
  changes: number;
}> {
  if (!window.credentials?.store) {
    return { success: false, message: 'Credentials API not available', changes: 0 };
  }
  return window.credentials.store(service, email, password);
}
