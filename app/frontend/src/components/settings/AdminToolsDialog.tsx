import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";

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
  onRebuildDatabase,
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
      <DialogActions
        sx={{ flexDirection: "column", gap: 1, alignItems: "stretch", p: 2 }}
      >
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
        <Button onClick={onClose} fullWidth>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
