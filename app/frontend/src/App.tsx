import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon
} from '@mui/icons-material';
import Archive from './components/DatabaseViewer';
const TimesheetGrid = lazy(() => import('./components/TimesheetGrid'));
import ModernSegmentedNavigation from './components/ModernSegmentedNavigation';
import Help from './components/Help';
import UpdateDialog from './components/UpdateDialog';
import LoginDialog from './components/LoginDialog';
import { DataProvider, useData } from './contexts/DataContext';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { initializeTheme } from './utils/theme-manager';
import logoImage from './assets/images/transparent-logo.svg';
import { APP_VERSION } from './config/constants';
import './styles/App.css';

function AppContent() {
  console.log('=== APP CONTENT RENDERING ===');
  const { isLoggedIn, isLoading: sessionLoading, login: sessionLogin } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  console.log('Active tab:', activeTab);
  
  const [isExporting, setIsExporting] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  
  // Update dialog state
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<'downloading' | 'installing'>('downloading');
  
  // Use data context
  const { refreshTimesheetDraft, refreshArchiveData } = useData();

  // Load data when user navigates to tabs (on-demand loading)
  useEffect(() => {
    if (!isLoggedIn) return;
    
    if (activeTab === 0) {
      // User navigated to timesheet tab - load data now
      refreshTimesheetDraft();
    } else if (activeTab === 1) {
      // User navigated to archive tab - load data now
      refreshArchiveData();
    }
     
  }, [activeTab, isLoggedIn]);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);
  
  // Listen for update events
  useEffect(() => {
    if (!window.updates) {
      return;
    }
    
    // Listen for update available
    window.updates.onUpdateAvailable((version) => {
      window.logger?.info('Update available event received', { version });
      setUpdateVersion(version);
      setUpdateStatus('downloading');
      setShowUpdateDialog(true);
    });
    
    // Listen for download progress
    window.updates.onDownloadProgress((progress) => {
      window.logger?.debug('Download progress', { percent: progress.percent });
      setUpdateProgress(progress.percent);
    });
    
    // Listen for update downloaded
    window.updates.onUpdateDownloaded((version) => {
      window.logger?.info('Update downloaded event received', { version });
      setUpdateStatus('installing');
    });
    
    // Cleanup listeners on unmount
    return () => {
      window.updates?.removeAllListeners();
    };
  }, []);









  const exportToCSV = async () => {
    // Prevent multiple simultaneous exports
    if (isExporting) return;
    
    window.logger?.userAction('export-to-csv-clicked');
    setIsExporting(true);
    
    try {
      // CSV export functionality not yet implemented
      window.logger?.info('CSV export requested');
    } catch (error) {
      window.logger?.error('CSV export error', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <div className="top-navigation">
        {/* App Logo/Branding */}
        <div className="app-branding">
          <img 
            src={logoImage} 
            alt="SheetPilot" 
            className="app-logo"
            onLoad={() => window.logger?.debug('Logo loaded successfully')}
            onError={(e) => console.error('Logo failed to load:', e)}
          />
          <button 
            className="app-logo-button"
            onClick={() => {
              window.logger?.userAction('about-dialog-opened');
              setShowAboutDialog(true);
            }}
            aria-label="About SheetPilot"
            title="Click to view about information"
          />
        </div>

        {/* Modern Segmented Navigation */}
        <ModernSegmentedNavigation 
          activeTab={activeTab} 
          onTabChange={(newTab) => {
            window.logger?.userAction('tab-change', { from: activeTab, to: newTab });
            setActiveTab(newTab);
          }}
        />
      </div>
      
      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Header Actions */}
        <div className="header-actions">
          {activeTab === 1 && isLoggedIn && (
            <Button
              variant="contained"
              size="large"
              className="export-button"
              startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={exportToCSV}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export to CSV'}
            </Button>
          )}
        </div>

        {/* Main Content */}
        <div className="content-area">
          {sessionLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              <CircularProgress />
            </Box>
          ) : !isLoggedIn ? (
            <LoginDialog open={!isLoggedIn} onLoginSuccess={sessionLogin} />
          ) : (
            <>
              {activeTab === 0 && (
                <Suspense fallback={<div className="loading-fallback">Loading timesheet...</div>}>
                  <TimesheetGrid />
                </Suspense>
              )}

              {activeTab === 1 && (
                <Archive />
              )}

              {activeTab === 2 && (
                <Help />
              )}
            </>
          )}
        </div>

        {/* Update Dialog */}
        <UpdateDialog 
          open={showUpdateDialog}
          version={updateVersion}
          progress={updateProgress}
          status={updateStatus}
        />
        
        {/* About Dialog */}
        <Dialog 
          open={showAboutDialog} 
          onClose={() => setShowAboutDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            About
          </DialogTitle>
          <DialogContent>
            <Box className="about-dialog-content">
              <img 
                src={logoImage} 
                alt="SheetPilot Logo" 
                className="about-dialog-logo"
              />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Version {APP_VERSION}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Created by Andrew Hughes
              </Typography>
              <Typography variant="body2" color="text.secondary" className="about-dialog-description">
                Automate timesheet data entry into web forms
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowAboutDialog(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
};

export default function App() {
  // This should show in console immediately on app load
  console.log('=== APP LOADING ===');
  console.log('Environment:', import.meta.env.DEV ? 'development' : 'production');
  console.log('Window object:', typeof window);
  console.log('Console available:', typeof console.log);
  
  return (
    <SessionProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </SessionProvider>
  );
}
