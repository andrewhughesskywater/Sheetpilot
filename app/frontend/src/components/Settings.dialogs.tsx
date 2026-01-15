import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import UserManual from './UserManual';
import { APP_VERSION } from '@sheetpilot/shared';
import logoImage from '@/assets/images/logo.svg';
import { autoCompleteEmailDomain } from '@/utils/emailAutoComplete';

interface ExportLogsDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
  logFiles: string[];
  isExporting: boolean;
  isLoading: boolean;
  onExport: () => void;
}

export const ExportLogsDialog = ({
  open,
  onClose,
  error,
  logFiles,
  isExporting,
  isLoading,
  onExport
}: ExportLogsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
          onClick={onExport}
          disabled={isExporting || isLoading || !logFiles || logFiles.length === 0}
        >
          {isExporting ? 'Exporting...' : 'Export Logs'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface UserGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

export const UserGuideDialog = ({
  open,
  onClose
}: UserGuideDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableRestoreFocus
    >
      <DialogTitle>User Guide</DialogTitle>
      <DialogContent>
        <UserManual />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface AdminToolsDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
  isAdminActionLoading: boolean;
  onClearCredentials: () => void;
  onRebuildDatabase: () => void;
}

export const AdminToolsDialog = ({
  open,
  onClose,
  error,
  isAdminActionLoading,
  onClearCredentials,
  onRebuildDatabase
}: AdminToolsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          onClick={onClearCredentials}
          disabled={isAdminActionLoading}
          fullWidth
        >
          Clear All Credentials
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onRebuildDatabase}
          disabled={isAdminActionLoading}
          fullWidth
        >
          Rebuild Database
        </Button>
        <Button
          onClick={onClose}
          fullWidth
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface UpdateCredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  storedCredentials: Array<{
    id: number; service: string; email: string; created_at: string; updated_at: string;
  }>;
  updateEmail: string;
  updatePassword: string;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  isUpdatingCredentials: boolean;
  onUpdate: () => void;
}

export const UpdateCredentialsDialog = ({
  open,
  onClose,
  storedCredentials,
  updateEmail,
  updatePassword,
  onEmailChange,
  onPasswordChange,
  isUpdatingCredentials,
  onUpdate
}: UpdateCredentialsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
              onEmailChange(completedValue);
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
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Your password"
            margin="normal"
            variant="outlined"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          onClick={onUpdate}
          variant="contained"
          disabled={!updateEmail || !updatePassword || isUpdatingCredentials}
          startIcon={isUpdatingCredentials ? <CircularProgress size={20} /> : null}
        >
          {isUpdatingCredentials ? 'Updating...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface ClearCredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  isAdminActionLoading: boolean;
  onConfirm: () => void;
}

export const ClearCredentialsDialog = ({
  open,
  onClose,
  isAdminActionLoading,
  onConfirm
}: ClearCredentialsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={isAdminActionLoading}
          startIcon={isAdminActionLoading ? <CircularProgress size={20} /> : null}
        >
          {isAdminActionLoading ? 'Clearing...' : 'Clear All Credentials'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface RebuildDatabaseDialogProps {
  open: boolean;
  onClose: () => void;
  isAdminActionLoading: boolean;
  onConfirm: () => void;
}

export const RebuildDatabaseDialog = ({
  open,
  onClose,
  isAdminActionLoading,
  onConfirm
}: RebuildDatabaseDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={isAdminActionLoading}
          startIcon={isAdminActionLoading ? <CircularProgress size={20} /> : null}
        >
          {isAdminActionLoading ? 'Rebuilding...' : 'Rebuild Database'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface ApplicationSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
  headlessMode: boolean;
  isLoadingSettings: boolean;
  onHeadlessModeToggle: (checked: boolean) => void;
}

export const ApplicationSettingsDialog = ({
  open,
  onClose,
  error,
  headlessMode,
  isLoadingSettings,
  onHeadlessModeToggle
}: ApplicationSettingsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
                onChange={(e) => onHeadlessModeToggle(e.target.checked)}
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
          onClick={onClose}
          variant="contained"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AboutDialog = ({
  open,
  onClose
}: AboutDialogProps) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
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
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
