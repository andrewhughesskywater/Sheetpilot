/**
 * @fileoverview Admin Tools Dialog component
 */

import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import { type AdminToolsDialogProps } from '../SettingsTypes';

export function AdminToolsDialog({
  open,
  error,
  isAdminActionLoading,
  onClose,
  onRequestClearCredentials,
  onRequestRebuildDatabase,
}: AdminToolsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
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
          <Typography variant="body2">Admin users cannot submit timesheet entries to SmartSheet.</Typography>
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
          onClick={onRequestClearCredentials}
          disabled={isAdminActionLoading}
          fullWidth
        >
          Clear All Credentials
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onRequestRebuildDatabase}
          disabled={isAdminActionLoading}
          fullWidth
        >
          Rebuild Database
        </Button>
        <Button onClick={onClose} fullWidth>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
