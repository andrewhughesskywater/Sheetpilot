use sqlx::SqlitePool;

/// Recover submissions that are stuck in "Submitting" state
/// Considers a submission stuck if it's been in progress for more than 30 minutes
pub async fn recover_stuck_submissions(pool: &SqlitePool) -> Result<usize, String> {
    let result = sqlx::query!(
        "UPDATE timesheet 
         SET status = 'Failed',
             submission_started_at = NULL
         WHERE status = 'Submitting' 
         AND datetime(submission_started_at) < datetime('now', '-30 minutes')"
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Recovery failed: {}", e))?;
    
    let recovered = result.rows_affected();
    
    if recovered > 0 {
        tracing::warn!("Recovered {} stuck entries from previous session", recovered);
    }
    
    Ok(recovered as usize)
}

/// Get all entries that failed submission
pub async fn get_failed_entries(pool: &SqlitePool) -> Result<Vec<FailedEntry>, String> {
    let rows = sqlx::query_as!(
        FailedEntry,
        "SELECT id, date, time_in, time_out, hours, project, tool, 
                detail_charge_code, task_description, submission_started_at
         FROM timesheet 
         WHERE status = 'Failed'
         ORDER BY date DESC, time_in DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch failed entries: {}", e))?;
    
    Ok(rows)
}

/// Reset failed entries back to draft state
pub async fn reset_failed_to_draft(pool: &SqlitePool) -> Result<usize, String> {
    let result = sqlx::query!(
        "UPDATE timesheet 
         SET status = NULL, 
             submission_started_at = NULL 
         WHERE status = 'Failed'"
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to reset entries: {}", e))?;
    
    Ok(result.rows_affected() as usize)
}

/// Check if a submission is currently in progress
pub async fn is_submission_in_progress(pool: &SqlitePool) -> Result<bool, String> {
    let result = sqlx::query!(
        "SELECT COUNT(*) as count 
         FROM timesheet 
         WHERE status = 'Submitting'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to check submission status: {}", e))?;
    
    Ok(result.count > 0)
}

#[derive(Debug, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct FailedEntry {
    pub id: i64,
    pub date: String,
    pub time_in: i64,
    pub time_out: i64,
    pub hours: f64,
    pub project: String,
    pub tool: Option<String>,
    pub detail_charge_code: Option<String>,
    pub task_description: String,
    pub submission_started_at: Option<String>,
}

