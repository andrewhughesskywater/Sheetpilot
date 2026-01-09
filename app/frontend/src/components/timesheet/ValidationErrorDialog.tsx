/**
 * ValidationErrorDialog Component
 *
 * Dialog that displays all validation errors with row numbers and descriptions.
 * Opens when the user clicks the "Multiple Errors" summary button.
 */

import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

interface ValidationError {
  row: number;
  col: number;
  field: string;
  message: string;
}

export interface ValidationErrorDialogProps {
  open: boolean;
  errors: ValidationError[];
  onClose: () => void;
}

export function ValidationErrorDialog({ open, errors, onClose }: ValidationErrorDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Timesheet Validation Errors ({errors.length})</DialogTitle>

      <DialogContent>
        <List>
          {errors.map((error, index) => (
            <ListItem key={`${error.row}-${error.col}-${index}`}>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText primary={`Row ${error.row + 1}`} secondary={error.message} />
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" startIcon={<CloseIcon />}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
