use super::browser::{BrowserError, BrowserManager};
use serde::{Deserialize, Serialize};

/// Result of automation execution
#[derive(Debug, Serialize, Deserialize)]
pub struct AutomationResult {
    /// Whether automation succeeded
    pub success: bool,
    /// Indices of successfully submitted rows
    pub submitted_indices: Vec<usize>,
    /// Errors: (row_index, error_message)
    pub errors: Vec<(usize, String)>,
    /// Total rows processed
    pub total_rows: usize,
    /// Number of successful submissions
    pub success_count: usize,
    /// Number of failures
    pub failure_count: usize,
}

/// Timesheet row data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimesheetRow {
    pub date: String,
    pub time_in: String,
    pub time_out: String,
    pub project: String,
    pub tool: Option<String>,
    pub charge_code: Option<String>,
    pub task_description: String,
}

/// Bot orchestrator - coordinates browser automation
pub struct BotOrchestrator {
    browser_manager: Option<BrowserManager>,
    headless: bool,
    form_config: FormConfig,
}

/// Form configuration for automation
#[derive(Debug, Clone)]
pub struct FormConfig {
    pub base_url: String,
    pub form_id: String,
    #[allow(dead_code)]
    pub submission_endpoint: String,
}

impl BotOrchestrator {
    /// Creates a new bot orchestrator
    pub fn new(headless: bool, form_config: FormConfig) -> Result<Self, BrowserError> {
        Ok(BotOrchestrator {
            browser_manager: None,
            headless,
            form_config,
        })
    }

    /// Starts the browser
    pub async fn start(&mut self) -> Result<(), BrowserError> {
        let mut browser = BrowserManager::new(self.headless)?;
        browser.start().await?;
        self.browser_manager = Some(browser);
        Ok(())
    }

    /// Closes the browser
    pub async fn close(&mut self) -> Result<(), BrowserError> {
        if let Some(mut browser) = self.browser_manager.take() {
            browser.close().await?;
        }
        Ok(())
    }

    /// Runs the automation process
    pub async fn run_automation(
        &mut self,
        rows: Vec<TimesheetRow>,
        email: String,
        password: String,
    ) -> Result<AutomationResult, String> {
        use super::authentication::LoginManager;
        use super::webform::WebformFiller;

        // Check if browser is started
        let browser = self
            .browser_manager
            .as_ref()
            .ok_or("Browser not started".to_string())?;

        let total_rows = rows.len();
        let mut submitted_indices = Vec::new();
        let mut errors = Vec::new();

        // Create a page for automation
        let page = browser
            .new_page()
            .await
            .map_err(|e| format!("Failed to create page: {}", e))?;

        tracing::info!(rows = total_rows, "Starting automation");

        // Step 1: Login
        tracing::info!("Step 1: Authenticating");
        let login_manager = LoginManager::new(self.form_config.base_url.clone());

        match login_manager.run_login(&page, &email, &password).await {
            Ok(_) => tracing::info!("Authentication successful"),
            Err(e) => {
                let error_msg = format!("Authentication failed: {}", e);
                tracing::error!("{}", error_msg);
                // Mark all rows as failed due to auth failure
                for idx in 0..total_rows {
                    errors.push((idx, error_msg.clone()));
                }
                return Ok(AutomationResult {
                    success: false,
                    submitted_indices,
                    errors,
                    total_rows,
                    success_count: 0,
                    failure_count: total_rows,
                });
            }
        }

        // Step 2: Navigate to form
        tracing::info!("Step 2: Navigating to form");
        let webform_filler = WebformFiller::new(self.form_config.form_id.clone());

        if let Err(e) = webform_filler
            .navigate_to_form(&page, &self.form_config.base_url)
            .await
        {
            let error_msg = format!("Failed to navigate to form: {}", e);
            tracing::error!("{}", error_msg);
            for idx in 0..total_rows {
                errors.push((idx, error_msg.clone()));
            }
            return Ok(AutomationResult {
                success: false,
                submitted_indices,
                errors,
                total_rows,
                success_count: 0,
                failure_count: total_rows,
            });
        }

        // Step 3: Fill and submit entries
        tracing::info!("Step 3: Filling timesheet entries");
        for (idx, row) in rows.iter().enumerate() {
            tracing::info!(row = idx + 1, total = total_rows, "Processing row");

            match webform_filler.fill_entry(&page, row, idx).await {
                Ok(_) => {
                    tracing::info!(row = idx + 1, "Row filled successfully");
                    submitted_indices.push(idx);
                }
                Err(e) => {
                    let error_msg = format!("Failed to fill row: {}", e);
                    tracing::error!(row = idx + 1, error = %e, "Failed to fill row");
                    errors.push((idx, error_msg));
                }
            }
        }

        // Step 4: Submit the form (if any entries were filled)
        if !submitted_indices.is_empty() {
            tracing::info!("Step 4: Submitting form");
            match webform_filler.submit_form(&page).await {
                Ok(_) => {
                    tracing::info!("Form submitted");
                    // Verify submission
                    match webform_filler.verify_submission(&page).await {
                        Ok(true) => tracing::info!("Submission verified"),
                        Ok(false) => tracing::warn!("Could not verify submission"),
                        Err(e) => tracing::warn!(error = %e, "Verification error"),
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to submit form: {}", e);
                    tracing::error!(error = %e, "Failed to submit form");
                    // Mark all submitted indices as errors
                    for idx in submitted_indices.iter() {
                        errors.push((*idx, error_msg.clone()));
                    }
                    submitted_indices.clear();
                }
            }
        }

        let success_count = submitted_indices.len();
        let failure_count = errors.len();

        tracing::info!(
            succeeded = success_count,
            failed = failure_count,
            "Automation complete"
        );

        Ok(AutomationResult {
            success: success_count > 0,
            submitted_indices,
            errors,
            total_rows,
            success_count,
            failure_count,
        })
    }
}

/// High-level function to run timesheet automation
pub async fn run_timesheet(
    rows: Vec<TimesheetRow>,
    email: String,
    password: String,
    form_config: FormConfig,
    headless: bool,
) -> Result<AutomationResult, String> {
    // Handle empty rows
    if rows.is_empty() {
        return Ok(AutomationResult {
            success: true,
            submitted_indices: Vec::new(),
            errors: Vec::new(),
            total_rows: 0,
            success_count: 0,
            failure_count: 0,
        });
    }

    // Create and start bot
    let mut bot = BotOrchestrator::new(headless, form_config)
        .map_err(|e| format!("Failed to create bot: {}", e))?;

    // Start browser
    bot.start()
        .await
        .map_err(|e| format!("Failed to start browser: {}", e))?;

    // Run automation
    let result = bot.run_automation(rows, email, password).await;

    // Always close browser
    let _ = bot.close().await;

    result
}
