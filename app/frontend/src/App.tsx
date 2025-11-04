import { useState, useEffect, Suspense, lazy, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  Download as DownloadIcon
} from '@mui/icons-material';
const Archive = lazy(() => import('./components/archive/DatabaseViewer'));
const TimesheetGrid = lazy(() => import('./components/timesheet/TimesheetGrid'));
import type { TimesheetGridHandle } from './components/timesheet/TimesheetGrid';
import ModernSegmentedNavigation from './components/ModernSegmentedNavigation';
const Help = lazy(() => import('./components/Help'));
import UpdateDialog from './components/UpdateDialog';
import LoginDialog from './components/LoginDialog';
import { DataProvider, useData } from './contexts/DataContext';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { initializeTheme } from './utils/theme-manager';
import logoImage from './assets/images/transparent-logo.svg';
import { APP_VERSION } from '../../shared/constants';
import './styles/App.css';

export function AboutBody() {
  return (
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
  );
}

export function Splash() {
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<'checking' | 'downloading' | 'installing' | 'finalizing' | 'ready'>('checking');

  useEffect(() => {
    // Detect finalize state from URL hash
    const hash = window.location.hash || '';
    if (hash.includes('state=finalize')) {
      setStatus('finalizing');
    }

    if (!window.updates) return;

    window.updates.onUpdateAvailable((_version) => {
      setStatus('downloading');
    });
    window.updates.onDownloadProgress((p) => {
      setStatus('downloading');
      setProgress(p.percent);
    });
    window.updates.onUpdateDownloaded((_version) => {
      setStatus('installing');
    });

    return () => {
      window.updates?.removeAllListeners();
    };
  }, []);

  const renderStatus = () => {
    switch (status) {
      case 'checking':
        return 'Checking for updates…';
      case 'downloading':
        return progress != null ? `Downloading update… ${progress.toFixed(0)}%` : 'Downloading update…';
      case 'installing':
        return 'Installing update…';
      case 'finalizing':
        return 'Finalizing update…';
      case 'ready':
        return 'Starting…';
      default:
        return '';
    }
  };

  return (
    <Box className="splash-container" sx={{ gap: 'var(--sp-space-4)' }}>
      <AboutBody />
      <Box sx={{ width: '60%', minWidth: 260, maxWidth: 400 }}>
        <LinearProgress
          variant={progress != null ? 'determinate' : 'indeterminate'}
          {...(progress != null ? { value: progress } : {})}
          sx={{
            height: 8,
            borderRadius: 'var(--sp-radius-sm)',
            backgroundColor: 'var(--md-sys-color-surface-variant)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'var(--md-sys-color-primary)'
            }
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
          {renderStatus()}
        </Typography>
      </Box>
    </Box>
  );
}

function AppContent() {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[AppContent] render ts:${performance.now().toFixed(2)}ms`);
  }
  const { isLoggedIn, isLoading: sessionLoading, login: sessionLogin } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const hasRequestedInitialTimesheetRef = useRef(false);
  const hasRefreshedEmptyOnceRef = useRef(false);
  const timesheetGridRef = useRef<TimesheetGridHandle>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  
  // Update dialog state
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<'downloading' | 'installing'>('downloading');
  
  // Use data context
  const { refreshTimesheetDraft, refreshArchiveData, isTimesheetDraftLoading, timesheetDraftData } = useData() as unknown as {
    refreshTimesheetDraft: () => Promise<void>;
    refreshArchiveData: () => Promise<void>;
    isTimesheetDraftLoading: boolean;
    timesheetDraftData: unknown[];
  };

  // Load data when user navigates to tabs (on-demand loading)
  useEffect(() => {
    if (!isLoggedIn) return;

    if (activeTab === 0) {
      // Prevent duplicate initial loads (StrictMode/effect re-runs)
      if (!hasRequestedInitialTimesheetRef.current) {
        window.logger?.debug('[App] Refreshing timesheet draft on initial tab activate');
        hasRequestedInitialTimesheetRef.current = true;
        refreshTimesheetDraft();
        return;
      }
      // If data appears effectively empty and not loading, refresh once more
      const hasRealRows = Array.isArray(timesheetDraftData) && timesheetDraftData.some((r) => {
        const row = r as Record<string, unknown>;
        return !!(row?.date || row?.timeIn || row?.timeOut || row?.project || row?.taskDescription);
      });
      if (!isTimesheetDraftLoading && !hasRealRows && !hasRefreshedEmptyOnceRef.current) {
        window.logger?.debug('[App] Timesheet appears empty post-init; refreshing once');
        hasRefreshedEmptyOnceRef.current = true;
        refreshTimesheetDraft();
      }
    } else if (activeTab === 1) {
      window.logger?.debug('[App] Refreshing archive data on tab activate');
      refreshArchiveData();
    }
  }, [activeTab, isLoggedIn, refreshTimesheetDraft, refreshArchiveData, isTimesheetDraftLoading, timesheetDraftData]);

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
          onTabChange={async (newTab) => {
            window.logger?.userAction('tab-change', { from: activeTab, to: newTab });
            
            // Save to database when leaving Timesheet tab
            if (activeTab === 0 && newTab !== 0) {
              window.logger?.info('[App] Leaving Timesheet tab, triggering batch save');
              await timesheetGridRef.current?.batchSaveToDatabase();
            }
            
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
                  <TimesheetGrid ref={timesheetGridRef} />
                </Suspense>
              )}

              {activeTab === 1 && (
                <Suspense fallback={<div className="loading-fallback">Loading archive...</div>}>
                  <Archive />
                </Suspense>
              )}

              {activeTab === 2 && (
                <Suspense fallback={<div className="loading-fallback">Loading help...</div>}>
                  <Help />
                </Suspense>
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
  // Diagnostic logging (gated by development mode, aware of StrictMode double-render)
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[App] render ts:${performance.now().toFixed(2)}ms env:${import.meta.env.DEV ? 'dev' : 'prod'}`);
  }
  
  return (
    <SessionProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </SessionProvider>
  );
}
