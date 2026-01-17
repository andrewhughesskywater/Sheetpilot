import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import DownloadIcon from "@mui/icons-material/Download";

interface ExportLogsDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
  logFiles: string[];
  isExporting: boolean;
  isLoading: boolean;
  onExport: () => void;
}

export const ExportLogsDialog = ({
  open,
  onClose,
  error,
  logFiles,
  isExporting,
  isLoading,
  onExport,
}: ExportLogsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableRestoreFocus
    >
      <DialogTitle>Export Application Logs</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 2, mb: 2 }}
        >
          Export application logs for troubleshooting and support purposes.
        </Typography>
        {logFiles && logFiles.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            Latest log: {logFiles[logFiles.length - 1]}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={
            isExporting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <DownloadIcon />
            )
          }
          onClick={onExport}
          disabled={
            isExporting || isLoading || !logFiles || logFiles.length === 0
          }
        >
          {isExporting ? "Exporting..." : "Export Logs"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
