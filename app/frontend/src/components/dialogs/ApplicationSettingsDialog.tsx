/**
 * @fileoverview Application Settings Dialog component
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { type ApplicationSettingsDialogProps } from '../SettingsTypes';

export function ApplicationSettingsDialog({
  open,
  error,
  headlessMode,
  isLoadingSettings,
  onClose,
  onHeadlessModeToggle
}: ApplicationSettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
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
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
