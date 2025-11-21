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
pub async fn timesheet_submit(
    _token: String,
    service: String,
    base_url: String,
    form_id: String,
) -> SubmitResponse {
    use crate::bot::{run_timesheet, FormConfig, TimesheetRow};

    // Get database pool
    let pool = match crate::database::get_pool() {
        Ok(p) => p,
        Err(e) => {
            return SubmitResponse {
                error: Some(format!("Database error: {}", e)),
                submit_result: None,
            }
        }
    };

    // STEP 1: Retrieve stored credentials
    let credentials = match sqlx::query!(
        "SELECT email, password FROM credentials WHERE service = ?",
        service
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some(cred)) => cred,
        Ok(None) => {
            return SubmitResponse {
                error: Some(format!(
                    "No credentials found for service '{}'. Please store credentials first.",
                    service
                )),
                submit_result: None,
            }
        }
        Err(e) => {
            return SubmitResponse {
                error: Some(format!("Failed to retrieve credentials: {}", e)),
                submit_result: None,
            }
        }
    };

    // STEP 2: Mark draft entries as "Submitting" with timestamp
    let mark_result = sqlx::query!(
        "UPDATE timesheet 
         SET status = 'Submitting',
             submission_started_at = datetime('now')
         WHERE status IS NULL"
    )
    .execute(pool)
    .await;

    if let Err(e) = mark_result {
        return SubmitResponse {
            error: Some(format!("Failed to lock entries for submission: {}", e)),
            submit_result: None,
        };
    }

    let rows_marked = mark_result.unwrap().rows_affected();
    if rows_marked == 0 {
        return SubmitResponse {
            error: Some("No draft entries to submit".to_string()),
            submit_result: None,
        };
    }

    tracing::info!("Marked {} entries for submission", rows_marked);

    // STEP 3: Load entries from database (source of truth)
    let db_entries = match sqlx::query!(
        "SELECT id, date, time_in, time_out, project, tool, 
                detail_charge_code, task_description
         FROM timesheet
         WHERE status = 'Submitting'
         ORDER BY date ASC, time_in ASC"
    )
    .fetch_all(pool)
    .await
    {
        Ok(entries) => entries,
        Err(e) => {
            // Rollback on error
            let _ = sqlx::query!(
                "UPDATE timesheet 
                 SET status = NULL, submission_started_at = NULL 
                 WHERE status = 'Submitting'"
            )
            .execute(pool)
            .await;
            
            return SubmitResponse {
                error: Some(format!("Failed to load entries from database: {}", e)),
                submit_result: None,
            };
        }
    };

    // Convert to bot format
    let rows: Vec<TimesheetRow> = db_entries
        .iter()
        .map(|entry| TimesheetRow {
            date: entry.date.clone(),
            time_in: format_time(entry.time_in),
            time_out: format_time(entry.time_out),
            project: entry.project.clone(),
            tool: entry.tool.clone(),
            charge_code: entry.detail_charge_code.clone(),
            task_description: entry.task_description.clone(),
        })
        .collect();

    // STEP 4: Create form config and run bot
    let form_config = FormConfig {
        base_url,
        form_id,
        submission_endpoint: String::new(),
    };

    tracing::info!("Starting bot automation for {} entries", rows.len());

    let bot_result = run_timesheet(
        rows,
        credentials.email,
        credentials.password,
        form_config,
        false,
    )
    .await;

    // STEP 5: Update database based on bot results
    match bot_result {
        Ok(result) => {
            let mut submitted_ids = Vec::new();
            let mut failed_count = 0;

            // Mark successful entries as Complete
            for (idx, entry) in db_entries.iter().enumerate() {
                if result.submitted_indices.contains(&idx) {
                    let update_result = sqlx::query!(
                        "UPDATE timesheet 
                         SET status = 'Complete',
                             submitted_at = datetime('now'),
                             submission_started_at = NULL
                         WHERE id = ?",
                        entry.id
                    )
                    .execute(pool)
                    .await;

                    if update_result.is_ok() {
                        submitted_ids.push(entry.id);
                        tracing::info!("Entry {} marked as Complete", entry.id);
                    }
                } else {
                    // Mark failed entries
                    let _ = sqlx::query!(
                        "UPDATE timesheet 
                         SET status = 'Failed',
                             submission_started_at = NULL
                         WHERE id = ?",
                        entry.id
                    )
                    .execute(pool)
                    .await;
                    
                    failed_count += 1;
                    tracing::warn!("Entry {} marked as Failed", entry.id);
                }
            }

            tracing::info!(
                "Submission complete: {} succeeded, {} failed",
                submitted_ids.len(),
                failed_count
            );

            SubmitResponse {
                error: if failed_count > 0 {
                    Some(format!("{} entries failed to submit", failed_count))
                } else {
                    None
                },
                submit_result: Some(SubmissionResult {
                    ok: result.success,
                    submitted_ids,
                    removed_ids: vec![],
                    total_processed: result.total_rows,
                    success_count: result.success_count,
                    removed_count: 0,
                    error: None,
                }),
            }
        }
        Err(e) => {
            // Bot failed completely - mark all as Failed
            let _ = sqlx::query!(
                "UPDATE timesheet 
                 SET status = 'Failed',
                     submission_started_at = NULL
                 WHERE status = 'Submitting'"
            )
            .execute(pool)
            .await;

            tracing::error!("Bot automation failed: {}", e);

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
    let pool = match crate::database::get_pool() {
        Ok(p) => p,
        Err(e) => {
            return ExportResponse {
                success: false,
                csv_data: None,
                entry_count: None,
                filename: None,
                error: Some(format!("Failed to access database: {}", e)),
            }
        }
    };

    // Get submitted entries
    let result = sqlx::query!(
        "SELECT date, time_in, time_out, hours, project, tool, detail_charge_code, task_description, status, submitted_at
         FROM timesheet
         WHERE status = 'Complete'
         ORDER BY date DESC, time_in DESC"
    )
    .fetch_all(pool)
    .await;

    let entries: Vec<_> = match result {
        Ok(rows) => rows
            .into_iter()
            .map(|row| (
                row.date,
                row.time_in,
                row.time_out,
                row.hours,
                row.project,
                row.tool,
                row.detail_charge_code,
                row.task_description,
                row.status.unwrap_or_default(),
                row.submitted_at.unwrap_or_default(),
            ))
            .collect(),
        Err(e) => {
            return ExportResponse {
                success: false,
                csv_data: None,
                entry_count: None,
                filename: None,
                error: Some(format!("Failed to fetch entries: {}", e)),
            }
        }
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

    for (
        date,
        time_in,
        time_out,
        hours,
        project,
        tool,
        charge_code,
        task_description,
        status,
        submitted_at,
    ) in entries.iter()
    {
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
    let filename = format!(
        "timesheet_export_{}.csv",
        chrono::Local::now().format("%Y-%m-%d")
    );

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
