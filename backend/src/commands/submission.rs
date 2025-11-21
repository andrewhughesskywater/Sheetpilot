use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitResponse {
    pub error: Option<String>,
    pub submit_result: Option<SubmissionResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmissionResult {
    pub ok: bool,
    pub submitted_ids: Vec<i64>,
    pub removed_ids: Vec<i64>,
    pub total_processed: usize,
    pub success_count: usize,
    pub removed_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResponse {
    pub success: bool,
    pub csv_data: Option<String>,
    pub entry_count: Option<usize>,
    pub filename: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub entries: Vec<TimesheetEntry>,
    pub email: String,
    pub password: String,
    pub base_url: String,
    pub form_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TimesheetEntry {
    pub date: String,
    pub time_in: String,
    pub time_out: String,
    pub project: String,
    pub tool: Option<String>,
    pub charge_code: Option<String>,
    pub task_description: String,
}

#[tauri::command]
pub async fn timesheet_submit(_token: String, request: SubmitRequest) -> SubmitResponse {
    // Use bot automation to submit entries
    use crate::bot::{run_timesheet, TimesheetRow, FormConfig};
    
    // Convert entries to bot format
    let rows: Vec<TimesheetRow> = request.entries.into_iter().map(|entry| TimesheetRow {
        date: entry.date,
        time_in: entry.time_in,
        time_out: entry.time_out,
        project: entry.project,
        tool: entry.tool,
        charge_code: entry.charge_code,
        task_description: entry.task_description,
    }).collect();
    
    // Create form config
    let form_config = FormConfig {
        base_url: request.base_url,
        form_id: request.form_id,
        submission_endpoint: String::new(), // TODO: Get from config
    };
    
    // Run automation (headless = false for now for debugging)
    match run_timesheet(rows, request.email, request.password, form_config, false).await {
        Ok(result) => {
            SubmitResponse {
                error: if result.success { None } else { Some("Some entries failed to submit".to_string()) },
                submit_result: Some(SubmissionResult {
                    ok: result.success,
                    submitted_ids: vec![], // TODO: Track IDs
                    removed_ids: vec![],
                    total_processed: result.total_rows,
                    success_count: result.success_count,
                    removed_count: 0,
                    error: None,
                }),
            }
        }
        Err(e) => {
            SubmitResponse {
                error: Some(format!("Automation failed: {}", e)),
                submit_result: None,
            }
        }
    }
}

/// Format minutes since midnight to HH:MM
fn format_time(minutes: i64) -> String {
    let hours = minutes / 60;
    let mins = minutes % 60;
    format!("{:02}:{:02}", hours, mins)
}

#[tauri::command]
pub async fn timesheet_export_csv() -> ExportResponse {
    let db_guard = match crate::database::get_connection() {
        Ok(g) => g,
        Err(e) => return ExportResponse {
            success: false,
            csv_data: None,
            entry_count: None,
            filename: None,
            error: Some(format!("Failed to access database: {}", e)),
        },
    };
    
    let conn = match db_guard.as_ref() {
        Some(c) => c,
        None => return ExportResponse {
            success: false,
            csv_data: None,
            entry_count: None,
            filename: None,
            error: Some("Database not initialized".to_string()),
        },
    };
    
    // Get submitted entries
    let mut stmt = match conn.prepare(
        "SELECT date, time_in, time_out, hours, project, tool, detail_charge_code, task_description, status, submitted_at
         FROM timesheet
         WHERE status = 'Complete'
         ORDER BY date DESC, time_in DESC"
    ) {
        Ok(s) => s,
        Err(e) => return ExportResponse {
            success: false,
            csv_data: None,
            entry_count: None,
            filename: None,
            error: Some(format!("Failed to prepare query: {}", e)),
        },
    };
    
    let entries_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,   // date
            row.get::<_, i64>(1)?,       // time_in
            row.get::<_, i64>(2)?,       // time_out
            row.get::<_, f64>(3)?,       // hours
            row.get::<_, String>(4)?,    // project
            row.get::<_, Option<String>>(5)?,  // tool
            row.get::<_, Option<String>>(6)?,  // detail_charge_code
            row.get::<_, String>(7)?,    // task_description
            row.get::<_, String>(8)?,    // status
            row.get::<_, String>(9)?,    // submitted_at
        ))
    });
    
    let entries: Vec<_> = match entries_iter {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(e) => return ExportResponse {
            success: false,
            csv_data: None,
            entry_count: None,
            filename: None,
            error: Some(format!("Failed to fetch entries: {}", e)),
        },
    };
    
    if entries.is_empty() {
        return ExportResponse {
            success: false,
            csv_data: None,
            entry_count: None,
            filename: None,
            error: Some("No submitted timesheet entries found to export".to_string()),
        };
    }
    
    // Build CSV
    let mut csv_rows = vec![
        "Date,Start Time,End Time,Hours,Project,Tool,Charge Code,Task Description,Status,Submitted At".to_string()
    ];
    
    for (date, time_in, time_out, hours, project, tool, charge_code, task_description, status, submitted_at) in entries.iter() {
        let row = format!(
            "{},{},{},{},{},{},{},{},{},{}",
            date,
            format_time(*time_in),
            format_time(*time_out),
            hours,
            escape_csv_field(project),
            escape_csv_field(&tool.as_deref().unwrap_or("")),
            escape_csv_field(&charge_code.as_deref().unwrap_or("")),
            escape_csv_field(task_description),
            status,
            submitted_at
        );
        csv_rows.push(row);
    }
    
    let csv_content = csv_rows.join("\n");
    let entry_count = entries.len();
    
    // Generate filename with current date
    let filename = format!("timesheet_export_{}.csv", chrono::Local::now().format("%Y-%m-%d"));
    
    ExportResponse {
        success: true,
        csv_data: Some(csv_content),
        entry_count: Some(entry_count),
        filename: Some(filename),
        error: None,
    }
}

/// Escape CSV field (wrap in quotes and escape internal quotes)
fn escape_csv_field(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        format!("\"{}\"", field)
    }
}
