/**
 * @fileoverview Confirmation Dialog component (reusable)
 */

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { type ConfirmDialogProps } from '../SettingsTypes';

export function ConfirmDialog({
  open,
  title,
  severity,
  confirmLabel,
  loadingLabel,
  confirmColor,
  isLoading,
  onClose,
  onConfirm,
  children
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Alert severity={severity} sx={{ mt: 1 }}>
          {children}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={confirmColor}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isLoading ? (loadingLabel ?? `${confirmLabel}...`) : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
