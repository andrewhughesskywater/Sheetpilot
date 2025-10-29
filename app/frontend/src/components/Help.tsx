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
  Chip
} from '@mui/material';
import {
  Download as DownloadIcon,
  VpnKey as VpnKeyIcon,
  Logout as LogoutIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import UserManual from './UserManual';
import { useSession } from '../contexts/SessionContext';
import './Help.css';

function Help() {
  const { token, isAdmin, logout: sessionLogout } = useSession();
  const [logPath, setLogPath] = useState<string>('');
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  
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

  // Load log files and credentials on component mount
  useEffect(() => {
    loadLogFiles();
    loadStoredCredentials();
  }, []);

  const loadStoredCredentials = async () => {
    try {
      if (window.credentials?.list) {
        const response = await window.credentials.list();
        if (response?.success) {
          setStoredCredentials(response.credentials || []);
        }
      }
    } catch (err) {
      window.logger?.error('Could not load credentials', { error: err });
    }
  };

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
      window.logger?.info('User logged out from Help page');
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

  const loadLogFiles = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await window.logs.getLogPath();
      if (response.success) {
        setLogPath(response.logPath || '');
        setLogFiles(response.logFiles || []);
      } else {
        setError(response.error || 'Failed to load log files');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = async () => {
    // Use the latest log file if available
    if (!logFiles || logFiles.length === 0) {
      setError('No log files available');
      return;
    }
    
    const latestLogFile = logFiles[logFiles.length - 1];
    setIsExporting(true);
    setError('');
    
    try {
      const fullLogPath = logPath.replace(/[^\\]*$/, latestLogFile);
      const response = await window.logs.exportLogs(fullLogPath, 'txt');
      
      if (response.success && response.content && response.filename) {
        // Create and download file
        const blob = new Blob([response.content], { type: response.mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(response.error || 'Failed to export logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="help-container">
      <Box className="help-header">
        <Typography variant="h4" component="h1" className="help-title">
          Help & Support
        </Typography>
        <Typography variant="body1" color="text.secondary" className="help-subtitle">
          Export application logs and access user documentation
        </Typography>
      </Box>

      {/* Log Export Section */}
      <Card className="log-management-card">
        <CardContent>
          <Box className="log-management-header">
            <Typography variant="h6" component="h2">
              Application Logs
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={exportLogs}
              disabled={isExporting || isLoading || !logFiles || logFiles.length === 0}
              fullWidth
            >
              {isExporting ? 'Exporting...' : 'Export Logs'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Credentials Management Section */}
      <Card className="credentials-management-card" sx={{ mt: 3 }}>
        <CardContent>
          <Box className="credentials-management-header">
            <Typography variant="h6" component="h2">
              Credentials Management
            </Typography>
          </Box>

          {storedCredentials.length > 0 ? (
            <Box sx={{ mt: 2, mb: 2 }}>
              {storedCredentials.map((cred) => (
                <Box key={cred.id} sx={{ mb: 2, p: 2, backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-medium)' }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Chip label={cred.service} color="primary" size="small" />
                    <Typography variant="body1" fontWeight="medium">
                      {cred.email}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Updated: {new Date(cred.updated_at).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 2 }}>
              No credentials stored
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<VpnKeyIcon />}
              onClick={() => {
                const existingCred = storedCredentials.find(c => c.service === 'smartsheet');
                if (existingCred) {
                  setUpdateEmail(existingCred.email);
                }
                setShowUpdateCredentialsDialog(true);
              }}
              fullWidth
            >
              {storedCredentials.length > 0 ? 'Update Credentials' : 'Add Credentials'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              fullWidth
            >
              Logout
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Admin Section */}
      {isAdmin && (
        <Card className="admin-section-card" sx={{ mt: 3, border: '2px solid var(--md-sys-color-error)' }}>
          <CardContent>
            <Box className="admin-section-header" display="flex" alignItems="center" gap={1} mb={2}>
              <SecurityIcon color="error" />
              <Typography variant="h6" component="h2" color="error">
                Admin Tools
              </Typography>
            </Box>

            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Admin users cannot submit timesheet entries to SmartSheet.
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setShowClearCredentialsDialog(true)}
                disabled={isAdminActionLoading}
                fullWidth
              >
                Clear All Credentials
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setShowRebuildDatabaseDialog(true)}
                disabled={isAdminActionLoading}
                fullWidth
              >
                Rebuild Database
              </Button>
            </Box>
          </CardContent>
        </Card>
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
                setUpdateEmail(value);
                
                // Auto-complete domain
                if (value.includes('@') && !value.includes('@skywatertechnology.com')) {
                  const atIndex = value.lastIndexOf('@');
                  const domainPart = value.substring(atIndex + 1);
                  if (domainPart === '' || domainPart === 'skywatertechnology.com'.substring(0, domainPart.length)) {
                    setUpdateEmail(value.substring(0, atIndex + 1) + 'skywatertechnology.com');
                  }
                }
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

      {/* User Manual Section */}
      <Box sx={{ mt: 4 }}>
        <UserManual />
      </Box>
    </div>
  );
};

export default Help;
