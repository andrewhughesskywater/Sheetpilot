// Modules
mod auth;
mod bot;
mod commands;
mod database;
mod recovery;

// Test modules
#[cfg(test)]
mod auth_test;
#[cfg(test)]
mod database_test;

use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize the logging subsystem
fn initialize_logging(log_dir: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    // Create logs directory if it doesn't exist
    fs::create_dir_all(&log_dir)?;

    // Clean up old log files (keep last 7 days)
    cleanup_old_logs(&log_dir, 7)?;

    // Set up file appender with daily rotation
    let file_appender = tracing_appender::rolling::daily(&log_dir, "sheetpilot.log");
    
    // Configure the subscriber with human-readable format
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_writer(file_appender).with_ansi(false))
        .init();

    tracing::info!("Logging initialized at: {:?}", log_dir);

    Ok(())
}

/// Clean up old log files, keeping only the last N days
fn cleanup_old_logs(log_dir: &PathBuf, days_to_keep: u64) -> Result<(), Box<dyn std::error::Error>> {
    let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(days_to_keep * 24 * 60 * 60);

    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    if filename.ends_with(".log") {
                        if let Ok(modified) = metadata.modified() {
                            if modified < cutoff {
                                let _ = fs::remove_file(entry.path());
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Redact email addresses for logging (show only domain)
pub fn redact_email(email: &str) -> String {
    if let Some(at_pos) = email.find('@') {
        format!("***{}", &email[at_pos..])
    } else {
        "***".to_string()
    }
}

// Example command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to SheetPilot!", name)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize logging
            let log_dir = app.path()
                .app_data_dir()
                .map(|dir| dir.join("logs"))
                .unwrap_or_else(|_| PathBuf::from("logs"));
            
            if let Err(e) = initialize_logging(log_dir) {
                eprintln!("Failed to initialize logging: {}", e);
            }

            // Initialize database on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = database::initialize(&app_handle).await {
                    tracing::error!("Failed to initialize database: {}", e);
                    return;
                }
                
                // Recover any stuck submissions from previous session
                match database::get_pool() {
                    Ok(pool) => {
                        match recovery::recover_stuck_submissions(pool).await {
                            Ok(0) => tracing::info!("No stuck entries to recover"),
                            Ok(n) => tracing::warn!("Recovered {} stuck entries", n),
                            Err(e) => tracing::error!("Failed to recover stuck entries: {}", e),
                        }
                    }
                    Err(e) => tracing::error!("Failed to get pool for recovery: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_version,
            // Database commands
            commands::database::save_timesheet_draft,
            commands::database::load_timesheet_draft,
            commands::database::delete_timesheet_draft,
            commands::database::get_all_archive_data,
            commands::database::get_failed_entries,
            commands::database::reset_failed_to_draft,
            commands::database::get_submission_status,
            // Auth commands
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::auth::auth_validate_session,
            commands::auth::auth_get_current_session,
            // Credentials commands
            commands::credentials::credentials_store,
            commands::credentials::credentials_get,
            commands::credentials::credentials_list,
            commands::credentials::credentials_delete,
            // Submission commands
            commands::submission::timesheet_submit,
            commands::submission::timesheet_export_csv,
            // Logging commands
            commands::logging::frontend_log,
            commands::logging::get_logs_info,
            commands::logging::export_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
