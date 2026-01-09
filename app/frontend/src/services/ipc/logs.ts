export async function getLogPath(
  token: string
): Promise<{ success: boolean; logPath?: string; logFiles?: string[]; error?: string } | null> {
  if (!window.logs?.getLogPath) {
    return null;
  }
  return window.logs.getLogPath(token);
}

export async function exportLogs(
  token: string,
  logPath: string,
  format: 'json' | 'txt' = 'txt'
): Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string; error?: string } | null> {
  if (!window.logs?.exportLogs) {
    return null;
  }
  return window.logs.exportLogs(token, logPath, format);
}
