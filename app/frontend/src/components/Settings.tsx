/**
 * @fileoverview Settings Component
 * 
 * Comprehensive settings page providing access to application configuration,
 * user account management, system tools, and administrative functions.
 * 
 * Features:
 * - Credential management (update SmartSheet login)
 * - Log file export for troubleshooting
 * - User guide access
 * - Application settings (headless mode, etc.)
 * - Admin tools (database maintenance, credential clearing)
 * - About dialog with version information
 * 
 * Access control:
 * - Admin-specific tools only visible to admin users
 * - Token-based authentication for sensitive operations
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import UserManual from './UserManual';
import { useSession } from '@/contexts/SessionContext';
import { APP_VERSION } from '@sheetpilot/shared';
import logoImage from '@/assets/images/logo.svg';
import './Settings.css';
import { autoCompleteEmailDomain } from '@/utils/emailAutoComplete';
import { clearCredentials as clearCredentialsIpc, rebuildDatabase as rebuildDatabaseIpc } from '@/services/ipc/admin';
import { listCredentials as listCredentialsIpc, storeCredentials as storeCredentialsIpc } from '@/services/ipc/credentials';
import { getLogPath as getLogPathIpc, exportLogs as exportLogsIpc } from '@/services/ipc/logs';
import { getSetting, setSetting } from '@/services/ipc/settings';
import { logError, logInfo, logUserAction, logWarn } from '@/services/ipc/logger';

/**
 * Settings page component
 * 
 * Comprehensive settings interface organized as feature cards providing:
 * - Log file export for troubleshooting
 * - Credential management (update SmartSheet login)
 * - User guide access
 * - Application settings (browser headless mode, etc.)
 * - About dialog with version info
 * - Logout functionality
 * - Admin tools (visible only to admin users)
 * 
 * Admin features:
 * - Clear all credentials (destructive)
 * - Rebuild database (destructive)
 * - Restricted by admin flag from session context
 * 
 * @returns Settings page with feature cards and dialogs
 */
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
      const response = await listCredentialsIpc();
      if (response?.success) {
        setStoredCredentials(response.credentials || []);
      }
    } catch (err) {
      logError('Could not load credentials', { error: err instanceof Error ? err.message : String(err) });
      // Don't set error state here as it's not critical
    }
  };

  const loadLogFiles = useCallback(async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = token ? await getLogPathIpc(token) : null;
      if (!response) {
        logWarn('Logs API not available');
      } else if (response.success) {
        setLogPath(response.logPath || '');
        setLogFiles(response.logFiles || []);
      } else {
        logError('Could not load log files', { error: response.error });
      }
    } catch (err) {
      logError('Error loading log files', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const loadSettings = async () => {
    try {
      const response = await getSetting('browserHeadless');
      if (response?.success && response.value !== undefined) {
        setHeadlessMode(Boolean(response.value));
      }
    } catch (err) {
      logError('Could not load settings', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleHeadlessModeToggle = async (checked: boolean) => {
    setIsLoadingSettings(true);
    try {
      const response = await setSetting('browserHeadless', checked);
      if (response?.success) {
        setHeadlessMode(checked);
        logInfo('Headless mode setting updated', { headlessMode: checked });
      } else {
        setError('Could not save headless mode setting');
        logError('Could not save headless mode setting', { error: response?.error });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      logError('Headless mode toggle error', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Load log files, credentials, and settings on component mount
  useEffect(() => {
    void loadLogFiles();
    void loadStoredCredentials();
    void loadSettings();
   
  }, [loadLogFiles]);

  const handleUpdateCredentials = async () => {
    if (!updateEmail || !updatePassword) {
      setError('Please enter both email and password');
      return;
    }

    if (!token) {
      setError('Credentials API not available');
      return;
    }

    setIsUpdatingCredentials(true);
    setError('');

    try {
      logUserAction('update-credentials', { email: updateEmail });
      const result = await storeCredentialsIpc('smartsheet', updateEmail, updatePassword);
      
      if (result.success) {
        logInfo('Credentials updated successfully', { email: updateEmail });
        setShowUpdateCredentialsDialog(false);
        setUpdateEmail('');
        setUpdatePassword('');
        await loadStoredCredentials();
      } else {
        setError(result.message || 'Failed to update credentials');
        logError('Could not update credentials', { error: result.message });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      logError('Update credentials error', { error: errorMsg });
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  const handleLogout = async () => {
    try {
      await sessionLogout();
      logInfo('User logged out from Settings page');
    } catch (err) {
      logError('Could not logout', { error: err instanceof Error ? err.message : String(err) });
      setError('Could not logout');
    }
  };

  const handleAdminClearCredentials = async () => {
    if (!token) {
      setError('Admin API not available');
      return;
    }

    setIsAdminActionLoading(true);
    setError('');

    try {
      logInfo('Admin clearing all credentials');
      const result = await clearCredentialsIpc(token);
      
      if (result.success) {
        logInfo('All credentials cleared by admin');
        setShowClearCredentialsDialog(false);
        await loadStoredCredentials();
      } else {
        setError(result.error || 'Failed to clear credentials');
        logError('Could not clear credentials', { error: result.error });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      logError('Clear credentials error', { error: errorMsg });
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const handleAdminRebuildDatabase = async () => {
    if (!token) {
      setError('Admin API not available');
      return;
    }

    setIsAdminActionLoading(true);
    setError('');

    try {
      logWarn('Admin rebuilding database');
      const result = await rebuildDatabaseIpc(token);
      
      if (result.success) {
        logInfo('Database rebuilt by admin');
        setShowRebuildDatabaseDialog(false);
        await loadStoredCredentials();
      } else {
        setError(result.error || 'Failed to rebuild database');
        logError('Could not rebuild database', { error: result.error });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      logError('Rebuild database error', { error: errorMsg });
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  const exportLogs = async () => {
    if (!token) {
      const errorMsg = 'Session token not available';
      setError(errorMsg);
      logWarn('Export logs attempted without session token');
      return;
    }

    // Use the latest log file if available
    if (!logFiles || logFiles.length === 0) {
      const errorMsg = 'No log files available';
      setError(errorMsg);
      logWarn('Export logs attempted with no log files available');
      return;
    }
    
    if (!logPath) {
      const errorMsg = 'Log path not available';
      setError(errorMsg);
      logWarn('Export logs attempted with no log path');
      return;
    }
    
    setIsExporting(true);
    setError('');
    
    let downloadUrl: string | null = null;
    
    try {
      // logPath is already the full path to the latest log file from the backend
      
      const response = await exportLogsIpc(token, logPath, 'txt');
      
      if (!response) {
        const errorMsg = 'Logs API returned no response';
        setError(errorMsg);
        logError('Export logs returned no response', { logPath });
        return;
      }
      
      if (!response.success) {
        const errorMsg = response.error || 'Failed to export logs';
        setError(errorMsg);
        logError('Could not export logs', { error: errorMsg });
        return;
      }
      
      if (!response.content) {
        const errorMsg = 'Log file content is empty';
        setError(errorMsg);
        logError('Export logs returned empty content');
        return;
      }
      
      if (!response.filename) {
        const errorMsg = 'Log filename not provided';
        setError(errorMsg);
        logError('Export logs missing filename');
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
        
        logInfo('Logs exported successfully', { filename: response.filename });
      } catch (blobError) {
        const errorMsg = `Failed to create download: ${blobError instanceof Error ? blobError.message : String(blobError)}`;
        setError(errorMsg);
        logError('Export logs failed - blob creation error', { error: blobError instanceof Error ? blobError.message : String(blobError) });
        return;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      logError('Export logs error', { error: errorMsg, stack: err instanceof Error ? err.stack : undefined });
    } finally {
      // Clean up blob URL if it was created
      if (downloadUrl) {
        try {
          URL.revokeObjectURL(downloadUrl);
        } catch (revokeError) {
          logWarn('Could not revoke blob URL', { error: revokeError instanceof Error ? revokeError.message : String(revokeError) });
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
                logUserAction('about-dialog-opened');
                setShowAboutDialog(true);
              }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  logUserAction('about-dialog-opened');
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
