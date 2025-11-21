pub mod browser;
pub mod orchestration;

pub use browser::{find_chrome_path, is_chrome_available, BrowserManager, BrowserError};
pub use orchestration::{run_timesheet, BotOrchestrator, TimesheetRow, AutomationResult, FormConfig};
