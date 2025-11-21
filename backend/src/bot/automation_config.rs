/// Automation Configuration - Central configuration for timesheet automation
///
/// This module contains all configuration constants for the timesheet automation system.

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
}

/// Configuration for form fields including locators and behavior
pub fn field_definitions() -> Vec<(&'static str, FieldDefinition)> {
    vec![
        (
            "project_code",
            FieldDefinition {
                label: "Project".to_string(),
                locator: "input[aria-label='Project']".to_string(),
                optional: false,
            },
        ),
        (
            "date",
            FieldDefinition {
                label: "Date".to_string(),
                locator: "input[placeholder='mm/dd/yyyy']".to_string(),
                optional: false,
            },
        ),
        (
            "hours",
            FieldDefinition {
                label: "Hours".to_string(),
                locator: "input[aria-label='Hours']".to_string(),
                optional: false,
            },
        ),
        (
            "task_description",
            FieldDefinition {
                label: "Task Description".to_string(),
                locator: "role=textbox[name='Task Description']".to_string(),
                optional: false,
            },
        ),
        (
            "tool",
            FieldDefinition {
                label: "Tool".to_string(),
                locator: "input[aria-label*='Tool']".to_string(),
                optional: true,
            },
        ),
        (
            "detail_code",
            FieldDefinition {
                label: "Detail Charge Code".to_string(),
                locator: "input[aria-label='Detail Charge Code']".to_string(),
                optional: true,
            },
        ),
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
// SUBMIT BUTTON CONFIGURATION
// ============================================================================

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
