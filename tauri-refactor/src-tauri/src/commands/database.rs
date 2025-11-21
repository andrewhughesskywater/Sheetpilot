use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TimesheetRow {
    pub id: Option<i64>,
    pub date: String,
    pub time_in: String,
    pub time_out: String,
    pub project: String,
    pub tool: Option<String>,
    pub charge_code: Option<String>,
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

#[tauri::command]
pub async fn save_timesheet_draft(row: TimesheetRow) -> SaveDraftResponse {
    // TODO: Implement database save logic
    // Convert time strings to minutes, validate, and save to database
    SaveDraftResponse {
        success: false,
        changes: None,
        error: Some("Not yet implemented".to_string()),
    }
}

#[tauri::command]
pub async fn load_timesheet_draft() -> LoadDraftResponse {
    // TODO: Implement database load logic
    // Load pending entries from database
    LoadDraftResponse {
        success: true,
        entries: vec![],
        error: None,
    }
}

#[tauri::command]
pub async fn delete_timesheet_draft(id: i64) -> SaveDraftResponse {
    // TODO: Implement database delete logic
    SaveDraftResponse {
        success: false,
        changes: None,
        error: Some("Not yet implemented".to_string()),
    }
}

#[tauri::command]
pub async fn get_all_archive_data(token: String) -> serde_json::Value {
    // TODO: Implement archive data retrieval
    // Validate session and return all completed timesheet entries
    serde_json::json!({
        "success": false,
        "error": "Not yet implemented",
        "timesheet": [],
        "credentials": []
    })
}

