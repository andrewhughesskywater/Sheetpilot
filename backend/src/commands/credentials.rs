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
    let pool = match crate::database::get_pool() {
        Ok(p) => p,
        Err(e) => {
            return StoreResponse {
                success: false,
                changes: 0,
                message: None,
                error: Some(format!("Failed to access database: {}", e)),
            }
        }
    };

    let result = sqlx::query!(
        "INSERT INTO credentials (service, email, password) VALUES (?, ?, ?)
         ON CONFLICT(service) DO UPDATE SET email = ?, password = ?, updated_at = CURRENT_TIMESTAMP",
        service,
        email,
        password,
        email,
        password
    )
    .execute(pool)
    .await;

    match result {
        Ok(result) => StoreResponse {
            success: true,
            changes: result.rows_affected() as usize,
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
}

#[tauri::command]
pub async fn credentials_get(service: String) -> CredentialsResponse {
    // TODO: Implement credential retrieval
    let pool = match crate::database::get_pool() {
        Ok(p) => p,
        Err(e) => {
            return CredentialsResponse {
                success: false,
                credentials: None,
                error: Some(format!("Failed to access database: {}", e)),
            }
        }
    };

    let result = sqlx::query!(
        "SELECT service, email, password FROM credentials WHERE service = ?",
        service
    )
    .fetch_optional(pool)
    .await;

    match result {
        Ok(Some(row)) => CredentialsResponse {
            success: true,
            credentials: Some(Credentials {
                service: row.service,
                email: row.email,
                password: row.password,
            }),
            error: None,
        },
        Ok(None) => CredentialsResponse {
            success: false,
            credentials: None,
            error: Some("Credentials not found".to_string()),
        },
        Err(e) => CredentialsResponse {
            success: false,
            credentials: None,
            error: Some(format!("Database error: {}", e)),
        },
    }
}

#[tauri::command]
pub async fn credentials_list() -> CredentialsListResponse {
    // TODO: Implement credentials list
    let pool = match crate::database::get_pool() {
        Ok(p) => p,
        Err(e) => {
            return CredentialsListResponse {
                success: false,
                credentials: vec![],
                error: Some(format!("Failed to access database: {}", e)),
            }
        }
    };

    let result = sqlx::query!("SELECT service, email FROM credentials ORDER BY service")
        .fetch_all(pool)
        .await;

    match result {
        Ok(rows) => {
            let creds: Vec<CredentialsInfo> = rows
                .into_iter()
                .map(|row| CredentialsInfo {
                    service: row.service,
                    email: row.email,
                })
                .collect();
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
}

#[tauri::command]
pub async fn credentials_delete(service: String) -> StoreResponse {
    // TODO: Implement credential deletion
    let pool = match crate::database::get_pool() {
        Ok(p) => p,
        Err(e) => {
            return StoreResponse {
                success: false,
                changes: 0,
                message: None,
                error: Some(format!("Failed to access database: {}", e)),
            }
        }
    };

    let result = sqlx::query!("DELETE FROM credentials WHERE service = ?", service)
        .execute(pool)
        .await;

    match result {
        Ok(result) => StoreResponse {
            success: true,
            changes: result.rows_affected() as usize,
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
}
