use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

// Global database connection pool
static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();

/// Initialize the database
pub async fn initialize(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("sheetpilot.sqlite");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    // Create connection pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    // Store pool globally
    DB_POOL.set(pool).map_err(|_| "Database already initialized")?;

    tracing::info!("Database initialized at: {:?}", db_path);
    Ok(())
}

/// Get database connection pool
pub fn get_pool() -> Result<&'static SqlitePool, String> {
    DB_POOL.get().ok_or_else(|| "Database not initialized".to_string())
}
