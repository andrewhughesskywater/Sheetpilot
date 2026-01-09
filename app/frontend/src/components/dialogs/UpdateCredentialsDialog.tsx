/**
 * @fileoverview Update Credentials Dialog component
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

import { type UpdateCredentialsDialogProps } from '../SettingsTypes';

export function UpdateCredentialsDialog({
  open,
  storedCredentials,
  updateEmail,
  updatePassword,
  isUpdatingCredentials,
  onClose,
  onSave,
  onEmailChange,
  onPasswordChange,
}: UpdateCredentialsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
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
            onChange={(e) => onEmailChange(e.target.value)}
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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={!updateEmail || !updatePassword || isUpdatingCredentials}
          startIcon={isUpdatingCredentials ? <CircularProgress size={20} /> : null}
        >
          {isUpdatingCredentials ? 'Updating...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
