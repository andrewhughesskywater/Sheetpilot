export async function getSetting(key: string): Promise<{ success: boolean; value?: unknown; error?: string } | null> {
  if (!window.settings?.get) {
    return null;
  }
  return window.settings.get(key);
}

export async function setSetting(key: string, value: unknown): Promise<{ success: boolean; error?: string } | null> {
  if (!window.settings?.set) {
    return null;
  }
  return window.settings.set(key, value);
}
