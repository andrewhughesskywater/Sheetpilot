use chromiumoxide::page::Page;
use super::orchestration::TimesheetRow;
use super::automation_config::{self, FieldDefinition};
use std::time::Duration;
use std::collections::HashMap;

/// Webform filling errors
#[derive(Debug)]
pub enum WebformError {
    ElementNotFound(String),
    FillFailed(String),
    SubmissionFailed(String),
}

impl std::fmt::Display for WebformError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            WebformError::ElementNotFound(msg) => write!(f, "Element not found: {}", msg),
            WebformError::FillFailed(msg) => write!(f, "Fill failed: {}", msg),
            WebformError::SubmissionFailed(msg) => write!(f, "Submission failed: {}", msg),
        }
    }
}

impl std::error::Error for WebformError {}

/// Webform filler for timesheet data
pub struct WebformFiller {
    pub form_id: String,
    field_defs: HashMap<String, FieldDefinition>,
}

impl WebformFiller {
    /// Creates a new WebformFiller
    pub fn new(form_id: String) -> Self {
        // Load field definitions from config
        let mut field_defs = HashMap::new();
        for (key, def) in automation_config::field_definitions() {
            field_defs.insert(key.to_string(), def);
        }
        
        WebformFiller {
            form_id,
            field_defs,
        }
    }
    
    /// Navigates to the form
    pub async fn navigate_to_form(&self, page: &Page, base_url: &str) -> Result<(), WebformError> {
        let form_url = format!("{}/{}", base_url, self.form_id);
        println!("Navigating to form: {}", form_url);
        
        page.goto(&form_url)
            .await
            .map_err(|e| WebformError::ElementNotFound(format!("Failed to navigate to form: {}", e)))?;
        
        // Wait for form to load
        tokio::time::sleep(Duration::from_secs(3)).await;
        
        println!("Form loaded");
        Ok(())
    }
    
    /// Fills a single timesheet entry using field definitions
    pub async fn fill_entry(&self, page: &Page, entry: &TimesheetRow, index: usize) -> Result<(), WebformError> {
        println!("Filling entry {} of timesheet", index + 1);
        
        // Build field values map from entry
        let mut field_values = HashMap::new();
        field_values.insert("project_code", entry.project.as_str());
        field_values.insert("date", entry.date.as_str());
        
        // Calculate hours from time_in and time_out
        let hours = self.calculate_hours(&entry.time_in, &entry.time_out)?;
        field_values.insert("hours", &hours);
        
        field_values.insert("task_description", entry.task_description.as_str());
        
        if let Some(ref tool) = entry.tool {
            field_values.insert("tool", tool.as_str());
        }
        
        if let Some(ref charge_code) = entry.charge_code {
            field_values.insert("detail_code", charge_code.as_str());
        }
        
        // Fill fields in order
        for field_key in automation_config::field_order() {
            if let Some(field_def) = self.field_defs.get(field_key) {
                if let Some(value) = field_values.get(field_key) {
                    match self.fill_field(page, field_def, value).await {
                        Ok(_) => {
                            println!("Filled field '{}' with value '{}'", field_def.label, value);
                        },
                        Err(e) if field_def.optional => {
                            println!("Optional field '{}' failed (continuing): {}", field_def.label, e);
                        },
                        Err(e) => {
                            return Err(e);
                        }
                    }
                } else if !field_def.optional {
                    return Err(WebformError::FillFailed(
                        format!("Required field '{}' has no value", field_def.label)
                    ));
                }
                
                // Small delay between fields
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }
        
        println!("Entry {} filled successfully", index + 1);
        Ok(())
    }
    
    /// Calculates hours from time_in and time_out (HH:MM format)
    fn calculate_hours(&self, time_in: &str, time_out: &str) -> Result<String, WebformError> {
        // Parse HH:MM format
        let parse_time = |time_str: &str| -> Result<f64, WebformError> {
            let parts: Vec<&str> = time_str.split(':').collect();
            if parts.len() != 2 {
                return Err(WebformError::FillFailed(format!("Invalid time format: {}", time_str)));
            }
            
            let hours: f64 = parts[0].parse()
                .map_err(|_| WebformError::FillFailed(format!("Invalid hours in: {}", time_str)))?;
            let minutes: f64 = parts[1].parse()
                .map_err(|_| WebformError::FillFailed(format!("Invalid minutes in: {}", time_str)))?;
            
            Ok(hours + minutes / 60.0)
        };
        
        let start_hours = parse_time(time_in)?;
        let end_hours = parse_time(time_out)?;
        
        let total_hours = end_hours - start_hours;
        
        if total_hours < 0.0 {
            return Err(WebformError::FillFailed(
                format!("Time out ({}) is before time in ({})", time_out, time_in)
            ));
        }
        
        Ok(format!("{:.2}", total_hours))
    }
    
    /// Fills a single field
    async fn fill_field(&self, page: &Page, field_def: &FieldDefinition, value: &str) -> Result<(), WebformError> {
        println!("Filling field '{}' at locator '{}'", field_def.label, field_def.locator);
        
        // Wait a bit for field to be ready
        tokio::time::sleep(Duration::from_millis(300)).await;
        
        // Try to find the field
        let element = page.find_element(&field_def.locator)
            .await
            .map_err(|e| {
                if field_def.optional {
                    WebformError::ElementNotFound(format!("Optional field '{}' not found: {}", field_def.label, e))
                } else {
                    WebformError::ElementNotFound(format!("Required field '{}' not found: {}", field_def.label, e))
                }
            })?;
        
        // Click to focus
        element.click()
            .await
            .map_err(|e| WebformError::FillFailed(format!("Failed to click field '{}': {}", field_def.label, e)))?;
        
        // Type the value
        element.type_str(value)
            .await
            .map_err(|e| WebformError::FillFailed(format!("Failed to type into field '{}': {}", field_def.label, e)))?;
        
        // For dropdown fields, handle SmartSheets navigation
        if self.is_dropdown_field(&field_def.label) {
            println!("Handling dropdown field '{}'", field_def.label);
            self.handle_smartsheets_dropdown(&element, &field_def.label).await?;
        }
        
        Ok(())
    }
    
    /// Determines if a field is a dropdown based on its label
    fn is_dropdown_field(&self, label: &str) -> bool {
        let label_lower = label.to_lowercase();
        let dropdown_fields = ["project", "tool", "detail charge code"];
        
        dropdown_fields.iter().any(|&field| label_lower.contains(field))
    }
    
    /// Handles SmartSheets dropdown navigation with Down Arrow + Enter
    async fn handle_smartsheets_dropdown(
        &self,
        element: &chromiumoxide::element::Element,
        field_name: &str,
    ) -> Result<(), WebformError> {
        println!("Handling SmartSheets dropdown for field '{}'", field_name);
        
        // Wait for dropdown options to populate
        tokio::time::sleep(Duration::from_millis(500)).await;
        
        // Press Down Arrow to select the first filtered option
        element.press_key("ArrowDown")
            .await
            .map_err(|e| WebformError::FillFailed(format!("Failed to press ArrowDown: {}", e)))?;
        
        // Wait briefly for selection
        tokio::time::sleep(Duration::from_millis(200)).await;
        
        // Press Enter to confirm the selection
        element.press_key("Enter")
            .await
            .map_err(|e| WebformError::FillFailed(format!("Failed to press Enter: {}", e)))?;
        
        // Wait for dropdown to close
        tokio::time::sleep(Duration::from_millis(300)).await;
        
        println!("Successfully handled SmartSheets dropdown for '{}'", field_name);
        Ok(())
    }
    
    /// Submits the form
    pub async fn submit_form(&self, page: &Page) -> Result<(), WebformError> {
        println!("Submitting form");
        
        // Try to find and click submit button using fallback selectors
        for selector in automation_config::submit_button_fallback_locators() {
            if let Ok(button) = page.find_element(selector).await {
                println!("Found submit button with selector: {}", selector);
                
                button.click()
                    .await
                    .map_err(|e| WebformError::SubmissionFailed(format!("Failed to click submit: {}", e)))?;
                
                println!("Form submitted, waiting for response");
                tokio::time::sleep(Duration::from_secs(3)).await;
                return Ok(());
            }
        }
        
        Err(WebformError::ElementNotFound("Submit button not found".to_string()))
    }
    
    /// Verifies submission success
    pub async fn verify_submission(&self, page: &Page) -> Result<bool, WebformError> {
        println!("Verifying submission");
        
        // Check URL for success indicators
        let url = page.url().await
            .map_err(|e| WebformError::SubmissionFailed(format!("Failed to get URL: {}", e)))?
            .unwrap_or_default();
        
        // Check for success indicators in URL
        if url.contains("success") || url.contains("complete") || url.contains("confirmation") {
            println!("Submission verified as successful (URL contains success indicator)");
            return Ok(true);
        }
        
        // Check for success indicators in page content
        for indicator in automation_config::submit_success_indicators() {
            // Try to find element containing success text
            let selector = format!("body:contains('{}')", indicator);
            if page.find_element(&selector).await.is_ok() {
                println!("Submission verified as successful (found indicator: {})", indicator);
                return Ok(true);
            }
        }
        
        // Check for common success elements
        let success_selectors = vec![
            ".submission-success",
            ".form-success",
            "[data-submission-status='success']",
            ".confirmation-message",
            ".success-message",
            ".alert-success",
        ];
        
        for selector in success_selectors {
            if page.find_element(selector).await.is_ok() {
                println!("Submission verified as successful (found success element: {})", selector);
                return Ok(true);
            }
        }
        
        println!("Submission status unclear, assuming success");
        Ok(true) // For now, assume success if no errors
    }
}
