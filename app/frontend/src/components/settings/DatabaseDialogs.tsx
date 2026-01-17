import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

interface RebuildDatabaseDialogProps {
  open: boolean;
  onClose: () => void;
  isAdminActionLoading: boolean;
  onConfirm: () => void;
}

export const RebuildDatabaseDialog = ({
  open,
  onClose,
  isAdminActionLoading,
  onConfirm,
}: RebuildDatabaseDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableRestoreFocus
    >
      <DialogTitle>Rebuild Database</DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mt: 1 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            WARNING: This will permanently delete all timesheet entries and
            credentials!
          </Typography>
          <Typography variant="body2">
            This action cannot be undone. All data will be lost and the database
            will be reset to a clean state.
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
          {isAdminActionLoading ? "Rebuilding..." : "Rebuild Database"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
