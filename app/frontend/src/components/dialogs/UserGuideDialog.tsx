/**
 * @fileoverview User Guide Dialog component
 */

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

import { type UserGuideDialogProps } from '../SettingsTypes';
import UserManual from '../UserManual';

export function UserGuideDialog({ open, onClose }: UserGuideDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth disableRestoreFocus>
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
}
