use crate::auth;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub token: Option<String>,
    pub is_admin: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogoutResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub valid: bool,
    pub email: Option<String>,
    pub is_admin: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentSessionResponse {
    pub email: String,
    pub token: String,
    pub is_admin: bool,
}

#[tauri::command]
pub async fn auth_login(email: String, password: String, stay_logged_in: bool) -> LoginResponse {
    // Check if admin login
    let is_admin = auth::is_admin_login(&email, &password);
    
    if is_admin {
        // Admin login - no credential storage needed
        match auth::create_session(email.clone(), stay_logged_in, true) {
            Ok(token) => LoginResponse {
                success: true,
                token: Some(token),
                is_admin: true,
                error: None,
            },
            Err(e) => LoginResponse {
                success: false,
                token: None,
                is_admin: false,
                error: Some(e),
            },
        }
    } else {
        // Regular user login - store credentials and create session
        // TODO: Store credentials in database
        match auth::create_session(email.clone(), stay_logged_in, false) {
            Ok(token) => LoginResponse {
                success: true,
                token: Some(token),
                is_admin: false,
                error: None,
            },
            Err(e) => LoginResponse {
                success: false,
                token: None,
                is_admin: false,
                error: Some(e),
            },
        }
    }
}

#[tauri::command]
pub async fn auth_logout(token: String) -> LogoutResponse {
    // Get session info before clearing
    let session = auth::validate_session(&token);
    
    if session.valid {
        match auth::clear_user_sessions(&session.email) {
            Ok(_) => LogoutResponse {
                success: true,
                error: None,
            },
            Err(e) => LogoutResponse {
                success: false,
                error: Some(e),
            },
        }
    } else {
        match auth::clear_session(&token) {
            Ok(_) => LogoutResponse {
                success: true,
                error: None,
            },
            Err(e) => LogoutResponse {
                success: false,
                error: Some(e),
            },
        }
    }
}

#[tauri::command]
pub async fn auth_validate_session(token: String) -> SessionResponse {
    let session = auth::validate_session(&token);
    
    SessionResponse {
        valid: session.valid,
        email: if session.valid { Some(session.email) } else { None },
        is_admin: session.is_admin,
    }
}

#[tauri::command]
pub async fn auth_get_current_session(token: String) -> Option<CurrentSessionResponse> {
    let session = auth::validate_session(&token);
    
    if session.valid {
        Some(CurrentSessionResponse {
            email: session.email,
            token: session.token,
            is_admin: session.is_admin,
        })
    } else {
        None
    }
}

