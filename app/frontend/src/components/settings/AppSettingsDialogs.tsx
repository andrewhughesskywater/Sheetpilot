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
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import logoImage from "@/assets/images/logo.svg";
import { APP_VERSION } from "@sheetpilot/shared";
import type { ThemeMode } from "@/utils/theme-manager";

interface ApplicationSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  error: string;
  headlessMode: boolean;
  themeMode: ThemeMode;
  isLoadingSettings: boolean;
  onHeadlessModeToggle: (checked: boolean) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export const ApplicationSettingsDialog = ({
  open,
  onClose,
  error,
  headlessMode,
  themeMode,
  isLoadingSettings,
  onHeadlessModeToggle,
  onThemeModeChange,
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
            Appearance
          </Typography>
          <FormControl component="fieldset" sx={{ mb: 3 }}>
            <FormLabel component="legend">Theme Mode</FormLabel>
            <RadioGroup
              value={themeMode}
              onChange={(e) => onThemeModeChange(e.target.value as ThemeMode)}
            >
              <FormControlLabel
                value="auto"
                control={<Radio disabled={isLoadingSettings} />}
                label={
                  <Box>
                    <Typography variant="body1">Auto (System)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically match Windows theme
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="light"
                control={<Radio disabled={isLoadingSettings} />}
                label={
                  <Box>
                    <Typography variant="body1">Light</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Always use light theme
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="dark"
                control={<Radio disabled={isLoadingSettings} />}
                label={
                  <Box>
                    <Typography variant="body1">Dark</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Always use dark theme
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

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
