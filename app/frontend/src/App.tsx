import { useState, useEffect, Suspense, lazy, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  LinearProgress
} from '@mui/material';
const Archive = lazy(() => import('./components/archive/DatabaseViewer'));
const TimesheetGrid = lazy(() => import('./components/timesheet/TimesheetGrid'));
import type { TimesheetGridHandle } from './components/timesheet/TimesheetGrid';
import Navigation from './components/Navigation';
const Settings = lazy(() => import('./components/Settings'));
import TimesheetSkeleton from './components/skeletons/TimesheetSkeleton';
import ArchiveSkeleton from './components/skeletons/ArchiveSkeleton';
import SettingsSkeleton from './components/skeletons/SettingsSkeleton';
import UpdateDialog from './components/UpdateDialog';
import LoginDialog from './components/LoginDialog';
import { DataProvider, useData } from './contexts/DataContext';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { initializeTheme } from './utils/theme-manager';
import logoImage from './assets/images/logo.svg';
import { APP_VERSION } from '../../shared/constants';
import './styles/App.css';
import './styles/transitions.css';

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
  const [status, setStatus] = useState<'checking' | 'downloading' | 'installing' | 'finalizing' | 'ready'>(() => {
    // Detect finalize state from URL hash on initial render
    const hash = window.location.hash || '';
    return hash.includes('state=finalize') ? 'finalizing' : 'checking';
  });

  useEffect(() => {
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
  const { isLoggedIn, isLoading: sessionLoading, login: sessionLogin } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [displayedTab, setDisplayedTab] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasRequestedInitialTimesheetRef = useRef(false);
  const hasRefreshedEmptyOnceRef = useRef(false);
  const timesheetGridRef = useRef<TimesheetGridHandle>(null);
  
  // Update dialog state
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<'downloading' | 'installing'>('downloading');
  
  // Use data context
  const { refreshTimesheetDraft, refreshArchiveData, isTimesheetDraftLoading, timesheetDraftData } = useData();

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

  // Fix accessibility warning: blur background focus when dialogs set aria-hidden on root
  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (!rootElement) return;

    const handleAriaHiddenChange = () => {
      const isHidden = rootElement.getAttribute('aria-hidden') === 'true';
      if (isHidden) {
        // Use setTimeout to ensure this runs after MUI's focus management
        setTimeout(() => {
          const activeElement = document.activeElement;
          // Only blur if the focused element is a descendant of root (background content)
          // Dialog content is rendered in a portal outside root, so it won't be affected
          if (activeElement && rootElement.contains(activeElement) && activeElement !== document.body) {
            (activeElement as HTMLElement).blur();
          }
        }, 0);
      }
    };

    const observer = new MutationObserver(handleAriaHiddenChange);

    observer.observe(rootElement, {
      attributes: true,
      attributeFilter: ['aria-hidden']
    });

    // Also check immediately in case aria-hidden is already set
    handleAriaHiddenChange();

    return () => {
      observer.disconnect();
    };
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






  return (
    <div className="app-container">
      {/* Navigation */}
      <Navigation 
        activeTab={activeTab}
        onTabChange={async (newTab) => {
          if (isTransitioning || newTab === activeTab) return;
          
          window.logger?.userAction('tab-change', { from: activeTab, to: newTab });
          
          // Start transition
          setIsTransitioning(true);
          
          // Note: No batch save needed - rows are saved in real-time as user edits
          
          // Wait for exit animation
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Update both activeTab (for navigation) and displayedTab (for content)
          setActiveTab(newTab);
          setDisplayedTab(newTab);
          
          // Wait for enter animation to start
          await new Promise(resolve => setTimeout(resolve, 100));
          setIsTransitioning(false);
        }}
      />
      
      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Main Content */}
        <div className="content-area">
          {sessionLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              <CircularProgress />
            </Box>
          ) : !isLoggedIn ? (
            <LoginDialog open={!isLoggedIn} onLoginSuccess={sessionLogin} />
          ) : (
            <div className={`page-transition-container ${isTransitioning ? 'page-exit-active' : 'page-enter-active'}`}>
              {displayedTab === 0 && (
                <Suspense fallback={<TimesheetSkeleton />}>
                  <TimesheetGrid ref={timesheetGridRef} />
                </Suspense>
              )}

              {displayedTab === 1 && (
                <Suspense fallback={<ArchiveSkeleton />}>
                  <Archive />
                </Suspense>
              )}

              {displayedTab === 2 && (
                <Suspense fallback={<SettingsSkeleton />}>
                  <Settings />
                </Suspense>
              )}
            </div>
          )}
        </div>

        {/* Update Dialog */}
        <UpdateDialog 
          open={showUpdateDialog}
          version={updateVersion}
          progress={updateProgress}
          status={updateStatus}
        />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <SessionProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </SessionProvider>
  );
}
