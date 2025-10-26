import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider
} from '@mui/material';
import {
  VpnKey as VpnKeyIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import Archive from './components/DatabaseViewer';
const TimesheetGrid = lazy(() => import('./components/TimesheetGrid'));
import ModernSegmentedNavigation from './components/ModernSegmentedNavigation';
import Help from './components/Help';
import { DataProvider, useData } from './contexts/DataContext';
import { initializeTheme } from './utils/theme-manager';
import logoImage from './assets/images/transparent-logo.svg';
import './App.css';

const AppContent: React.FC = () => {
  console.log('=== APP CONTENT RENDERING ===');
  const [activeTab, setActiveTab] = useState(1);
  console.log('Active tab:', activeTab);
  const [msg, setMsg] = useState('Ready');
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [storedCredentials, setStoredCredentials] = useState<Array<{
    id: number; service: string; email: string; created_at: string; updated_at: string;
  }>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [isEmailFieldDisabled, setIsEmailFieldDisabled] = useState(false);
  
  // Use data context
  const { refreshTimesheetDraft, refreshArchiveData } = useData();

  // Load data when user navigates to tabs (on-demand loading)
  useEffect(() => {
    if (activeTab === 1) {
      // User navigated to timesheet tab - load data now
      refreshTimesheetDraft();
    } else if (activeTab === 2) {
      // User navigated to archive tab - load data now
      refreshArchiveData();
    }
     
  }, [activeTab]);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);




  const loadStoredCredentials = async () => {
    if (!window.credentials?.list) {
      window.logger?.warn('Credentials API not available', {});
      setStoredCredentials([]);
      return;
    }
    try {
      const response = await window.credentials.list();
      if (response?.success) {
        setStoredCredentials(response.credentials || []);
      } else {
        window.logger?.error('Could not load credentials', { error: response?.error || 'Unknown error' });
        setStoredCredentials([]);
      }
    } catch (error) {
      window.logger?.error('Error loading credentials', { error: error instanceof Error ? error.message : 'Unknown error' });
      setStoredCredentials([]);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEmailFieldDisabled) return;
    
    const value = e.target.value;
    setCredentials({...credentials, email: value});
    
    // Check if user typed @ and auto-complete
    if (value.includes('@') && !value.includes('@skywatertechnology.com')) {
      const atIndex = value.lastIndexOf('@');
      const domainPart = value.substring(atIndex + 1);
      
      // Auto-complete if there's no existing domain or it's incomplete
      if (domainPart === '' || domainPart === 'skywatertechnology.com'.substring(0, domainPart.length)) {
        const completedEmail = value.substring(0, atIndex + 1) + 'skywatertechnology.com';
        setCredentials({...credentials, email: completedEmail});
        
        // Disable email field and move focus to password
        setIsEmailFieldDisabled(true);
        
        // Move focus to password field after a brief delay
        setTimeout(() => {
          const passwordField = document.querySelector('input[type="password"]') as HTMLInputElement;
          if (passwordField) {
            passwordField.focus();
          }
        }, 100);
        
        // Re-enable email field after 500ms
        setTimeout(() => {
          setIsEmailFieldDisabled(false);
        }, 500);
      }
    }
  };


  const saveCredentials = async () => {
    if (!credentials.email || !credentials.password) {
      setMsg('❌ Please enter both email and password');
      return;
    }

    if (!window.credentials?.store) {
      window.logger?.warn('Credentials API not available', {});
      setMsg('❌ Credentials API not available');
      return;
    }

    window.logger?.userAction('save-credentials', { service: 'smartsheet', email: credentials.email });
    setMsg('Saving credentials…');
    const result = await window.credentials.store('smartsheet', credentials.email, credentials.password);
    
    if (result.success) {
      window.logger?.info('Credentials saved successfully', { service: 'smartsheet', email: credentials.email });
      setMsg(`✅ ${result.message}`);
      setCredentials({ email: '', password: '' });
      setShowCredentialsDialog(false);
      setIsEmailFieldDisabled(false);
      loadStoredCredentials();
    } else {
      window.logger?.error('Could not save credentials', { error: result.message });
      setMsg(`❌ ${result.message}`);
    }
  };

  const deleteCredential = async (service: string) => {
    if (!window.credentials?.delete) {
      window.logger?.warn('Credentials API not available', {});
      setMsg('❌ Credentials API not available');
      return;
    }

    window.logger?.userAction('delete-credential', { service });
    setMsg('Deleting credentials…');
    const result = await window.credentials.delete(service);
    
    if (result.success) {
      window.logger?.info('Credential deleted successfully', { service });
      setMsg(`✅ ${result.message}`);
      loadStoredCredentials();
    } else {
      window.logger?.error('Could not delete credential', { service, error: result.message });
      setMsg(`❌ ${result.message}`);
    }
  };

  // Load credentials on component mount - aggressively optimized for startup performance
  useEffect(() => {
    // Defer credential loading significantly to prevent blocking startup
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        loadStoredCredentials();
      }, { timeout: 3000 });
    } else {
      setTimeout(() => {
        loadStoredCredentials();
      }, 2000);
    }
  }, []);

  const exportToCSV = async () => {
    // Prevent multiple simultaneous exports
    if (isExporting) return;
    
    window.logger?.userAction('export-to-csv-clicked');
    setIsExporting(true);
    setMsg('Exporting timesheet data to CSV...');
    
    try {
      // CSV export functionality not yet implemented
      window.logger?.info('CSV export requested');
      
      setMsg('CSV export functionality coming soon');
    } catch (error) {
      window.logger?.error('CSV export error', { error: error instanceof Error ? error.message : String(error) });
      setMsg(`❌ Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          {activeTab === 2 && (
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
      {activeTab === 0 && (
        <>
          {/* Credentials Dialog */}
          <Dialog 
            open={showCredentialsDialog} 
            onClose={() => {
              setShowCredentialsDialog(false);
              setIsEmailFieldDisabled(false);
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              Add SmartSheet Credentials
            </DialogTitle>
            <DialogContent>
              <Box style={{ paddingTop: 'var(--sp-space-4)' }}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={credentials.email}
                  onChange={handleEmailChange}
                  placeholder="your.email@company.com"
                  margin="normal"
                  variant="outlined"
                  disabled={isEmailFieldDisabled}
                  className="email-field-disabled-fix"
                />
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  placeholder="Your password"
                  margin="normal"
                  variant="outlined"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setShowCredentialsDialog(false);
                setIsEmailFieldDisabled(false);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={saveCredentials} 
                variant="contained"
                disabled={!credentials.email || !credentials.password}
              >
                Save
              </Button>
            </DialogActions>
          </Dialog>

          {/* Stored Credentials List */}
          {storedCredentials.length > 0 && (
            <Card className="credentials-card" style={{ marginBottom: 'var(--sp-space-6)', width: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Stored Credentials
                </Typography>
                <List>
                  {storedCredentials.map((cred, index) => (
                    <React.Fragment key={cred.id}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box className="credential-item-primary">
                              <Chip label={cred.service} color="primary" size="small" />
                              <Typography variant="body1">{cred.email}</Typography>
                            </Box>
                          }
                          secondary={`Updated: ${new Date(cred.updated_at).toLocaleString()}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => deleteCredential(cred.service)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < storedCredentials.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
          
          {/* Credentials Management */}
          <Card className="credentials-card" style={{ width: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Credentials Management
              </Typography>
              <Typography variant="body2" color="text.secondary" style={{ marginBottom: 'var(--sp-space-6)' }}>
                {storedCredentials.length > 0 
                  ? `${storedCredentials.length} credential${storedCredentials.length > 1 ? 's' : ''} stored`
                  : 'No credentials stored'}
              </Typography>
              <Box className="credentials-actions-box">
                <Button
                  variant="contained"
                  className="add-credentials-button"
                  startIcon={<VpnKeyIcon />}
                  onClick={() => {
                    window.logger?.userAction('add-credentials-dialog-opened');
                    setShowCredentialsDialog(true);
                  }}
                  style={{ flex: 1 }}
                >
                  Add Credentials
                </Button>
                <Button
                  variant="outlined"
                  className="clear-credentials-button"
                  startIcon={<DeleteIcon />}
                  onClick={async () => {
                    if (storedCredentials.length === 0) {
                      setMsg('❌ No credentials to clear');
                      return;
                    }
                    
                    if (!window.credentials?.delete) {
                      window.logger?.warn('Credentials API not available', {});
                      setMsg('❌ Credentials API not available');
                      return;
                    }
                    
                    window.logger?.userAction('clear-all-credentials', { count: storedCredentials.length });
                    setMsg('Clearing all credentials…');
                    let successCount = 0;
                    
                    for (const cred of storedCredentials) {
                      const result = await window.credentials.delete(cred.service);
                      if (result.success) successCount++;
                    }
                    
                    if (successCount === storedCredentials.length) {
                      window.logger?.info('Cleared all credentials successfully', { count: successCount });
                      setMsg(`✅ Cleared ${successCount} credential${successCount > 1 ? 's' : ''}`);
                      loadStoredCredentials();
                    } else {
                      window.logger?.warn('Partially cleared credentials', { successCount, totalCount: storedCredentials.length });
                      setMsg(`⚠️ Cleared ${successCount}/${storedCredentials.length} credentials`);
                      loadStoredCredentials();
                    }
                  }}
                  disabled={storedCredentials.length === 0}
                  color="error"
                  style={{ flex: 1 }}
                >
                  Clear All Credentials
                </Button>
              </Box>
              {storedCredentials.length > 0 ? (
                <Box className="credentials-display-box">
                  {storedCredentials.map((cred, index) => (
                    <Box 
                      key={cred.id} 
                      style={{ marginBottom: index < storedCredentials.length - 1 ? 'var(--sp-space-2)' : '0' }}
                    >
                      <Typography variant="body2" style={{ fontWeight: 'var(--sp-fw-bold)' }}>
                        {cred.service}:
                      </Typography>
                      <Typography variant="body2">
                        Email: {cred.email}
                      </Typography>
                      <Typography variant="body2">
                        Password: ••••••••••
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                msg && (
                  <Box className="credentials-display-box">
                    {msg}
                  </Box>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 1 && (
        <>
          {console.log('[App] Rendering TimesheetGrid, activeTab:', activeTab)}
          <Suspense fallback={
            <>
              {console.log('[App] Suspense fallback - loading timesheet')}
              <div className="loading-fallback">Loading timesheet...</div>
            </>
          }>
            <TimesheetGrid />
          </Suspense>
        </>
      )}

      {activeTab === 2 && (
        <Archive />
      )}

      {activeTab === 3 && (
        <Help />
      )}
        </div>

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
                Version 1.1.2
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
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
