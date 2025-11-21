use chromiumoxide::browser::{Browser, BrowserConfig};
use chromiumoxide::page::Page;
use std::path::PathBuf;
use futures::StreamExt; // For handler.next()

/// Error types for browser operations
#[derive(Debug)]
pub enum BrowserError {
    ChromeNotFound(String),
    LaunchFailed(String),
    PageCreationFailed(String),
}

impl std::fmt::Display for BrowserError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            BrowserError::ChromeNotFound(msg) => write!(f, "Chrome not found: {}", msg),
            BrowserError::LaunchFailed(msg) => write!(f, "Browser launch failed: {}", msg),
            BrowserError::PageCreationFailed(msg) => write!(f, "Page creation failed: {}", msg),
        }
    }
}

impl std::error::Error for BrowserError {}

/// Finds the Chrome executable path on Windows
pub fn find_chrome_path() -> Result<PathBuf, BrowserError> {
    let possible_paths = vec![
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];
    
    for path_str in possible_paths {
        let path = PathBuf::from(path_str);
        if path.exists() {
            return Ok(path);
        }
    }
    
    Err(BrowserError::ChromeNotFound(
        "Chrome not found - enterprise environment should have Chrome installed".to_string()
    ))
}

/// Checks if Chrome is available on the system
pub fn is_chrome_available() -> bool {
    find_chrome_path().is_ok()
}

/// Browser manager for automation
pub struct BrowserManager {
    browser: Option<Browser>,
    chrome_path: PathBuf,
    headless: bool,
}

impl BrowserManager {
    /// Creates a new BrowserManager
    pub fn new(headless: bool) -> Result<Self, BrowserError> {
        let chrome_path = find_chrome_path()?;
        
        Ok(BrowserManager {
            browser: None,
            chrome_path,
            headless,
        })
    }
    
    /// Launches the browser
    pub async fn start(&mut self) -> Result<(), BrowserError> {
        let mut config = BrowserConfig::builder()
            .chrome_executable(&self.chrome_path)
            .with_head(); // Show browser window (not headless for now)
        
        if self.headless {
            config = BrowserConfig::builder()
                .chrome_executable(&self.chrome_path);
        }
        
        let (browser, mut handler) = Browser::launch(
            config.build()
                .map_err(|e| BrowserError::LaunchFailed(format!("Config build failed: {}", e)))?
        )
        .await
        .map_err(|e| BrowserError::LaunchFailed(format!("Browser launch failed: {}", e)))?;
        
        // Spawn handler to run in background
        tokio::spawn(async move {
            while let Some(event) = handler.next().await {
                // Handle browser events if needed
            }
        });
        
        self.browser = Some(browser);
        Ok(())
    }
    
    /// Creates a new page
    pub async fn new_page(&self) -> Result<Page, BrowserError> {
        let browser = self.browser.as_ref()
            .ok_or_else(|| BrowserError::PageCreationFailed("Browser not started".to_string()))?;
        
        let page = browser
            .new_page("about:blank")
            .await
            .map_err(|e| BrowserError::PageCreationFailed(format!("Failed to create page: {}", e)))?;
        
        Ok(page)
    }
    
    /// Closes the browser
    pub async fn close(&mut self) -> Result<(), BrowserError> {
        if let Some(mut browser) = self.browser.take() {
            browser.close().await
                .map_err(|e| BrowserError::LaunchFailed(format!("Failed to close browser: {}", e)))?;
        }
        Ok(())
    }
}

impl Drop for BrowserManager {
    fn drop(&mut self) {
        // Browser will be closed automatically when dropped
    }
}

