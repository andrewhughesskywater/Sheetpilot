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

import './Settings.css';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { useCallback,useEffect, useState } from 'react';

import { useSession } from '@/contexts/SessionContext';
import { listCredentials as listCredentialsIpc } from '@/services/ipc/credentials';
import { logError, logInfo, logUserAction, logWarn } from '@/services/ipc/logger';
import { getLogPath as getLogPathIpc } from '@/services/ipc/logs';
import { getSetting } from '@/services/ipc/settings';
import { autoCompleteEmailDomain } from '@/utils/emailAutoComplete';

import {
  AboutDialog,
  AdminToolsDialog,
  ApplicationSettingsDialog,
  ConfirmDialog,
  ExportLogsDialog,
  UpdateCredentialsDialog,
  UserGuideDialog,
} from './dialogs';
import {
  adminClearCredentials,
  adminRebuildDatabase,
  exportLogsToFile,
  toggleHeadlessMode,
  updateSmartsheetCredentials,
} from './SettingsHandlers';
import { SettingsCardsGrid,SettingsHeader } from './SettingsHelpers';
import type { StoredCredential } from './SettingsTypes';

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
  const [storedCredentials, setStoredCredentials] = useState<StoredCredential[]>([]);
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

  const handleHeadlessModeToggle = async (checked: boolean) =>
    toggleHeadlessMode(checked, setHeadlessMode, setError, setIsLoadingSettings);

  // Load log files, credentials, and settings on component mount
  useEffect(() => {
    void loadLogFiles();
    void loadStoredCredentials();
    void loadSettings();
  }, [loadLogFiles]);

  const handleUpdateCredentials = async () =>
    updateSmartsheetCredentials(token, {
      email: updateEmail,
      password: updatePassword,
      setError,
      setIsUpdating: setIsUpdatingCredentials,
      onSuccess: async () => {
        setShowUpdateCredentialsDialog(false);
        setUpdateEmail('');
        setUpdatePassword('');
        await loadStoredCredentials();
      },
    });

  const handleLogout = async () => {
    try {
      await sessionLogout();
      logInfo('User logged out from Settings page');
    } catch (err) {
      logError('Could not logout', { error: err instanceof Error ? err.message : String(err) });
      setError('Could not logout');
    }
  };

  const handleAdminClearCredentials = async () =>
    adminClearCredentials(token, setError, setIsAdminActionLoading, async () => {
      setShowClearCredentialsDialog(false);
      await loadStoredCredentials();
    });

  const handleAdminRebuildDatabase = async () =>
    adminRebuildDatabase(token, setError, setIsAdminActionLoading, async () => {
      setShowRebuildDatabaseDialog(false);
      await loadStoredCredentials();
    });

  const exportLogs = async () => exportLogsToFile(token, { logFiles, logPath, setError, setIsExporting });

  const openUpdateCredentialsDialog = () => {
    const existingCred = storedCredentials.find((c) => c.service === 'smartsheet');
    if (existingCred) {
      setUpdateEmail(existingCred.email);
    }
    setShowUpdateCredentialsDialog(true);
  };

  return (
    <div className="settings-container">
      {/* Main Container Card */}
      <Card className="settings-main-card">
        <CardContent className="settings-main-card-content">
          <SettingsHeader />

          <SettingsCardsGrid
            isAdmin={isAdmin}
            onOpenLogs={() => setShowLogsDialog(true)}
            onOpenUpdateCredentials={openUpdateCredentialsDialog}
            onOpenUserGuide={() => setShowUserGuideDialog(true)}
            onOpenSettings={() => setShowSettingsDialog(true)}
            onOpenAbout={() => {
              logUserAction('about-dialog-opened');
              setShowAboutDialog(true);
            }}
            onLogout={() => void handleLogout()}
            onOpenAdminTools={() => setShowAdminDialog(true)}
          />
        </CardContent>
      </Card>

      <ExportLogsDialog
        open={showLogsDialog}
        error={error}
        logFiles={logFiles}
        isExporting={isExporting}
        isLoading={isLoading}
        onClose={() => {
          setShowLogsDialog(false);
          setError('');
        }}
        onExport={() => void exportLogs()}
      />

      <UserGuideDialog open={showUserGuideDialog} onClose={() => setShowUserGuideDialog(false)} />

      {isAdmin && (
        <AdminToolsDialog
          open={showAdminDialog}
          error={error}
          isAdminActionLoading={isAdminActionLoading}
          onClose={() => {
            setShowAdminDialog(false);
            setError('');
          }}
          onRequestClearCredentials={() => {
            setShowAdminDialog(false);
            setShowClearCredentialsDialog(true);
          }}
          onRequestRebuildDatabase={() => {
            setShowAdminDialog(false);
            setShowRebuildDatabaseDialog(true);
          }}
        />
      )}

      <UpdateCredentialsDialog
        open={showUpdateCredentialsDialog}
        storedCredentials={storedCredentials}
        updateEmail={updateEmail}
        updatePassword={updatePassword}
        isUpdatingCredentials={isUpdatingCredentials}
        onClose={() => {
          setShowUpdateCredentialsDialog(false);
          setUpdateEmail('');
          setUpdatePassword('');
          setError('');
        }}
        onSave={() => void handleUpdateCredentials()}
        onEmailChange={(value) => setUpdateEmail(autoCompleteEmailDomain(value))}
        onPasswordChange={setUpdatePassword}
      />

      <ConfirmDialog
        open={showClearCredentialsDialog}
        title="Clear All Credentials"
        severity="warning"
        confirmLabel="Clear All Credentials"
        loadingLabel="Clearing..."
        confirmColor="error"
        isLoading={isAdminActionLoading}
        onClose={() => setShowClearCredentialsDialog(false)}
        onConfirm={() => void handleAdminClearCredentials()}
      >
        <Typography variant="body2">
          This will permanently delete all stored credentials. Users will need to log in again.
        </Typography>
      </ConfirmDialog>

      <ConfirmDialog
        open={showRebuildDatabaseDialog}
        title="Rebuild Database"
        severity="error"
        confirmLabel="Rebuild Database"
        loadingLabel="Rebuilding..."
        confirmColor="error"
        isLoading={isAdminActionLoading}
        onClose={() => setShowRebuildDatabaseDialog(false)}
        onConfirm={() => void handleAdminRebuildDatabase()}
      >
        <>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            WARNING: This will permanently delete all timesheet entries and credentials!
          </Typography>
          <Typography variant="body2">
            This action cannot be undone. All data will be lost and the database will be reset to a clean state.
          </Typography>
        </>
      </ConfirmDialog>

      <ApplicationSettingsDialog
        open={showSettingsDialog}
        error={error}
        headlessMode={headlessMode}
        isLoadingSettings={isLoadingSettings}
        onClose={() => {
          setShowSettingsDialog(false);
          setError('');
        }}
        onHeadlessModeToggle={(checked) => void handleHeadlessModeToggle(checked)}
      />

      <AboutDialog open={showAboutDialog} onClose={() => setShowAboutDialog(false)} />
    </div>
  );
}

export default Settings;
