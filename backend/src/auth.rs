use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

const ADMIN_USERNAME: &str = "Admin";
const ADMIN_PASSWORD: &str = "SWFL_ADMIN";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub token: String,
    pub email: String,
    pub is_admin: bool,
    pub valid: bool,
}

/// Create a new session
pub async fn create_session(
    email: String,
    stay_logged_in: bool,
    is_admin: bool,
) -> Result<String, String> {
    use uuid::Uuid;

    let token = Uuid::new_v4().to_string();
    let expires_at = if stay_logged_in {
        Utc::now() + Duration::days(30)
    } else {
        Utc::now() + Duration::hours(8)
    };

    // Store in database
    let pool = crate::database::get_pool()
        .map_err(|e| format!("Failed to access database: {}", e))?;

    let is_admin_int = if is_admin { 1 } else { 0 };
    let stay_logged_in_int = if stay_logged_in { 1 } else { 0 };
    let expires_at_str = expires_at.to_rfc3339();

    let result = sqlx::query!(
        "INSERT INTO sessions (token, email, is_admin, stay_logged_in, expires_at) VALUES (?, ?, ?, ?, ?)",
        token,
        email,
        is_admin_int,
        stay_logged_in_int,
        expires_at_str
    )
    .execute(pool)
    .await;

    match result {
        Ok(_) => Ok(token),
        Err(e) => Err(format!("Failed to create session: {}", e)),
    }
}

/// Validate a session token
pub async fn validate_session(token: &str) -> Session {
    let pool = match crate::database::get_pool() {
        Ok(p) => p,
        Err(_) => {
            return Session {
                token: String::new(),
                email: String::new(),
                is_admin: false,
                valid: false,
            }
        }
    };

    let result = sqlx::query!(
        "SELECT email, is_admin, expires_at FROM sessions WHERE token = ?",
        token
    )
    .fetch_optional(pool)
    .await;

    match result {
        Ok(Some(row)) => {
            // Check if expired
            if let Ok(exp_time) = chrono::DateTime::parse_from_rfc3339(&row.expires_at) {
                if Utc::now() < exp_time {
                    return Session {
                        token: token.to_string(),
                        email: row.email,
                        is_admin: row.is_admin != 0,
                        valid: true,
                    };
                }
            }
        }
        Ok(None) | Err(_) => {}
    }

    Session {
        token: String::new(),
        email: String::new(),
        is_admin: false,
        valid: false,
    }
}

/// Clear a session
pub async fn clear_session(token: &str) -> Result<(), String> {
    let pool = crate::database::get_pool()
        .map_err(|e| format!("Failed to access database: {}", e))?;

    sqlx::query!("DELETE FROM sessions WHERE token = ?", token)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to clear session: {}", e))?;

    Ok(())
}

/// Clear all sessions for a user
pub async fn clear_user_sessions(email: &str) -> Result<(), String> {
    let pool = crate::database::get_pool()
        .map_err(|e| format!("Failed to access database: {}", e))?;

    sqlx::query!("DELETE FROM sessions WHERE email = ?", email)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to clear user sessions: {}", e))?;

    Ok(())
}

/// Check if credentials are admin credentials
pub fn is_admin_login(email: &str, password: &str) -> bool {
    email == ADMIN_USERNAME && password == ADMIN_PASSWORD
}
