export async function clearCredentials(token: string): Promise<{ success: boolean; error?: string }> {
  if (!window.admin?.clearCredentials) {
    return { success: false, error: 'Admin API not available' };
  }
  return window.admin.clearCredentials(token);
}

export async function rebuildDatabase(token: string): Promise<{ success: boolean; error?: string }> {
  if (!window.admin?.rebuildDatabase) {
    return { success: false, error: 'Admin API not available' };
  }
  return window.admin.rebuildDatabase(token);
}
