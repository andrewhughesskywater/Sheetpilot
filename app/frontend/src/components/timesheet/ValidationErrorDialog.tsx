/**
 * ValidationErrorDialog Component
 * 
 * Dialog that displays all validation errors with row numbers and descriptions.
 * Opens when the user clicks the "Multiple Errors" summary button.
 */

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { Error as ErrorIcon, Close as CloseIcon } from '@mui/icons-material';

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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Timesheet Validation Errors ({errors.length})
      </DialogTitle>
      
      <DialogContent>
        <List>
          {errors.map((error, index) => (
            <ListItem key={`${error.row}-${error.col}-${index}`}>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary={`Row ${error.row + 1}`}
                secondary={error.message}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      
      <DialogActions>
        <Button
          onClick={onClose}
          variant="contained"
          startIcon={<CloseIcon />}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

