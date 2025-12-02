import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import UserManual from './UserManual';
import { useSession } from '../contexts/SessionContext';
import { APP_VERSION } from '../../../shared/constants';
import logoImage from '../assets/images/logo.svg';
import './Settings.css';
import { autoCompleteEmailDomain } from '../utils/emailAutoComplete';

function Settings() {
  const { token, isAdmin, logout: sessionLogout } = useSession();
  const [logPath, setLogPath] = useState<string>('');
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Dialog state for each feature card
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [showUserGuideDialog, setShowUserGuideDialog] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  
  // Credentials management state
  const [storedCredentials, setStoredCredentials] = useState<Array<{
    id: number; service: string; email: string; created_at: string; updated_at: string;
  }>>([]);
  const [showUpdateCredentialsDialog, setShowUpdateCredentialsDialog] = useState(false);
  const [updateEmail, setUpdateEmail] = useState('');
  const [updatePassword, setUpdatePassword] = useState('');
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);
  
  // Admin state
  const [showClearCredentialsDialog, setShowClearCredentialsDialog] = useState(false);
  const [showRebuildDatabaseDialog, setShowRebuildDatabaseDialog] = useState(false);
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);
  
  // Settings state
  const [headlessMode, setHeadlessMode] = useState<boolean>(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const loadStoredCredentials = async () => {
    try {
      if (window.credentials?.list) {
        const response = await window.credentials.list();
        if (response?.success) {
          setStoredCredentials(response.credentials || []);
        }
      }
    } catch (err) {
      window.logger?.error('Could not load credentials', { 
        error: err instanceof Error ? err.message : String(err) 
      });
      // Don't set error state here as it's not critical
    }
  };

  const loadLogFiles = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await window.logs?.getLogPath?.();
      if (!response) {
        window.logger?.warn('Logs API not available');
      } else if (response.success) {
        setLogPath(response.logPath || '');
        setLogFiles(response.logFiles || []);
      } else {
        window.logger?.error('Failed to load log files', { error: response.error });
      }
    } catch (err) {
      window.logger?.error('Error loading log files', { 
        error: err instanceof Error ? err.message : String(err) 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      if (window.settings?.get) {
        const response = await window.settings.get('browserHeadless');
        if (response?.success && response.value !== undefined) {
          setHeadlessMode(Boolean(response.value));
        }
      }
    } catch (err) {
      window.logger?.error('Could not load settings', { 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  };

  const handleHeadlessModeToggle = async (checked: boolean) => {
    setIsLoadingSettings(true);
    try {
      if (window.settings?.set) {
        const response = await window.settings.set('browserHeadless', checked);
        if (response?.success) {
          setHeadlessMode(checked);
          window.logger?.info('Headless mode setting updated', { headlessMode: checked });
        } else {
          setError('Could not save headless mode setting');
          window.logger?.error('Could not save headless mode setting', { error: response.error });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      window.logger?.error('Headless mode toggle error', { error: err });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Load log files, credentials, and settings on component mount
  useEffect(() => {
    loadLogFiles();
    loadStoredCredentials();
    loadSettings();
   
  }, []);

  const handleUpdateCredentials = async () => {
    if (!updateEmail || !updatePassword) {
      setError('Please enter both email and password');
      return;
    }

    if (!window.credentials?.store || !token) {
      setError('Credentials API not available');
      return;
    }

    setIsUpdatingCredentials(true);
    setError('');

    try {
      window.logger?.userAction('update-credentials', { email: updateEmail });
      const result = await window.credentials.store('smartsheet', updateEmail, updatePassword);
      
      if (result.success) {
        window.logger?.info('Credentials updated successfully', { email: updateEmail });
        setShowUpdateCredentialsDialog(false);
        setUpdateEmail('');
        setUpdatePassword('');
        await loadStoredCredentials();
      } else {
        setError(result.message || 'Failed to update credentials');
        window.logger?.error('Could not update credentials', { error: result.message });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      window.logger?.error('Update credentials error', { error: errorMsg });
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  const handleLogout = async () => {
    try {
      await sessionLogout();
      window.logger?.info('User logged out from Settings page');
    } catch (err) {
      window.logger?.error('Could not logout', { error: err });
      setError('Could not logout');
    }
  };

  const handleAdminClearCredentials = async () => {
    if (!token || !window.admin?.clearCredentials) {
      setError('Admin API not available');
      return;
    }

    setIsAdminActionLoading(true);
    setError('');

    try {
      window.logger?.info('Admin clearing all credentials');
      const result = await window.admin.clearCredentials(token);
      
      if (result.success) {
        window.logger?.info('All credentials cleared by admin');
        setShowClearCredentialsDialog(false);
        await loadStoredCredentials();
      } else {
        setError(result.error || 'Failed to clear credentials');
        window.logger?.error('Could not clear credentials', { error: result.error });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      window.logger?.error('Clear credentials error', { error: errorMsg });
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleAdminRebuildDatabase = async () => {
    if (!token || !window.admin?.rebuildDatabase) {
      setError('Admin API not available');
      return;
    }

    setIsAdminActionLoading(true);
    setError('');

    try {
      window.logger?.warn('Admin rebuilding database');
      const result = await window.admin.rebuildDatabase(token);
      
      if (result.success) {
        window.logger?.info('Database rebuilt by admin');
        setShowRebuildDatabaseDialog(false);
        await loadStoredCredentials();
      } else {
        setError(result.error || 'Failed to rebuild database');
        window.logger?.error('Could not rebuild database', { error: result.error });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      window.logger?.error('Rebuild database error', { error: errorMsg });
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const exportLogs = async () => {
    // Use the latest log file if available
    if (!logFiles || logFiles.length === 0) {
      const errorMsg = 'No log files available';
      setError(errorMsg);
      window.logger?.warn('Export logs attempted with no log files available');
      return;
    }
    
    if (!logPath) {
      const errorMsg = 'Log path not available';
      setError(errorMsg);
      window.logger?.warn('Export logs attempted with no log path');
      return;
    }
    
    const latestLogFile = logFiles[logFiles.length - 1];
    if (!latestLogFile) {
      const errorMsg = 'Could not determine latest log file';
      setError(errorMsg);
      window.logger?.warn('Export logs attempted but latest log file could not be determined');
      return;
    }
    
    setIsExporting(true);
    setError('');
    
    let downloadUrl: string | null = null;
    
    try {
      const fullLogPath = logPath.endsWith('\\') ? (logPath + latestLogFile) : (logPath + '\\' + latestLogFile);
      
      if (!window.logs?.exportLogs) {
        const errorMsg = 'Logs API not available';
        setError(errorMsg);
        window.logger?.error('Export logs failed - API not available');
        return;
      }
      
      const response = await window.logs.exportLogs(fullLogPath, 'txt');
      
      if (!response) {
        const errorMsg = 'Logs API returned no response';
        setError(errorMsg);
        window.logger?.error('Export logs failed - no response from API');
        return;
      }
      
      if (!response.success) {
        const errorMsg = response.error || 'Failed to export logs';
        setError(errorMsg);
        window.logger?.error('Export logs failed', { error: errorMsg });
        return;
      }
      
      if (!response.content) {
        const errorMsg = 'Log file content is empty';
        setError(errorMsg);
        window.logger?.error('Export logs failed - empty content');
        return;
      }
      
      if (!response.filename) {
        const errorMsg = 'Log filename not provided';
        setError(errorMsg);
        window.logger?.error('Export logs failed - no filename');
        return;
      }
      
      // Create and download file
      try {
        const blob = new Blob([response.content], { type: response.mimeType || 'text/plain' });
        downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        window.logger?.info('Logs exported successfully', { filename: response.filename });
      } catch (blobError) {
        const errorMsg = `Failed to create download: ${blobError instanceof Error ? blobError.message : String(blobError)}`;
        setError(errorMsg);
        window.logger?.error('Export logs failed - blob creation error', { 
          error: blobError instanceof Error ? blobError.message : String(blobError) 
        });
        return;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      window.logger?.error('Export logs error', { 
        error: errorMsg,
        stack: err instanceof Error ? err.stack : undefined
      });
    } finally {
      // Clean up blob URL if it was created
      if (downloadUrl) {
        try {
          URL.revokeObjectURL(downloadUrl);
        } catch (revokeError) {
          window.logger?.warn('Could not revoke blob URL', { 
            error: revokeError instanceof Error ? revokeError.message : String(revokeError) 
          });
        }
      }
      setIsExporting(false);
    }
  };

  return (
    <div className="settings-container">
      {/* Main Container Card */}
      <Card className="settings-main-card">
        <CardContent className="settings-main-card-content">
          {/* Header Section */}
          <Box className="settings-section-header">
            <Box className="settings-section-icon">
              <SettingsIcon sx={{ fontSize: 48 }} />
            </Box>
            <Typography variant="h4" component="h1" className="settings-section-title">
              Settings
            </Typography>
            <Typography variant="body1" className="settings-section-subtitle">
              Configure application settings, manage credentials, and access support tools. SheetPilot ensures accurate logging of every minute, designed specifically for SkyWater Technology&apos;s manufacturing excellence standards.
            </Typography>
          </Box>

          {/* Feature Cards Grid */}
          <Box className="settings-cards-grid">
            {/* Export Logs Card */}
            <Box 
              className="settings-feature-card"
              onClick={() => setShowLogsDialog(true)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && setShowLogsDialog(true)}
            >
              <Typography variant="h6" component="h2" className="settings-feature-card-title">
                Export Logs
              </Typography>
            </Box>

            {/* Update Credentials Card */}
            <Box 
              className="settings-feature-card"
              onClick={() => {
                const existingCred = storedCredentials.find(c => c.service === 'smartsheet');
                if (existingCred) {
                  setUpdateEmail(existingCred.email);
                }
                setShowUpdateCredentialsDialog(true);
              }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const existingCred = storedCredentials.find(c => c.service === 'smartsheet');
                  if (existingCred) {
                    setUpdateEmail(existingCred.email);
                  }
                  setShowUpdateCredentialsDialog(true);
                }
              }}
            >
              <Typography variant="h6" component="h2" className="settings-feature-card-title">
                Update Credentials
              </Typography>
            </Box>

            {/* User Guide Card */}
            <Box 
              className="settings-feature-card"
              onClick={() => setShowUserGuideDialog(true)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && setShowUserGuideDialog(true)}
            >
              <Typography variant="h6" component="h2" className="settings-feature-card-title">
                User Guide
              </Typography>
            </Box>

            {/* Settings Card */}
            <Box 
              className="settings-feature-card"
              onClick={() => setShowSettingsDialog(true)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && setShowSettingsDialog(true)}
            >
              <Typography variant="h6" component="h2" className="settings-feature-card-title">
                Application Settings
              </Typography>
            </Box>

            {/* About SheetPilot Card */}
            <Box 
              className="settings-feature-card"
              onClick={() => {
                window.logger?.userAction('about-dialog-opened');
                setShowAboutDialog(true);
              }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  window.logger?.userAction('about-dialog-opened');
                  setShowAboutDialog(true);
                }
              }}
            >
              <Typography variant="h6" component="h2" className="settings-feature-card-title">
                About SheetPilot
              </Typography>
            </Box>

            {/* Logout Card */}
            <Box 
              className="settings-feature-card settings-feature-card-warning"
              onClick={handleLogout}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && handleLogout()}
            >
              <Typography variant="h6" component="h2" className="settings-feature-card-title">
                Logout
              </Typography>
            </Box>

            {/* Admin Tools Card - only show for admins */}
            {isAdmin && (
              <Box 
                className="settings-feature-card settings-feature-card-admin"
                onClick={() => setShowAdminDialog(true)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && setShowAdminDialog(true)}
              >
                <Typography variant="h6" component="h2" className="settings-feature-card-title">
                  Admin Tools
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Export Logs Dialog */}
      <Dialog
        open={showLogsDialog}
        onClose={() => {
          setShowLogsDialog(false);
          setError('');
        }}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>Export Application Logs</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 2 }}>
            Export application logs for troubleshooting and support purposes.
          </Typography>
          {logFiles && logFiles.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Latest log: {logFiles[logFiles.length - 1]}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowLogsDialog(false);
            setError('');
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
            onClick={exportLogs}
            disabled={isExporting || isLoading || !logFiles || logFiles.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export Logs'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Guide Dialog */}
      <Dialog
        open={showUserGuideDialog}
        onClose={() => setShowUserGuideDialog(false)}
        maxWidth="md"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>User Guide</DialogTitle>
        <DialogContent>
          <UserManual />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUserGuideDialog(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Tools Dialog */}
      {isAdmin && (
        <Dialog
          open={showAdminDialog}
          onClose={() => {
            setShowAdminDialog(false);
            setError('');
          }}
          maxWidth="sm"
          fullWidth
          disableRestoreFocus
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <SecurityIcon color="error" />
              <Typography variant="h6" component="span" color="error">
                Admin Tools
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Admin users cannot submit timesheet entries to SmartSheet.
              </Typography>
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              These tools perform destructive operations. Use with caution.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ flexDirection: 'column', gap: 1, alignItems: 'stretch', p: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                setShowAdminDialog(false);
                setShowClearCredentialsDialog(true);
              }}
              disabled={isAdminActionLoading}
              fullWidth
            >
              Clear All Credentials
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                setShowAdminDialog(false);
                setShowRebuildDatabaseDialog(true);
              }}
              disabled={isAdminActionLoading}
              fullWidth
            >
              Rebuild Database
            </Button>
            <Button
              onClick={() => {
                setShowAdminDialog(false);
                setError('');
              }}
              fullWidth
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Update Credentials Dialog */}
      <Dialog
        open={showUpdateCredentialsDialog}
        onClose={() => {
          setShowUpdateCredentialsDialog(false);
          setUpdateEmail('');
          setUpdatePassword('');
          setError('');
        }}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>
          {storedCredentials.length > 0 ? 'Update SmartSheet Credentials' : 'Add SmartSheet Credentials'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={updateEmail}
              onChange={(e) => {
                const value = e.target.value;
                const completedValue = autoCompleteEmailDomain(value);
                setUpdateEmail(completedValue);
              }}
              placeholder="your.email@skywatertechnology.com"
              margin="normal"
              variant="outlined"
              autoFocus
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={updatePassword}
              onChange={(e) => setUpdatePassword(e.target.value)}
              placeholder="Your password"
              margin="normal"
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowUpdateCredentialsDialog(false);
              setUpdateEmail('');
              setUpdatePassword('');
              setError('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateCredentials}
            variant="contained"
            disabled={!updateEmail || !updatePassword || isUpdatingCredentials}
            startIcon={isUpdatingCredentials ? <CircularProgress size={20} /> : null}
          >
            {isUpdatingCredentials ? 'Updating...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Clear Credentials Confirmation Dialog */}
      <Dialog
        open={showClearCredentialsDialog}
        onClose={() => setShowClearCredentialsDialog(false)}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>Clear All Credentials</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            <Typography variant="body2">
              This will permanently delete all stored credentials. Users will need to log in again.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearCredentialsDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdminClearCredentials}
            variant="contained"
            color="error"
            disabled={isAdminActionLoading}
            startIcon={isAdminActionLoading ? <CircularProgress size={20} /> : null}
          >
            {isAdminActionLoading ? 'Clearing...' : 'Clear All Credentials'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Rebuild Database Confirmation Dialog */}
      <Dialog
        open={showRebuildDatabaseDialog}
        onClose={() => setShowRebuildDatabaseDialog(false)}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>Rebuild Database</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              WARNING: This will permanently delete all timesheet entries and credentials!
            </Typography>
            <Typography variant="body2">
              This action cannot be undone. All data will be lost and the database will be reset to a clean state.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRebuildDatabaseDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdminRebuildDatabase}
            variant="contained"
            color="error"
            disabled={isAdminActionLoading}
            startIcon={isAdminActionLoading ? <CircularProgress size={20} /> : null}
          >
            {isAdminActionLoading ? 'Rebuilding...' : 'Rebuild Database'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Application Settings Dialog */}
      <Dialog
        open={showSettingsDialog}
        onClose={() => {
          setShowSettingsDialog(false);
          setError('');
        }}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>Application Settings</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Browser Settings
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={headlessMode}
                  onChange={(e) => handleHeadlessModeToggle(e.target.checked)}
                  disabled={isLoadingSettings}
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Headless Mode</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Run browser automation without visible windows. Changes take effect on next submission.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowSettingsDialog(false);
              setError('');
            }}
            variant="contained"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* About SheetPilot Dialog */}
      <Dialog 
        open={showAboutDialog} 
        onClose={() => setShowAboutDialog(false)}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
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
  );
};

export default Settings;
