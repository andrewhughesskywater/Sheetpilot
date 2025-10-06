import React, { useState, useEffect } from 'react';
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
  PlayArrow as PlayArrowIcon,
  VpnKey as VpnKeyIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import Archive from './components/DatabaseViewer';
import TimesheetGrid from './components/TimesheetGrid';
import SidebarNavigation from './components/SidebarNavigation';
import UserManual from './components/UserManual';
import { DataProvider, useData } from './contexts/DataContext';
import './App.css';

const AppContent: React.FC = () => {
  const [msg, setMsg] = useState('Ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [storedCredentials, setStoredCredentials] = useState<Array<{
    id: number; service: string; email: string; created_at: string; updated_at: string;
  }>>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  
  // Use data context
  const { refreshTimesheetDraft, refreshArchiveData } = useData();


  const submitTimesheet = async () => {
    setIsProcessing(true);
    setMsg('Submitting timesheet…');
    try {
      const res = await window.timesheet.submit();
      if (res.error) {
        setMsg(`❌ ${res.error}`);
        setIsProcessing(false);
        return;
      }
      
      const submitMsg = res.submitResult ? 
        `✅ Submitted ${res.submitResult.successCount}/${res.submitResult.totalProcessed} entries to SmartSheet` : 
        '✅ No pending entries to submit';
      setMsg(`${submitMsg}\nDB: ${res.dbPath}`);
      
      // Refresh data if entries were submitted
      if (res.submitResult && res.submitResult.successCount > 0) {
        console.log('[App] Triggering data refresh after successful submission');
        await refreshTimesheetDraft();
        await refreshArchiveData();
      }
    } catch (error) {
      console.error('[Frontend] Unexpected error during submission:', error);
      setMsg(`❌ Unexpected error: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };


  const loadStoredCredentials = async () => {
    const creds = await window.credentials.list();
    setStoredCredentials(creds);
  };

  const saveCredentials = async () => {
    if (!credentials.email || !credentials.password) {
      setMsg('❌ Please enter both email and password');
      return;
    }

    setMsg('Saving credentials…');
    const result = await window.credentials.store('smartsheet', credentials.email, credentials.password);
    
    if (result.success) {
      setMsg(`✅ ${result.message}`);
      setCredentials({ email: '', password: '' });
      setShowCredentialsDialog(false);
      loadStoredCredentials();
    } else {
      setMsg(`❌ ${result.message}`);
    }
  };

  const deleteCredential = async (service: string) => {
    setMsg('Deleting credentials…');
    const result = await window.credentials.delete(service);
    
    if (result.success) {
      setMsg(`✅ ${result.message}`);
      loadStoredCredentials();
    } else {
      setMsg(`❌ ${result.message}`);
    }
  };

  // Load credentials on component mount
  useEffect(() => {
    loadStoredCredentials();
  }, []);

  const exportToCSV = async () => {
    setIsExporting(true);
    setMsg('Exporting timesheet data to CSV...');
    
    try {
      // CSV export functionality not yet implemented
      console.log('CSV export requested');
      
      setMsg('CSV export functionality coming soon');
    } catch (error) {
      console.error('[Frontend] CSV export error:', error);
      setMsg(`❌ Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <SidebarNavigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onLogoClick={() => setShowAboutDialog(true)}
      />
      
      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Header Actions */}
        <div className="header-actions">
          {activeTab === 0 && (
            <Button
              variant="contained"
              size="large"
              startIcon={<VpnKeyIcon />}
              onClick={() => setShowCredentialsDialog(true)}
              disabled={isProcessing}
              sx={{ 
                minWidth: 200,
                backgroundColor: '#34D399',
                borderRadius: 3,
                boxShadow: '0 4px 6px -1px rgba(52, 211, 153, 0.3)',
                '&:hover': {
                  backgroundColor: '#10B981',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 8px -1px rgba(52, 211, 153, 0.4)',
                },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Add Credentials
            </Button>
          )}

          {activeTab === 1 && (
            <Button
              variant="contained"
              size="large"
              startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
              onClick={submitTimesheet}
              disabled={isProcessing}
              sx={{ 
                minWidth: 200,
                backgroundColor: '#4F8EF7',
                borderRadius: 3,
                boxShadow: '0 4px 6px -1px rgba(79, 142, 247, 0.3)',
                '&:hover': {
                  backgroundColor: '#3B82F6',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 8px -1px rgba(79, 142, 247, 0.4)',
                },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {isProcessing ? 'Submitting...' : 'Submit Timesheet'}
            </Button>
          )}

          {activeTab === 2 && (
            <Button
              variant="contained"
              size="large"
              startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={exportToCSV}
              disabled={isProcessing || isExporting}
              sx={{ 
                minWidth: 200,
                backgroundColor: '#A78BFA',
                borderRadius: 3,
                boxShadow: '0 4px 6px -1px rgba(167, 139, 250, 0.3)',
                '&:hover': {
                  backgroundColor: '#8B5CF6',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 8px -1px rgba(167, 139, 250, 0.4)',
                },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
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
            onClose={() => setShowCredentialsDialog(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              Add SmartSheet Credentials
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                  placeholder="your.email@company.com"
                  margin="normal"
                  variant="outlined"
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
              <Button onClick={() => setShowCredentialsDialog(false)}>
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
            <Card sx={{ 
              mb: 3, 
              width: '100%',
              borderRadius: 3,
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              border: '1px solid #E5E7EB'
            }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
          
          {/* Status Display */}
          <Card sx={{ 
            width: '100%',
            borderRadius: 3,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            border: '1px solid #E5E7EB'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status
              </Typography>
              <div className="status-display">
                {msg}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 1 && (
        <TimesheetGrid />
      )}

      {activeTab === 2 && (
        <Archive />
      )}

      {activeTab === 3 && (
        <UserManual />
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
            About SheetPilot
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, textAlign: 'center' }}>
              <img 
                src="./SheetPilot Logo.ico" 
                alt="SheetPilot Logo" 
                className="about-dialog-logo"
              />
              <Typography variant="h5" gutterBottom>
                SheetPilot
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Version 1.0.0
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Created by Andrew Hughes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
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
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
