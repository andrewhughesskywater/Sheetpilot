// Modules
mod database;
mod auth;
mod commands;
mod bot;

// Test modules
#[cfg(test)]
mod database_test;
#[cfg(test)]
mod auth_test;

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
        .setup(|app| {
            // Initialize database on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = database::initialize(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
