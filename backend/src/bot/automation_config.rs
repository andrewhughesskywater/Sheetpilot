/// Automation Configuration - Central configuration for timesheet automation
/// 
/// This module contains all configuration constants for the timesheet automation system.

use std::env;

/// Parse environment variable as number with default
fn env_num(key: &str, default: f64) -> f64 {
    env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

/// Parse environment variable as boolean with default
fn env_bool(key: &str, default: bool) -> bool {
    env::var(key)
        .map(|s| s.to_lowercase() == "true" || s == "1")
        .unwrap_or(default)
}

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

/// Default timeout for element operations in seconds
pub fn element_wait_timeout() -> f64 {
    env_num("ELEMENT_WAIT", 10.0)
}

/// Global timeout for all operations in seconds
pub fn global_timeout() -> f64 {
    env_num("GLOBAL_TIMEOUT", 10.0)
}

// ============================================================================
// DYNAMIC WAIT CONFIGURATION
// ============================================================================

/// Whether dynamic wait functionality is enabled
pub fn dynamic_wait_enabled() -> bool {
    env_bool("DYNAMIC_WAIT_ENABLED", true)
}

/// Base timeout for dynamic wait operations in seconds
pub fn dynamic_wait_base_timeout() -> f64 {
    env_num("DYNAMIC_WAIT_BASE_TIMEOUT", 0.2)
}

/// Maximum timeout for dynamic wait operations in seconds
pub fn dynamic_wait_max_timeout() -> f64 {
    env_num("DYNAMIC_WAIT_MAX_TIMEOUT", 10.0)
}

/// Multiplier for increasing wait timeouts in dynamic wait
pub fn dynamic_wait_multiplier() -> f64 {
    env_num("DYNAMIC_WAIT_MULTIPLIER", 1.2)
}

// ============================================================================
// FORM SUBMISSION CONFIGURATION
// ============================================================================

/// Whether to automatically submit forms after filling
pub fn submit_form_after_filling() -> bool {
    env_bool("SUBMIT", true)
}

/// Timeout for verifying submission success in milliseconds
pub fn submit_verify_timeout_ms() -> u64 {
    env_num("SUBMIT_VERIFY_MS", 3000.0) as u64
}

/// Minimum HTTP status code considered successful for submission
pub fn submit_success_min_status() -> u16 {
    env_num("SUBMIT_MIN_STATUS", 200.0) as u16
}

/// Maximum HTTP status code considered successful for submission
pub fn submit_success_max_status() -> u16 {
    env_num("SUBMIT_MAX_STATUS", 299.0) as u16
}

/// Number of retry attempts for failed form submissions
pub fn submit_retry_attempts() -> usize {
    env_num("SUBMIT_RETRY_ATTEMPTS", 3.0) as usize
}

/// Delay between submission retry attempts in seconds
pub fn submit_retry_delay() -> f64 {
    env_num("SUBMIT_RETRY_DELAY", 2.0)
}

// ============================================================================
// SUBMIT BUTTON CONFIGURATION
// ============================================================================

/// Primary CSS selector for the submit button
pub const SUBMIT_BUTTON_LOCATOR: &str = "button[data-client-id='form_submit_btn']";

/// Fallback selectors for finding submit buttons when primary fails
pub fn submit_button_fallback_locators() -> Vec<&'static str> {
    vec![
        "button[data-client-id='form_submit_btn']",
        "button:has-text('Submit')",
        "button:has-text('Save')",
        "button:has-text('Send')",
        "input[type='submit']",
        "button[type='submit']",
        "button.submit",
        "button[aria-label*='submit']",
        "button[aria-label*='save']",
        "button[title*='submit']",
        "button[title*='save']",
    ]
}

// ============================================================================
// FIELD VALIDATION CONFIGURATION
// ============================================================================

/// Timeout for field validation operations in milliseconds
pub fn field_validation_timeout_ms() -> u64 {
    env_num("FIELD_VALIDATION_TIMEOUT_MS", 1000.0) as u64
}

/// Whether to stop validation on first failure
pub fn field_validation_fail_fast() -> bool {
    env_bool("FIELD_VALIDATION_FAIL_FAST", true)
}

/// Maximum number of retries for field validation
pub fn field_validation_max_retries() -> usize {
    env_num("FIELD_VALIDATION_MAX_RETRIES", 1.0) as usize
}

// ============================================================================
// AUTOMATION BEHAVIOR CONFIGURATION
// ============================================================================

/// Whether to stop automation when a row fails to process
pub fn automation_stop_on_row_failure() -> bool {
    env_bool("AUTOMATION_STOP_ON_ROW_FAILURE", true)
}

// ============================================================================
// BROWSER DIMENSIONS
// ============================================================================

/// Width of the browser viewport in pixels
pub const BROWSER_VIEWPORT_WIDTH: u32 = 1400;

/// Height of the browser viewport in pixels
pub const BROWSER_VIEWPORT_HEIGHT: u32 = 1000;

// ============================================================================
// LOGIN CONFIGURATION
// ============================================================================

/// Login step definition
#[derive(Debug, Clone)]
pub struct LoginStep {
    pub name: String,
    pub action: LoginAction,
    pub locator: Option<String>,
    pub element_selector: Option<String>,
    pub value_key: Option<String>,
    pub wait_condition: Option<String>,
    pub expects_navigation: bool,
    pub optional: bool,
    pub sensitive: bool,
}

/// Login action types
#[derive(Debug, Clone)]
pub enum LoginAction {
    Wait,
    Input,
    Click,
}

/// Sequence of steps to perform during login process
pub fn login_steps() -> Vec<LoginStep> {
    vec![
        LoginStep {
            name: "Wait for Login Form".to_string(),
            action: LoginAction::Wait,
            locator: None,
            element_selector: Some("#loginEmail".to_string()),
            value_key: None,
            wait_condition: Some("visible".to_string()),
            expects_navigation: false,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Email Input".to_string(),
            action: LoginAction::Input,
            locator: Some("#loginEmail".to_string()),
            element_selector: None,
            value_key: Some("email".to_string()),
            wait_condition: None,
            expects_navigation: false,
            optional: false,
            sensitive: true,
        },
        LoginStep {
            name: "Continue".to_string(),
            action: LoginAction::Click,
            locator: Some("#formControl".to_string()),
            element_selector: None,
            value_key: None,
            wait_condition: None,
            expects_navigation: true,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Wait for SSO Choice".to_string(),
            action: LoginAction::Wait,
            locator: None,
            element_selector: Some("a.clsJspButtonWide".to_string()),
            value_key: None,
            wait_condition: Some("visible".to_string()),
            expects_navigation: false,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Login with company account".to_string(),
            action: LoginAction::Click,
            locator: Some("a.clsJspButtonWide".to_string()),
            element_selector: None,
            value_key: None,
            wait_condition: None,
            expects_navigation: true,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Wait for AAD Email".to_string(),
            action: LoginAction::Wait,
            locator: None,
            element_selector: Some("#i0116".to_string()),
            value_key: None,
            wait_condition: Some("visible".to_string()),
            expects_navigation: false,
            optional: false,
            sensitive: false,
        },
        LoginStep {
            name: "AAD Email".to_string(),
            action: LoginAction::Input,
            locator: Some("#i0116".to_string()),
            element_selector: None,
            value_key: Some("email".to_string()),
            wait_condition: None,
            expects_navigation: false,
            optional: false,
            sensitive: true,
        },
        LoginStep {
            name: "AAD Next".to_string(),
            action: LoginAction::Click,
            locator: Some("#idSIButton9".to_string()),
            element_selector: None,
            value_key: None,
            wait_condition: None,
            expects_navigation: true,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Wait for Password".to_string(),
            action: LoginAction::Wait,
            locator: None,
            element_selector: Some("#passwordInput".to_string()),
            value_key: None,
            wait_condition: Some("visible".to_string()),
            expects_navigation: false,
            optional: false,
            sensitive: false,
        },
        LoginStep {
            name: "Password Input".to_string(),
            action: LoginAction::Input,
            locator: Some("#passwordInput".to_string()),
            element_selector: None,
            value_key: Some("password".to_string()),
            wait_condition: None,
            expects_navigation: false,
            optional: false,
            sensitive: true,
        },
        LoginStep {
            name: "Password Submit".to_string(),
            action: LoginAction::Click,
            locator: Some("#submitButton".to_string()),
            element_selector: None,
            value_key: None,
            wait_condition: None,
            expects_navigation: true,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Stay Signed In Prompt".to_string(),
            action: LoginAction::Wait,
            locator: None,
            element_selector: Some("#idBtn_Back".to_string()),
            value_key: None,
            wait_condition: Some("visible".to_string()),
            expects_navigation: false,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Stay Signed In — No".to_string(),
            action: LoginAction::Click,
            locator: Some("#idBtn_Back".to_string()),
            element_selector: None,
            value_key: None,
            wait_condition: None,
            expects_navigation: true,
            optional: true,
            sensitive: false,
        },
        LoginStep {
            name: "Wait for Form Page Ready".to_string(),
            action: LoginAction::Wait,
            locator: None,
            element_selector: Some("input[aria-label='Project']".to_string()),
            value_key: None,
            wait_condition: Some("visible".to_string()),
            expects_navigation: false,
            optional: false,
            sensitive: false,
        },
    ]
}

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

/// Field definition for form automation
#[derive(Debug, Clone)]
pub struct FieldDefinition {
    pub label: String,
    pub locator: String,
    pub optional: bool,
    pub inject_value: bool,
}

/// Configuration for form fields including locators and behavior
pub fn field_definitions() -> Vec<(&'static str, FieldDefinition)> {
    vec![
        ("project_code", FieldDefinition {
            label: "Project".to_string(),
            locator: "input[aria-label='Project']".to_string(),
            optional: false,
            inject_value: true,
        }),
        ("date", FieldDefinition {
            label: "Date".to_string(),
            locator: "input[placeholder='mm/dd/yyyy']".to_string(),
            optional: false,
            inject_value: true,
        }),
        ("hours", FieldDefinition {
            label: "Hours".to_string(),
            locator: "input[aria-label='Hours']".to_string(),
            optional: false,
            inject_value: true,
        }),
        ("task_description", FieldDefinition {
            label: "Task Description".to_string(),
            locator: "role=textbox[name='Task Description']".to_string(),
            optional: false,
            inject_value: true,
        }),
        ("tool", FieldDefinition {
            label: "Tool".to_string(),
            locator: "input[aria-label*='Tool']".to_string(),
            optional: true,
            inject_value: true,
        }),
        ("detail_code", FieldDefinition {
            label: "Detail Charge Code".to_string(),
            locator: "input[aria-label='Detail Charge Code']".to_string(),
            optional: true,
            inject_value: true,
        }),
    ]
}

/// Order in which fields should be processed during form filling
pub fn field_order() -> Vec<&'static str> {
    vec![
        "project_code",
        "date",
        "hours",
        "tool",
        "task_description",
        "detail_code",
    ]
}

// ============================================================================
// RESPONSE VALIDATION
// ============================================================================

/// Text indicators that suggest successful form submission
pub fn submit_success_indicators() -> Vec<&'static str> {
    vec![
        "submissionId",
        "confirmation",
        "success! we've captured your submission",
        "form submitted successfully",
        "thank you for your submission",
    ]
}

