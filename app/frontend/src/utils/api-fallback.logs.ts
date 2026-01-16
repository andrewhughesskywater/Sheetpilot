export const mockLogsAPI = {
  getLogPath: async (
    _token: string
  ): Promise<{
    success: boolean;
    logPath?: string;
    logFiles?: string[];
    error?: string;
  }> => {
    console.log("[MockAPI] Getting log path");
    return {
      success: true,
      logPath: "/mock/log/path/app.log",
      logFiles: ["app.log"],
    };
  },

  exportLogs: async (
    _token: string,
    logPath: string,
    format: "json" | "txt" = "txt"
  ): Promise<{
    success: boolean;
    content?: string;
    filename?: string;
    mimeType?: string;
    error?: string;
  }> => {
    console.log("[MockAPI] Exporting logs:", logPath, format);
    return {
      success: true,
      content:
        format === "json"
          ? '{"logs": []}'
          : "Application started\nDatabase initialized",
      filename: `logs_${new Date().toISOString().split("T")[0]}.${format}`,
      mimeType: format === "json" ? "application/json" : "text/plain",
    };
  },
};
