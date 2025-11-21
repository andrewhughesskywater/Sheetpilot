/// Quarter Configuration - Defines quarters and form routing
/// 
/// This module contains quarter definitions, date-to-quarter mapping logic,
/// and validation functions for routing timesheet entries to appropriate forms.

use serde::{Deserialize, Serialize};
use chrono::NaiveDate;

/// Quarter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarterDefinition {
    /// Quarter identifier (e.g., 'Q3-2025')
    pub id: String,
    /// Human-readable quarter name
    pub name: String,
    /// Start date in YYYY-MM-DD format
    pub start_date: String,
    /// End date in YYYY-MM-DD format
    pub end_date: String,
    /// SmartSheet form URL
    pub form_url: String,
    /// SmartSheet form ID extracted from URL
    pub form_id: String,
}

/// Available quarters configuration
/// 
/// To add new quarters:
/// 1. Add new QuarterDefinition to this vector
/// 2. Specify date range and form URL/ID
/// 3. No other changes needed - routing logic automatically handles new quarters
pub fn get_quarter_definitions() -> Vec<QuarterDefinition> {
    vec![
        QuarterDefinition {
            id: "Q1-2025".to_string(),
            name: "Q1 2025".to_string(),
            start_date: "2025-01-01".to_string(),
            end_date: "2025-03-31".to_string(),
            form_url: "https://app.smartsheet.com/b/form/q1-2025-placeholder".to_string(),
            form_id: "q1-2025-placeholder".to_string(),
        },
        QuarterDefinition {
            id: "Q2-2025".to_string(),
            name: "Q2 2025".to_string(),
            start_date: "2025-04-01".to_string(),
            end_date: "2025-06-30".to_string(),
            form_url: "https://app.smartsheet.com/b/form/q2-2025-placeholder".to_string(),
            form_id: "q2-2025-placeholder".to_string(),
        },
        QuarterDefinition {
            id: "Q3-2025".to_string(),
            name: "Q3 2025".to_string(),
            start_date: "2025-07-01".to_string(),
            end_date: "2025-09-30".to_string(),
            form_url: "https://app.smartsheet.com/b/form/0197cbae7daf72bdb96b3395b500d414".to_string(),
            form_id: "0197cbae7daf72bdb96b3395b500d414".to_string(),
        },
        QuarterDefinition {
            id: "Q4-2025".to_string(),
            name: "Q4 2025".to_string(),
            start_date: "2025-10-01".to_string(),
            end_date: "2025-12-31".to_string(),
            form_url: "https://app.smartsheet.com/b/form/0199fabee6497e60abb6030c48d84585".to_string(),
            form_id: "0199fabee6497e60abb6030c48d84585".to_string(),
        },
    ]
}

/// Gets mock quarter definition when in mock mode
fn get_mock_quarter_definition() -> QuarterDefinition {
    let mock_base_url = std::env::var("MOCK_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3456".to_string());
    let mock_form_id = std::env::var("MOCK_FORM_ID")
        .unwrap_or_else(|_| "mock-form-123".to_string());
    
    QuarterDefinition {
        id: "MOCK-QUARTER".to_string(),
        name: "Mock Quarter (Testing)".to_string(),
        start_date: "2000-01-01".to_string(),
        end_date: "2099-12-31".to_string(),
        form_url: mock_base_url,
        form_id: mock_form_id,
    }
}

/// Determines which quarter a date falls into
/// 
/// # Arguments
/// * `date_str` - Date in YYYY-MM-DD format
/// 
/// # Returns
/// Quarter definition if date falls within a quarter, None otherwise
pub fn get_quarter_for_date(date_str: &str) -> Option<QuarterDefinition> {
    // If in mock mode, return mock quarter for all dates
    if std::env::var("MOCK_MODE").unwrap_or_default() == "true" {
        return Some(get_mock_quarter_definition());
    }
    
    if date_str.is_empty() {
        return None;
    }
    
    // Parse the date
    let target_date = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return None,
    };
    
    // Check each quarter definition
    for quarter in get_quarter_definitions() {
        let start_date = match NaiveDate::parse_from_str(&quarter.start_date, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        
        let end_date = match NaiveDate::parse_from_str(&quarter.end_date, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        
        if target_date >= start_date && target_date <= end_date {
            return Some(quarter);
        }
    }
    
    None
}

/// Validates if a date falls within any available quarter
/// 
/// # Arguments
/// * `date_str` - Date in YYYY-MM-DD format
/// 
/// # Returns
/// Error message if date is invalid or outside quarters, None if valid
pub fn validate_quarter_availability(date_str: &str) -> Option<String> {
    if date_str.is_empty() {
        return Some("Please enter a date".to_string());
    }
    
    // Check if date falls within any quarter
    if get_quarter_for_date(date_str).is_none() {
        // Create helpful error message listing available quarters
        let available_quarters: Vec<String> = get_quarter_definitions()
            .iter()
            .map(|q| {
                let start_parts: Vec<&str> = q.start_date.split('-').collect();
                let end_parts: Vec<&str> = q.end_date.split('-').collect();
                format!(
                    "{} ({}/{}-{}/{})",
                    q.name,
                    start_parts.get(1).unwrap_or(&""),
                    start_parts.get(2).unwrap_or(&""),
                    end_parts.get(1).unwrap_or(&""),
                    end_parts.get(2).unwrap_or(&"")
                )
            })
            .collect();
        
        return Some(format!("Date must be in {}", available_quarters.join(" or ")));
    }
    
    None
}

/// Gets all available quarter IDs
pub fn get_available_quarter_ids() -> Vec<String> {
    get_quarter_definitions().iter().map(|q| q.id.clone()).collect()
}

/// Gets quarter definition by ID
pub fn get_quarter_by_id(quarter_id: &str) -> Option<QuarterDefinition> {
    get_quarter_definitions()
        .into_iter()
        .find(|q| q.id == quarter_id)
}

/// Gets the current quarter based on today's date
pub fn get_current_quarter() -> Option<QuarterDefinition> {
    let today = chrono::Local::now().naive_local().date();
    let today_str = today.format("%Y-%m-%d").to_string();
    get_quarter_for_date(&today_str)
}

#[cfg(test)]
#[path = "quarter_config_test.rs"]
mod quarter_config_test;

