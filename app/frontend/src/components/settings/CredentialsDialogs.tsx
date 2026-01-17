import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import { autoCompleteEmailDomain } from "@/utils/emailAutoComplete";

interface UpdateCredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  storedCredentials: Array<{
    id: number;
    service: string;
    email: string;
    created_at: string;
    updated_at: string;
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
  onUpdate,
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
        {storedCredentials.length > 0
          ? "Update SmartSheet Credentials"
          : "Add SmartSheet Credentials"}
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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onUpdate}
          variant="contained"
          disabled={!updateEmail || !updatePassword || isUpdatingCredentials}
          startIcon={
            isUpdatingCredentials ? <CircularProgress size={20} /> : null
          }
        >
          {isUpdatingCredentials ? "Updating..." : "Save"}
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
  onConfirm,
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
            This will permanently delete all stored credentials. Users will need
            to log in again.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={isAdminActionLoading}
          startIcon={
            isAdminActionLoading ? <CircularProgress size={20} /> : null
          }
        >
          {isAdminActionLoading ? "Clearing..." : "Clear All Credentials"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
