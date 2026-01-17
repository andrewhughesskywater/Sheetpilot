import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import logoImage from "@/assets/images/logo.svg";
import { APP_VERSION } from "@sheetpilot/shared";

interface ApplicationSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
  headlessMode: boolean;
  isLoadingSettings: boolean;
  onHeadlessModeToggle: (checked: boolean) => void;
}

export const ApplicationSettingsDialog = ({
  open,
  onClose,
  error,
  headlessMode,
  isLoadingSettings,
  onHeadlessModeToggle,
}: ApplicationSettingsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableRestoreFocus
    >
      <DialogTitle>Application Settings</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Browser Settings
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={headlessMode}
                onChange={(e) => onHeadlessModeToggle(e.target.checked)}
                disabled={isLoadingSettings}
              />
            }
            label={
              <Box>
                <Typography variant="body1">Headless Mode</Typography>
                <Typography variant="caption" color="text.secondary">
                  Run browser automation without visible windows. Changes take
                  effect on next submission.
                </Typography>
              </Box>
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AboutDialog = ({ open, onClose }: AboutDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableRestoreFocus
    >
      <DialogTitle>About</DialogTitle>
      <DialogContent>
        <Box className="about-dialog-content">
          <img
            src={logoImage}
            alt="SheetPilot Logo"
            className="about-dialog-logo"
          />
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Version {APP_VERSION}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Created by Andrew Hughes
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            className="about-dialog-description"
          >
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
};
