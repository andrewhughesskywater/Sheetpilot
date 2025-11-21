/// Quarter configuration tests
#[cfg(test)]
mod tests {
    use crate::bot::quarter_config::*;

    #[test]
    fn test_get_quarter_definitions_count() {
        let quarters = get_quarter_definitions();
        assert_eq!(quarters.len(), 4); // Q1-Q4 2025
    }

    #[test]
    fn test_get_quarter_for_date_q1() {
        let quarter = get_quarter_for_date("2025-01-15");
        assert!(quarter.is_some());
        let q = quarter.unwrap();
        assert_eq!(q.id, "Q1-2025");
        assert_eq!(q.name, "Q1 2025");
    }

    #[test]
    fn test_get_quarter_for_date_q2() {
        let quarter = get_quarter_for_date("2025-05-01");
        assert!(quarter.is_some());
        let q = quarter.unwrap();
        assert_eq!(q.id, "Q2-2025");
    }

    #[test]
    fn test_get_quarter_for_date_q3() {
        let quarter = get_quarter_for_date("2025-07-15");
        assert!(quarter.is_some());
        let q = quarter.unwrap();
        assert_eq!(q.id, "Q3-2025");
        assert_eq!(q.form_id, "0197cbae7daf72bdb96b3395b500d414");
    }

    #[test]
    fn test_get_quarter_for_date_q4() {
        let quarter = get_quarter_for_date("2025-11-15");
        assert!(quarter.is_some());
        let q = quarter.unwrap();
        assert_eq!(q.id, "Q4-2025");
        assert_eq!(q.form_id, "0199fabee6497e60abb6030c48d84585");
    }

    #[test]
    fn test_get_quarter_for_date_invalid_year() {
        let quarter = get_quarter_for_date("2024-01-01");
        assert!(quarter.is_none());
    }

    #[test]
    fn test_get_quarter_for_date_invalid_format() {
        let quarter = get_quarter_for_date("2025/01/01");
        assert!(quarter.is_none());
    }

    #[test]
    fn test_get_quarter_for_date_empty() {
        let quarter = get_quarter_for_date("");
        assert!(quarter.is_none());
    }

    #[test]
    fn test_get_quarter_for_date_boundary_start() {
        // Test Q1 start date
        let quarter = get_quarter_for_date("2025-01-01");
        assert!(quarter.is_some());
        assert_eq!(quarter.unwrap().id, "Q1-2025");
        
        // Test Q3 start date
        let quarter = get_quarter_for_date("2025-07-01");
        assert!(quarter.is_some());
        assert_eq!(quarter.unwrap().id, "Q3-2025");
    }

    #[test]
    fn test_get_quarter_for_date_boundary_end() {
        // Test Q1 end date
        let quarter = get_quarter_for_date("2025-03-31");
        assert!(quarter.is_some());
        assert_eq!(quarter.unwrap().id, "Q1-2025");
        
        // Test Q4 end date
        let quarter = get_quarter_for_date("2025-12-31");
        assert!(quarter.is_some());
        assert_eq!(quarter.unwrap().id, "Q4-2025");
    }

    #[test]
    fn test_validate_quarter_availability_valid() {
        let error = validate_quarter_availability("2025-07-15");
        assert!(error.is_none());
    }

    #[test]
    fn test_validate_quarter_availability_invalid() {
        let error = validate_quarter_availability("2024-01-01");
        assert!(error.is_some());
        assert!(error.unwrap().contains("Date must be in"));
    }

    #[test]
    fn test_validate_quarter_availability_empty() {
        let error = validate_quarter_availability("");
        assert!(error.is_some());
        assert_eq!(error.unwrap(), "Please enter a date");
    }

    #[test]
    fn test_get_available_quarter_ids() {
        let ids = get_available_quarter_ids();
        assert_eq!(ids.len(), 4);
        assert!(ids.contains(&"Q1-2025".to_string()));
        assert!(ids.contains(&"Q2-2025".to_string()));
        assert!(ids.contains(&"Q3-2025".to_string()));
        assert!(ids.contains(&"Q4-2025".to_string()));
    }

    #[test]
    fn test_get_quarter_by_id_valid() {
        let quarter = get_quarter_by_id("Q3-2025");
        assert!(quarter.is_some());
        let q = quarter.unwrap();
        assert_eq!(q.id, "Q3-2025");
        assert_eq!(q.form_id, "0197cbae7daf72bdb96b3395b500d414");
    }

    #[test]
    fn test_get_quarter_by_id_invalid() {
        let quarter = get_quarter_by_id("Q5-2025");
        assert!(quarter.is_none());
    }

    #[test]
    fn test_quarter_definitions_no_gaps() {
        let quarters = get_quarter_definitions();
        
        // Check that Q1 starts on Jan 1
        assert_eq!(quarters[0].start_date, "2025-01-01");
        
        // Check that Q4 ends on Dec 31
        assert_eq!(quarters[3].end_date, "2025-12-31");
        
        // Check that quarters are contiguous (no gaps)
        for i in 0..quarters.len()-1 {
            let current_end = chrono::NaiveDate::parse_from_str(&quarters[i].end_date, "%Y-%m-%d").unwrap();
            let next_start = chrono::NaiveDate::parse_from_str(&quarters[i+1].start_date, "%Y-%m-%d").unwrap();
            
            // Next quarter should start the day after current ends
            assert_eq!(next_start, current_end + chrono::Duration::days(1));
        }
    }

    #[test]
    fn test_form_ids_are_unique() {
        let quarters = get_quarter_definitions();
        let mut form_ids = Vec::new();
        
        for quarter in quarters {
            assert!(!form_ids.contains(&quarter.form_id));
            form_ids.push(quarter.form_id);
        }
    }

    #[test]
    fn test_form_urls_contain_form_ids() {
        let quarters = get_quarter_definitions();
        
        for quarter in quarters {
            // Skip placeholder quarters
            if !quarter.form_id.contains("placeholder") {
                assert!(quarter.form_url.contains(&quarter.form_id));
            }
        }
    }
}

