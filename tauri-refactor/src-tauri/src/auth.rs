use serde::{Deserialize, Serialize};
use chrono::{Duration, Utc};

const ADMIN_USERNAME: &str = "Admin";
const ADMIN_PASSWORD: &str = "SWFL_ADMIN";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub token: String,
    pub email: String,
    pub is_admin: bool,
    pub valid: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub stay_logged_in: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub token: Option<String>,
    pub is_admin: bool,
    pub error: Option<String>,
}

/// Create a new session
pub fn create_session(email: String, stay_logged_in: bool, is_admin: bool) -> Result<String, String> {
    use uuid::Uuid;
    
    let token = Uuid::new_v4().to_string();
    let expires_at = if stay_logged_in {
        Utc::now() + Duration::days(30)
    } else {
        Utc::now() + Duration::hours(8)
    };
    
    // Store in database
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            let result = conn.execute(
                "INSERT INTO sessions (token, email, is_admin, stay_logged_in, expires_at) VALUES (?, ?, ?, ?, ?)",
                rusqlite::params![
                    &token,
                    &email,
                    if is_admin { 1 } else { 0 },
                    if stay_logged_in { 1 } else { 0 },
                    expires_at.to_rfc3339()
                ],
            );
            
            match result {
                Ok(_) => Ok(token),
                Err(e) => Err(format!("Failed to create session: {}", e)),
            }
        } else {
            Err("Database not initialized".to_string())
        }
    } else {
        Err("Failed to access database".to_string())
    }
}

/// Validate a session token
pub fn validate_session(token: &str) -> Session {
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            let result = conn.query_row(
                "SELECT email, is_admin, expires_at FROM sessions WHERE token = ?",
                [token],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i32>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            );
            
            match result {
                Ok((email, is_admin, expires_at)) => {
                    // Check if expired
                    if let Ok(exp_time) = chrono::DateTime::parse_from_rfc3339(&expires_at) {
                        if Utc::now() < exp_time {
                            return Session {
                                token: token.to_string(),
                                email,
                                is_admin: is_admin != 0,
                                valid: true,
                            };
                        }
                    }
                }
                Err(_) => {}
            }
        }
    }
    
    Session {
        token: String::new(),
        email: String::new(),
        is_admin: false,
        valid: false,
    }
}

/// Clear a session
pub fn clear_session(token: &str) -> Result<(), String> {
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            conn.execute("DELETE FROM sessions WHERE token = ?", [token])
                .map_err(|e| format!("Failed to clear session: {}", e))?;
            Ok(())
        } else {
            Err("Database not initialized".to_string())
        }
    } else {
        Err("Failed to access database".to_string())
    }
}

/// Clear all sessions for a user
pub fn clear_user_sessions(email: &str) -> Result<(), String> {
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            conn.execute("DELETE FROM sessions WHERE email = ?", [email])
                .map_err(|e| format!("Failed to clear user sessions: {}", e))?;
            Ok(())
        } else {
            Err("Database not initialized".to_string())
        }
    } else {
        Err("Failed to access database".to_string())
    }
}

/// Check if credentials are admin credentials
pub fn is_admin_login(email: &str, password: &str) -> bool {
    email == ADMIN_USERNAME && password == ADMIN_PASSWORD
}

