use super::automation_config::{self, LoginAction};
use chromiumoxide::error::CdpError;
use chromiumoxide::page::Page;
use std::time::Duration;

/// Authentication errors
#[derive(Debug)]
pub enum AuthError {
    NavigationFailed(String),
    ElementNotFound(String),
    CredentialsFailed(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            AuthError::NavigationFailed(msg) => write!(f, "Navigation failed: {}", msg),
            AuthError::ElementNotFound(msg) => write!(f, "Element not found: {}", msg),
            AuthError::CredentialsFailed(msg) => write!(f, "Credentials failed: {}", msg),
        }
    }
}

impl std::error::Error for AuthError {}

impl From<CdpError> for AuthError {
    fn from(err: CdpError) -> Self {
        AuthError::NavigationFailed(format!("CDP error: {}", err))
    }
}

/// Login manager for handling authentication
pub struct LoginManager {
    pub base_url: String,
    pub max_retries: usize,
}

impl LoginManager {
    /// Creates a new LoginManager
    pub fn new(base_url: String) -> Self {
        LoginManager {
            base_url,
            max_retries: 3,
        }
    }

    /// Navigates to the base URL
    async fn navigate_to_base(&self, page: &Page) -> Result<(), AuthError> {
        tracing::info!(url = %self.base_url, "Navigating to base URL");

        page.goto(&self.base_url)
            .await
            .map_err(|e| AuthError::NavigationFailed(format!("Failed to navigate: {}", e)))?;

        // Wait for page to load
        page.wait_for_navigation()
            .await
            .map_err(|e| AuthError::NavigationFailed(format!("Navigation wait failed: {}", e)))?;

        tracing::info!("Successfully navigated to base URL");
        Ok(())
    }

    /// Runs the complete login flow using LOGIN_STEPS configuration
    pub async fn run_login(
        &self,
        page: &Page,
        email: &str,
        password: &str,
    ) -> Result<(), AuthError> {
        let redacted_email = crate::redact_email(email);
        
        tracing::info!(
            steps = automation_config::login_steps().len(),
            email = %redacted_email,
            "Starting login process"
        );

        // Navigate with retries
        let mut attempt = 0;
        while attempt < self.max_retries {
            attempt += 1;
            tracing::debug!(attempt, max_retries = self.max_retries, "Navigation attempt");

            match self.navigate_to_base(page).await {
                Ok(_) => break,
                Err(e) if attempt >= self.max_retries => return Err(e),
                Err(e) => {
                    tracing::warn!(attempt, error = %e, "Navigation failed, retrying");
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
            }
        }

        // Execute login steps from configuration
        for (i, step) in automation_config::login_steps().iter().enumerate() {
            tracing::info!(
                step = i + 1,
                total = automation_config::login_steps().len(),
                name = %step.name,
                "Executing login step"
            );

            let result = match &step.action {
                LoginAction::Wait => self.execute_wait_step(page, step).await,
                LoginAction::Input => self.execute_input_step(page, step, email, password).await,
                LoginAction::Click => self.execute_click_step(page, step).await,
            };

            match result {
                Ok(_) => {
                    tracing::debug!(step = %step.name, "Step completed successfully");
                }
                Err(e) if step.optional => {
                    tracing::warn!(step = %step.name, error = %e, "Optional step failed");
                }
                Err(e) => {
                    tracing::error!(step = %step.name, error = %e, "Required step failed");
                    return Err(e);
                }
            }

            // Small delay between steps
            tokio::time::sleep(Duration::from_millis(300)).await;
        }

        tracing::info!("Login process completed successfully");
        Ok(())
    }

    /// Executes a wait step
    async fn execute_wait_step(
        &self,
        page: &Page,
        step: &automation_config::LoginStep,
    ) -> Result<(), AuthError> {
        let selector = step.element_selector.as_ref().ok_or_else(|| {
            AuthError::ElementNotFound("Wait step missing element_selector".to_string())
        })?;

        tracing::debug!(selector = %selector, "Waiting for element");
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Try to find element
        match page.find_element(selector).await {
            Ok(_) => {
                tracing::debug!(selector = %selector, "Element found");
                Ok(())
            }
            Err(_) if step.optional => {
                tracing::debug!(selector = %selector, "Optional element not found");
                Ok(())
            }
            Err(e) => Err(AuthError::ElementNotFound(format!(
                "Element '{}' not found: {}",
                selector, e
            ))),
        }
    }

    /// Executes an input step
    async fn execute_input_step(
        &self,
        page: &Page,
        step: &automation_config::LoginStep,
        email: &str,
        password: &str,
    ) -> Result<(), AuthError> {
        let locator = step
            .locator
            .as_ref()
            .ok_or_else(|| AuthError::ElementNotFound("Input step missing locator".to_string()))?;

        let value_key = step.value_key.as_ref().ok_or_else(|| {
            AuthError::CredentialsFailed("Input step missing value_key".to_string())
        })?;

        // Determine which value to use
        let value = match value_key.as_str() {
            "email" => email,
            "password" => password,
            _ => {
                return Err(AuthError::CredentialsFailed(format!(
                    "Unknown value_key: {}",
                    value_key
                )))
            }
        };

        tracing::debug!(
            locator = %locator,
            value = if step.sensitive { "<redacted>" } else { value },
            "Filling input field"
        );

        // Wait a bit for field to be ready
        tokio::time::sleep(Duration::from_millis(500)).await;

        // Find and fill the element
        let element = page.find_element(locator).await.map_err(|e| {
            AuthError::ElementNotFound(format!("Input field '{}' not found: {}", locator, e))
        })?;

        element.click().await.map_err(|e| {
            AuthError::ElementNotFound(format!("Failed to click input field: {}", e))
        })?;

        element.type_str(value).await.map_err(|e| {
            AuthError::CredentialsFailed(format!("Failed to type into field: {}", e))
        })?;

        tracing::debug!("Input field filled successfully");
        Ok(())
    }

    /// Executes a click step
    async fn execute_click_step(
        &self,
        page: &Page,
        step: &automation_config::LoginStep,
    ) -> Result<(), AuthError> {
        let locator = step
            .locator
            .as_ref()
            .ok_or_else(|| AuthError::ElementNotFound("Click step missing locator".to_string()))?;

        tracing::debug!(locator = %locator, "Clicking element");

        // Wait a bit for element to be ready
        tokio::time::sleep(Duration::from_millis(500)).await;

        // Find and click the element
        let element = page.find_element(locator).await.map_err(|e| {
            AuthError::ElementNotFound(format!("Click target '{}' not found: {}", locator, e))
        })?;

        element
            .click()
            .await
            .map_err(|e| AuthError::NavigationFailed(format!("Failed to click element: {}", e)))?;

        tracing::debug!("Element clicked successfully");

        // If this step expects navigation, wait for it
        if step.expects_navigation {
            tracing::debug!("Waiting for navigation after click");
            tokio::time::sleep(Duration::from_secs(3)).await;
        }

        Ok(())
    }
}
