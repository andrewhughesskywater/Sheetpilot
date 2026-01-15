import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { logUserAction } from "@/services/ipc/logger";

interface SettingsFeatureCardsProps {
  storedCredentials: Array<{
    id: number;
    service: string;
    email: string;
    created_at: string;
    updated_at: string;
  }>;
  isAdmin: boolean;
  setShowLogsDialog: (show: boolean) => void;
  setShowUpdateCredentialsDialog: (show: boolean) => void;
  setUpdateEmail: (email: string) => void;
  setShowUserGuideDialog: (show: boolean) => void;
  setShowSettingsDialog: (show: boolean) => void;
  setShowAboutDialog: (show: boolean) => void;
  handleLogout: () => void;
  setShowAdminDialog: (show: boolean) => void;
}

export const SettingsFeatureCards = ({
  storedCredentials,
  isAdmin,
  setShowLogsDialog,
  setShowUpdateCredentialsDialog,
  setUpdateEmail,
  setShowUserGuideDialog,
  setShowSettingsDialog,
  setShowAboutDialog,
  handleLogout,
  setShowAdminDialog,
}: SettingsFeatureCardsProps) => {
  return (
    <Box className="settings-cards-grid">
      {/* Export Logs Card */}
      <Box
        className="settings-feature-card"
        onClick={() => setShowLogsDialog(true)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === "Enter" && setShowLogsDialog(true)}
      >
        <Typography
          variant="h6"
          component="h2"
          className="settings-feature-card-title"
        >
          Export Logs
        </Typography>
      </Box>

      {/* Update Credentials Card */}
      <Box
        className="settings-feature-card"
        onClick={() => {
          const existingCred = storedCredentials.find(
            (c) => c.service === "smartsheet"
          );
          if (existingCred) {
            setUpdateEmail(existingCred.email);
          }
          setShowUpdateCredentialsDialog(true);
        }}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === "Enter") {
            const existingCred = storedCredentials.find(
              (c) => c.service === "smartsheet"
            );
            if (existingCred) {
              setUpdateEmail(existingCred.email);
            }
            setShowUpdateCredentialsDialog(true);
          }
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          className="settings-feature-card-title"
        >
          Update Credentials
        </Typography>
      </Box>

      {/* User Guide Card */}
      <Box
        className="settings-feature-card"
        onClick={() => setShowUserGuideDialog(true)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === "Enter" && setShowUserGuideDialog(true)}
      >
        <Typography
          variant="h6"
          component="h2"
          className="settings-feature-card-title"
        >
          User Guide
        </Typography>
      </Box>

      {/* Settings Card */}
      <Box
        className="settings-feature-card"
        onClick={() => setShowSettingsDialog(true)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === "Enter" && setShowSettingsDialog(true)}
      >
        <Typography
          variant="h6"
          component="h2"
          className="settings-feature-card-title"
        >
          Application Settings
        </Typography>
      </Box>

      {/* About SheetPilot Card */}
      <Box
        className="settings-feature-card"
        onClick={() => {
          logUserAction("about-dialog-opened");
          setShowAboutDialog(true);
        }}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === "Enter") {
            logUserAction("about-dialog-opened");
            setShowAboutDialog(true);
          }
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          className="settings-feature-card-title"
        >
          About SheetPilot
        </Typography>
      </Box>

      {/* Logout Card */}
      <Box
        className="settings-feature-card settings-feature-card-warning"
        onClick={handleLogout}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === "Enter" && handleLogout()}
      >
        <Typography
          variant="h6"
          component="h2"
          className="settings-feature-card-title"
        >
          Logout
        </Typography>
      </Box>

      {/* Admin Tools Card - only show for admins */}
      {isAdmin && (
        <Box
          className="settings-feature-card settings-feature-card-admin"
          onClick={() => setShowAdminDialog(true)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === "Enter" && setShowAdminDialog(true)}
        >
          <Typography
            variant="h6"
            component="h2"
            className="settings-feature-card-title"
          >
            Admin Tools
          </Typography>
        </Box>
      )}
    </Box>
  );
};
