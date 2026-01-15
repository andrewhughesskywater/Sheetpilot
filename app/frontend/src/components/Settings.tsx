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
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSession } from '@/contexts/SessionContext';
import './Settings.css';
import {
  loadStoredCredentials as loadStoredCredentialsHelper,
  loadLogFiles as loadLogFilesHelper,
  loadSettings as loadSettingsHelper,
  handleHeadlessModeToggle as handleHeadlessModeToggleHelper,
  handleUpdateCredentials as handleUpdateCredentialsHelper,
  handleLogout as handleLogoutHelper,
  handleAdminClearCredentials as handleAdminClearCredentialsHelper,
  handleAdminRebuildDatabase as handleAdminRebuildDatabaseHelper,
  exportLogs as exportLogsHelper
} from './Settings.helpers';
import {
  ExportLogsDialog,
  UserGuideDialog,
  AdminToolsDialog,
  UpdateCredentialsDialog,
  ClearCredentialsDialog,
  RebuildDatabaseDialog,
  ApplicationSettingsDialog,
  AboutDialog
} from './Settings.dialogs';
import { SettingsFeatureCards } from './Settings.cards';

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

  const loadStoredCredentials = useCallback(async () => {
    await loadStoredCredentialsHelper(setStoredCredentials);
  }, []);

  const loadLogFiles = useCallback(async () => {
    await loadLogFilesHelper(token, setIsLoading, setError, setLogPath, setLogFiles);
  }, [token]);

  const loadSettings = useCallback(async () => {
    await loadSettingsHelper(setHeadlessMode);
  }, []);

  const handleHeadlessModeToggle = useCallback(async (checked: boolean) => {
    await handleHeadlessModeToggleHelper(checked, setIsLoadingSettings, setHeadlessMode, setError);
  }, []);

  // Load log files, credentials, and settings on component mount
  useEffect(() => {
    void loadLogFiles();
    void loadStoredCredentials();
    void loadSettings();
   
  }, [loadLogFiles, loadStoredCredentials, loadSettings]);

  const handleUpdateCredentials = useCallback(async () => {
    await handleUpdateCredentialsHelper(
      updateEmail,
      updatePassword,
      token,
      setIsUpdatingCredentials,
      setError,
      setShowUpdateCredentialsDialog,
      setUpdateEmail,
      setUpdatePassword,
      loadStoredCredentials
    );
  }, [updateEmail, updatePassword, token, loadStoredCredentials]);

  const handleLogout = useCallback(async () => {
    await handleLogoutHelper(sessionLogout, setError);
  }, [sessionLogout]);

  const handleAdminClearCredentials = useCallback(async () => {
    await handleAdminClearCredentialsHelper(
      token,
      setIsAdminActionLoading,
      setError,
      setShowClearCredentialsDialog,
      loadStoredCredentials
    );
  }, [token, loadStoredCredentials]);

  const handleAdminRebuildDatabase = useCallback(async () => {
    await handleAdminRebuildDatabaseHelper(
      token,
      setIsAdminActionLoading,
      setError,
      setShowRebuildDatabaseDialog,
      loadStoredCredentials
    );
  }, [token, loadStoredCredentials]);

  const exportLogs = useCallback(async () => {
    await exportLogsHelper(token, logFiles, logPath, setIsExporting, setError);
  }, [token, logFiles, logPath]);

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

          <SettingsFeatureCards
            storedCredentials={storedCredentials}
            isAdmin={isAdmin}
            setShowLogsDialog={setShowLogsDialog}
            setShowUpdateCredentialsDialog={setShowUpdateCredentialsDialog}
            setUpdateEmail={setUpdateEmail}
            setShowUserGuideDialog={setShowUserGuideDialog}
            setShowSettingsDialog={setShowSettingsDialog}
            setShowAboutDialog={setShowAboutDialog}
            handleLogout={handleLogout}
            setShowAdminDialog={setShowAdminDialog}
          />
        </CardContent>
      </Card>

      <ExportLogsDialog
        open={showLogsDialog}
        onClose={() => {
          setShowLogsDialog(false);
          setError('');
        }}
        error={error}
        logFiles={logFiles}
        isExporting={isExporting}
        isLoading={isLoading}
        onExport={exportLogs}
      />

      <UserGuideDialog
        open={showUserGuideDialog}
        onClose={() => setShowUserGuideDialog(false)}
      />

      {isAdmin && (
        <AdminToolsDialog
          open={showAdminDialog}
          onClose={() => {
            setShowAdminDialog(false);
            setError('');
          }}
          error={error}
          isAdminActionLoading={isAdminActionLoading}
          onClearCredentials={() => {
            setShowAdminDialog(false);
            setShowClearCredentialsDialog(true);
          }}
          onRebuildDatabase={() => {
            setShowAdminDialog(false);
            setShowRebuildDatabaseDialog(true);
          }}
        />
      )}

      <UpdateCredentialsDialog
        open={showUpdateCredentialsDialog}
        onClose={() => {
          setShowUpdateCredentialsDialog(false);
          setUpdateEmail('');
          setUpdatePassword('');
          setError('');
        }}
        storedCredentials={storedCredentials}
        updateEmail={updateEmail}
        updatePassword={updatePassword}
        onEmailChange={setUpdateEmail}
        onPasswordChange={setUpdatePassword}
        isUpdatingCredentials={isUpdatingCredentials}
        onUpdate={handleUpdateCredentials}
      />

      <ClearCredentialsDialog
        open={showClearCredentialsDialog}
        onClose={() => setShowClearCredentialsDialog(false)}
        isAdminActionLoading={isAdminActionLoading}
        onConfirm={handleAdminClearCredentials}
      />

      <RebuildDatabaseDialog
        open={showRebuildDatabaseDialog}
        onClose={() => setShowRebuildDatabaseDialog(false)}
        isAdminActionLoading={isAdminActionLoading}
        onConfirm={handleAdminRebuildDatabase}
      />

      <ApplicationSettingsDialog
        open={showSettingsDialog}
        onClose={() => {
          setShowSettingsDialog(false);
          setError('');
        }}
        error={error}
        headlessMode={headlessMode}
        isLoadingSettings={isLoadingSettings}
        onHeadlessModeToggle={handleHeadlessModeToggle}
      />

      <AboutDialog
        open={showAboutDialog}
        onClose={() => setShowAboutDialog(false)}
      />
    </div>
  );
};

export default Settings;
