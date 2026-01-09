/**
 * @fileoverview About Dialog component
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { APP_VERSION } from '@sheetpilot/shared/constants';

import logoImage from '../../assets/images/logo.svg';
import { type AboutDialogProps } from '../SettingsTypes';

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableRestoreFocus>
      <DialogTitle>About</DialogTitle>
      <DialogContent>
        <Box className="about-dialog-content">
          <img src={logoImage} alt="SheetPilot Logo" className="about-dialog-logo" />
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
}
