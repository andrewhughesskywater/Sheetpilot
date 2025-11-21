use serde::{Deserialize, Serialize};
use rusqlite::params;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimesheetRow {
    pub id: Option<i64>,
    pub date: String,
    #[serde(rename = "timeIn")]
    pub time_in: String,
    #[serde(rename = "timeOut")]
    pub time_out: String,
    pub project: String,
    pub tool: Option<String>,
    #[serde(rename = "chargeCode")]
    pub charge_code: Option<String>,
    #[serde(rename = "taskDescription")]
    pub task_description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveDraftResponse {
    pub success: bool,
    pub changes: Option<usize>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadDraftResponse {
    pub success: bool,
    pub entries: Vec<TimesheetRow>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveEntry {
    pub id: i64,
    pub date: String,
    pub time_in: i64,
    pub time_out: i64,
    pub hours: f64,
    pub project: String,
    pub tool: Option<String>,
    pub detail_charge_code: Option<String>,
    pub task_description: String,
    pub status: String,
    pub submitted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchiveDataResponse {
    pub success: bool,
    pub timesheet: Vec<ArchiveEntry>,
    pub credentials: Vec<CredentialInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialInfo {
    pub id: i64,
    pub service: String,
    pub email: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Parse time string (HH:MM) to minutes since midnight
fn parse_time_to_minutes(time_str: &str) -> Result<i64, String> {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid time format: {}", time_str));
    }
    
    let hours: i64 = parts[0].parse().map_err(|_| format!("Invalid hours: {}", parts[0]))?;
    let minutes: i64 = parts[1].parse().map_err(|_| format!("Invalid minutes: {}", parts[1]))?;
    
    if hours < 0 || hours > 23 {
        return Err(format!("Hours must be 0-23: {}", hours));
    }
    if minutes < 0 || minutes > 59 {
        return Err(format!("Minutes must be 0-59: {}", minutes));
    }
    
    Ok(hours * 60 + minutes)
}

/// Format minutes since midnight to HH:MM string
fn format_minutes_to_time(minutes: i64) -> String {
    let hours = minutes / 60;
    let mins = minutes % 60;
    format!("{:02}:{:02}", hours, mins)
}

#[tauri::command]
pub async fn save_timesheet_draft(row: TimesheetRow) -> SaveDraftResponse {
    // Validate required fields
    if row.date.is_empty() {
        return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some("Date is required".to_string()),
        };
    }
    if row.project.is_empty() {
        return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some("Project is required".to_string()),
        };
    }
    if row.task_description.is_empty() {
        return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some("Task description is required".to_string()),
        };
    }
    
    // Parse times to minutes
    let time_in_minutes = match parse_time_to_minutes(&row.time_in) {
        Ok(m) => m,
        Err(e) => return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some(e),
        },
    };
    
    let time_out_minutes = match parse_time_to_minutes(&row.time_out) {
        Ok(m) => m,
        Err(e) => return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some(e),
        },
    };
    
    // Validate times are 15-minute increments
    if time_in_minutes % 15 != 0 || time_out_minutes % 15 != 0 {
        return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some("Times must be in 15-minute increments".to_string()),
        };
    }
    
    // Validate time_out > time_in
    if time_out_minutes <= time_in_minutes {
        return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some("Time Out must be after Time In".to_string()),
        };
    }
    
    // Get database connection
    let db_guard = match crate::database::get_connection() {
        Ok(g) => g,
        Err(e) => return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some(format!("Database error: {}", e)),
        },
    };
    
    let conn = match db_guard.as_ref() {
        Some(c) => c,
        None => return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some("Database not initialized".to_string()),
        },
    };
    
    // If row has an id, UPDATE; otherwise INSERT
    let result = if let Some(id) = row.id {
        conn.execute(
            "UPDATE timesheet
             SET date = ?, time_in = ?, time_out = ?, project = ?, tool = ?, 
                 detail_charge_code = ?, task_description = ?, status = NULL
             WHERE id = ?",
            params![
                &row.date,
                time_in_minutes,
                time_out_minutes,
                &row.project,
                row.tool.as_deref(),
                row.charge_code.as_deref(),
                &row.task_description,
                id
            ],
        )
    } else {
        conn.execute(
            "INSERT INTO timesheet
             (date, time_in, time_out, project, tool, detail_charge_code, task_description, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
             ON CONFLICT(date, time_in, project, task_description) DO UPDATE SET
               time_out = excluded.time_out,
               tool = excluded.tool,
               detail_charge_code = excluded.detail_charge_code,
               status = NULL",
            params![
                &row.date,
                time_in_minutes,
                time_out_minutes,
                &row.project,
                row.tool.as_deref(),
                row.charge_code.as_deref(),
                &row.task_description
            ],
        )
    };
    
    match result {
        Ok(changes) => SaveDraftResponse {
            success: true,
            changes: Some(changes),
            error: None,
        },
        Err(e) => SaveDraftResponse {
            success: false,
            changes: None,
            error: Some(format!("Database error: {}", e)),
        },
    }
}

#[tauri::command]
pub async fn load_timesheet_draft() -> LoadDraftResponse {
    // Get database connection
    let db_guard = match crate::database::get_connection() {
        Ok(g) => g,
        Err(e) => return LoadDraftResponse {
            success: false,
            entries: vec![],
            error: Some(format!("Database error: {}", e)),
        },
    };
    
    let conn = match db_guard.as_ref() {
        Some(c) => c,
        None => return LoadDraftResponse {
            success: false,
            entries: vec![],
            error: Some("Database not initialized".to_string()),
        },
    };
    
    // Query pending entries (status IS NULL)
    let mut stmt = match conn.prepare(
        "SELECT id, date, time_in, time_out, project, tool, detail_charge_code, task_description
         FROM timesheet
         WHERE status IS NULL
         ORDER BY date ASC, time_in ASC"
    ) {
        Ok(s) => s,
        Err(e) => return LoadDraftResponse {
            success: false,
            entries: vec![],
            error: Some(format!("Failed to prepare query: {}", e)),
        },
    };
    
    let entries_iter = stmt.query_map([], |row| {
        Ok(TimesheetRow {
            id: Some(row.get(0)?),
            date: row.get(1)?,
            time_in: format_minutes_to_time(row.get(2)?),
            time_out: format_minutes_to_time(row.get(3)?),
            project: row.get(4)?,
            tool: row.get(5)?,
            charge_code: row.get(6)?,
            task_description: row.get(7)?,
        })
    });
    
    match entries_iter {
        Ok(iter) => {
            let entries: Vec<TimesheetRow> = iter.filter_map(|r| r.ok()).collect();
            
            // Return one blank row if no entries
            let entries_to_return = if entries.is_empty() {
                vec![TimesheetRow {
                    id: None,
                    date: String::new(),
                    time_in: String::new(),
                    time_out: String::new(),
                    project: String::new(),
                    tool: None,
                    charge_code: None,
                    task_description: String::new(),
                }]
            } else {
                entries
            };
            
            LoadDraftResponse {
                success: true,
                entries: entries_to_return,
                error: None,
            }
        }
        Err(e) => LoadDraftResponse {
            success: false,
            entries: vec![],
            error: Some(format!("Failed to load entries: {}", e)),
        },
    }
}

#[tauri::command]
pub async fn delete_timesheet_draft(id: i64) -> SaveDraftResponse {
    // Get database connection
    let db_guard = match crate::database::get_connection() {
        Ok(g) => g,
        Err(e) => return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some(format!("Database error: {}", e)),
        },
    };
    
    let conn = match db_guard.as_ref() {
        Some(c) => c,
        None => return SaveDraftResponse {
            success: false,
            changes: None,
            error: Some("Database not initialized".to_string()),
        },
    };
    
    // Delete entry if it's in draft state (status IS NULL)
    let result = conn.execute(
        "DELETE FROM timesheet WHERE id = ? AND status IS NULL",
        params![id],
    );
    
    match result {
        Ok(changes) => {
            if changes == 0 {
                SaveDraftResponse {
                    success: false,
                    changes: Some(0),
                    error: Some("Draft entry not found".to_string()),
                }
            } else {
                SaveDraftResponse {
                    success: true,
                    changes: Some(changes),
                    error: None,
                }
            }
        }
        Err(e) => SaveDraftResponse {
            success: false,
            changes: None,
            error: Some(format!("Database error: {}", e)),
        },
    }
}

#[tauri::command]
pub async fn get_all_archive_data(token: String) -> ArchiveDataResponse {
    // Validate session
    let session = crate::auth::validate_session(&token);
    if !session.valid {
        return ArchiveDataResponse {
            success: false,
            timesheet: vec![],
            credentials: vec![],
            error: Some("Session is invalid or expired. Please log in again.".to_string()),
        };
    }
    
    // Get database connection
    let db_guard = match crate::database::get_connection() {
        Ok(g) => g,
        Err(e) => return ArchiveDataResponse {
            success: false,
            timesheet: vec![],
            credentials: vec![],
            error: Some(format!("Database error: {}", e)),
        },
    };
    
    let conn = match db_guard.as_ref() {
        Some(c) => c,
        None => return ArchiveDataResponse {
            success: false,
            timesheet: vec![],
            credentials: vec![],
            error: Some("Database not initialized".to_string()),
        },
    };
    
    // Fetch timesheet entries (Complete status only)
    let mut timesheet_stmt = match conn.prepare(
        "SELECT id, date, time_in, time_out, hours, project, tool, detail_charge_code, 
                task_description, status, submitted_at
         FROM timesheet
         WHERE status = 'Complete'
         ORDER BY date DESC, time_in DESC"
    ) {
        Ok(s) => s,
        Err(e) => return ArchiveDataResponse {
            success: false,
            timesheet: vec![],
            credentials: vec![],
            error: Some(format!("Failed to prepare timesheet query: {}", e)),
        },
    };
    
    let timesheet_iter = timesheet_stmt.query_map([], |row| {
        Ok(ArchiveEntry {
            id: row.get(0)?,
            date: row.get(1)?,
            time_in: row.get(2)?,
            time_out: row.get(3)?,
            hours: row.get(4)?,
            project: row.get(5)?,
            tool: row.get(6)?,
            detail_charge_code: row.get(7)?,
            task_description: row.get(8)?,
            status: row.get(9)?,
            submitted_at: row.get(10)?,
        })
    });
    
    let timesheet: Vec<ArchiveEntry> = match timesheet_iter {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(e) => return ArchiveDataResponse {
            success: false,
            timesheet: vec![],
            credentials: vec![],
            error: Some(format!("Failed to fetch timesheet: {}", e)),
        },
    };
    
    // Fetch credentials (without passwords)
    let mut cred_stmt = match conn.prepare(
        "SELECT id, service, email, created_at, updated_at
         FROM credentials
         ORDER BY service"
    ) {
        Ok(s) => s,
        Err(e) => return ArchiveDataResponse {
            success: true,
            timesheet,
            credentials: vec![],
            error: Some(format!("Failed to prepare credentials query: {}", e)),
        },
    };
    
    let cred_iter = cred_stmt.query_map([], |row| {
        Ok(CredentialInfo {
            id: row.get(0)?,
            service: row.get(1)?,
            email: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    });
    
    let credentials: Vec<CredentialInfo> = match cred_iter {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => vec![],
    };
    
    ArchiveDataResponse {
        success: true,
        timesheet,
        credentials,
        error: None,
    }
}
