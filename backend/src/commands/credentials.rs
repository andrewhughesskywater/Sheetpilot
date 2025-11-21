use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Credentials {
    pub service: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialsResponse {
    pub success: bool,
    pub credentials: Option<Credentials>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialsListResponse {
    pub success: bool,
    pub credentials: Vec<CredentialsInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialsInfo {
    pub service: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoreResponse {
    pub success: bool,
    pub changes: usize,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn credentials_store(service: String, email: String, password: String) -> StoreResponse {
    // TODO: Implement credential storage
    // Store encrypted credentials in database
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            let result = conn.execute(
                "INSERT INTO credentials (service, email, password) VALUES (?, ?, ?)
                 ON CONFLICT(service) DO UPDATE SET email = ?, password = ?, updated_at = CURRENT_TIMESTAMP",
                rusqlite::params![&service, &email, &password, &email, &password],
            );
            
            match result {
                Ok(changes) => StoreResponse {
                    success: true,
                    changes,
                    message: Some("Credentials stored successfully".to_string()),
                    error: None,
                },
                Err(e) => StoreResponse {
                    success: false,
                    changes: 0,
                    message: None,
                    error: Some(format!("Failed to store credentials: {}", e)),
                },
            }
        } else {
            StoreResponse {
                success: false,
                changes: 0,
                message: None,
                error: Some("Database not initialized".to_string()),
            }
        }
    } else {
        StoreResponse {
            success: false,
            changes: 0,
            message: None,
            error: Some("Failed to access database".to_string()),
        }
    }
}

#[tauri::command]
pub async fn credentials_get(service: String) -> CredentialsResponse {
    // TODO: Implement credential retrieval
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            let result = conn.query_row(
                "SELECT service, email, password FROM credentials WHERE service = ?",
                [&service],
                |row| {
                    Ok(Credentials {
                        service: row.get(0)?,
                        email: row.get(1)?,
                        password: row.get(2)?,
                    })
                },
            );
            
            match result {
                Ok(creds) => CredentialsResponse {
                    success: true,
                    credentials: Some(creds),
                    error: None,
                },
                Err(_) => CredentialsResponse {
                    success: false,
                    credentials: None,
                    error: Some("Credentials not found".to_string()),
                },
            }
        } else {
            CredentialsResponse {
                success: false,
                credentials: None,
                error: Some("Database not initialized".to_string()),
            }
        }
    } else {
        CredentialsResponse {
            success: false,
            credentials: None,
            error: Some("Failed to access database".to_string()),
        }
    }
}

#[tauri::command]
pub async fn credentials_list() -> CredentialsListResponse {
    // TODO: Implement credentials list
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            let mut stmt = match conn.prepare("SELECT service, email FROM credentials ORDER BY service") {
                Ok(s) => s,
                Err(e) => return CredentialsListResponse {
                    success: false,
                    credentials: vec![],
                    error: Some(format!("Failed to prepare query: {}", e)),
                },
            };
            
            let creds_iter = stmt.query_map([], |row| {
                Ok(CredentialsInfo {
                    service: row.get(0)?,
                    email: row.get(1)?,
                })
            });
            
            match creds_iter {
                Ok(iter) => {
                    let creds: Vec<CredentialsInfo> = iter.filter_map(|r| r.ok()).collect();
                    CredentialsListResponse {
                        success: true,
                        credentials: creds,
                        error: None,
                    }
                }
                Err(e) => CredentialsListResponse {
                    success: false,
                    credentials: vec![],
                    error: Some(format!("Failed to list credentials: {}", e)),
                },
            }
        } else {
            CredentialsListResponse {
                success: false,
                credentials: vec![],
                error: Some("Database not initialized".to_string()),
            }
        }
    } else {
        CredentialsListResponse {
            success: false,
            credentials: vec![],
            error: Some("Failed to access database".to_string()),
        }
    }
}

#[tauri::command]
pub async fn credentials_delete(service: String) -> StoreResponse {
    // TODO: Implement credential deletion
    if let Ok(db_guard) = crate::database::get_connection() {
        if let Some(conn) = db_guard.as_ref() {
            let result = conn.execute("DELETE FROM credentials WHERE service = ?", [&service]);
            
            match result {
                Ok(changes) => StoreResponse {
                    success: true,
                    changes,
                    message: Some("Credentials deleted successfully".to_string()),
                    error: None,
                },
                Err(e) => StoreResponse {
                    success: false,
                    changes: 0,
                    message: None,
                    error: Some(format!("Failed to delete credentials: {}", e)),
                },
            }
        } else {
            StoreResponse {
                success: false,
                changes: 0,
                message: None,
                error: Some("Database not initialized".to_string()),
            }
        }
    } else {
        StoreResponse {
            success: false,
            changes: 0,
            message: None,
            error: Some("Failed to access database".to_string()),
        }
    }
}

