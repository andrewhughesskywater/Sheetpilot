use rusqlite::{Connection, Result};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

// Global database connection
static DB: Mutex<Option<Connection>> = Mutex::new(None);

/// Initialize the database
pub async fn initialize(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    
    let db_path = app_data_dir.join("sheetpilot.sqlite");
    let conn = Connection::open(&db_path)?;
    
    // Create tables
    ensure_schema(&conn)?;
    
    // Store connection
    let mut db = DB.lock().unwrap();
    *db = Some(conn);
    
    println!("Database initialized at: {:?}", db_path);
    Ok(())
}

/// Ensure database schema exists
fn ensure_schema(conn: &Connection) -> Result<()> {
    // Timesheet table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS timesheet (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            time_in INTEGER NOT NULL,
            time_out INTEGER NOT NULL,
            hours REAL NOT NULL,
            project TEXT NOT NULL,
            tool TEXT,
            detail_charge_code TEXT,
            task_description TEXT NOT NULL,
            status TEXT,
            submitted_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date, time_in, project, task_description)
        )",
        [],
    )?;
    
    // Credentials table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            stay_logged_in INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT NOT NULL
        )",
        [],
    )?;
    
    Ok(())
}

/// Get database connection
pub fn get_connection() -> Result<std::sync::MutexGuard<'static, Option<Connection>>> {
    Ok(DB.lock().unwrap())
}

