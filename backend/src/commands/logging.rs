use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct LogInfo {
    pub name: String,
    pub size: u64,
    pub modified: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogsInfoResponse {
    pub success: bool,
    pub files: Vec<LogInfo>,
    pub total_size: u64,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportLogsResponse {
    pub success: bool,
    pub content: Option<String>,
    pub error: Option<String>,
}

/// Frontend logging command - forwards frontend logs to backend tracing
#[tauri::command]
pub fn frontend_log(level: String, message: String, context: Option<serde_json::Value>) {
    let context_str = context
        .map(|c| format!(" context={:?}", c))
        .unwrap_or_default();

    match level.to_lowercase().as_str() {
        "error" => tracing::error!(source = "frontend", "{}{}", message, context_str),
        "warn" => tracing::warn!(source = "frontend", "{}{}", message, context_str),
        "info" => tracing::info!(source = "frontend", "{}{}", message, context_str),
        "debug" => tracing::debug!(source = "frontend", "{}{}", message, context_str),
        _ => tracing::info!(source = "frontend", level = %level, "{}{}", message, context_str),
    }
}

/// Get information about available log files
#[tauri::command]
pub async fn get_logs_info(app: tauri::AppHandle) -> LogsInfoResponse {
    let log_dir = match get_log_directory(&app) {
        Ok(dir) => dir,
        Err(e) => {
            return LogsInfoResponse {
                success: false,
                files: vec![],
                total_size: 0,
                error: Some(format!("Failed to get log directory: {}", e)),
            }
        }
    };

    let mut files = Vec::new();
    let mut total_size = 0u64;

    match fs::read_dir(&log_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.ends_with(".log") {
                            let size = metadata.len();
                            total_size += size;
                            let modified = metadata
                                .modified()
                                .ok()
                                .and_then(|time| {
                                    time.duration_since(std::time::UNIX_EPOCH).ok()
                                })
                                .map(|duration| {
                                    chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)
                                        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                                        .unwrap_or_else(|| "Unknown".to_string())
                                })
                                .unwrap_or_else(|| "Unknown".to_string());

                            files.push(LogInfo {
                                name,
                                size,
                                modified,
                            });
                        }
                    }
                }
            }
        }
        Err(e) => {
            return LogsInfoResponse {
                success: false,
                files: vec![],
                total_size: 0,
                error: Some(format!("Failed to read log directory: {}", e)),
            }
        }
    }

    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    LogsInfoResponse {
        success: true,
        files,
        total_size,
        error: None,
    }
}

/// Export all available log files
#[tauri::command]
pub async fn export_logs(app: tauri::AppHandle) -> ExportLogsResponse {
    let log_dir = match get_log_directory(&app) {
        Ok(dir) => dir,
        Err(e) => {
            return ExportLogsResponse {
                success: false,
                content: None,
                error: Some(format!("Failed to get log directory: {}", e)),
            }
        }
    };

    let mut combined_content = String::new();
    combined_content.push_str("=== SheetPilot Application Logs ===\n");
    combined_content.push_str(&format!("Exported: {}\n", chrono::Local::now().format("%Y-%m-%d %H:%M:%S")));
    combined_content.push_str("=====================================\n\n");

    match fs::read_dir(&log_dir) {
        Ok(entries) => {
            let mut log_files: Vec<_> = entries
                .flatten()
                .filter(|entry| {
                    entry
                        .file_name()
                        .to_string_lossy()
                        .ends_with(".log")
                })
                .collect();

            // Sort by modified time (newest first)
            log_files.sort_by(|a, b| {
                let time_a = a.metadata().ok().and_then(|m| m.modified().ok());
                let time_b = b.metadata().ok().and_then(|m| m.modified().ok());
                time_b.cmp(&time_a)
            });

            for entry in log_files {
                let path = entry.path();
                let filename = entry.file_name().to_string_lossy().to_string();
                
                combined_content.push_str(&format!("\n\n========== {} ==========\n", filename));
                
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        combined_content.push_str(&content);
                    }
                    Err(e) => {
                        combined_content.push_str(&format!("[Error reading file: {}]\n", e));
                    }
                }
            }
        }
        Err(e) => {
            return ExportLogsResponse {
                success: false,
                content: None,
                error: Some(format!("Failed to read log directory: {}", e)),
            }
        }
    }

    ExportLogsResponse {
        success: true,
        content: Some(combined_content),
        error: None,
    }
}

/// Helper function to get log directory path
fn get_log_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))
        .map(|dir| dir.join("logs"))
}

