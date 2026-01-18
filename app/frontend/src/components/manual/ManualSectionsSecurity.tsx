import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SecurityIcon from "@mui/icons-material/Security";
import type { ManualSection } from "./ManualSectionsGettingStartedAndFeatures";

export const securitySection: ManualSection = {
  id: "security",
  title: "Security & Privacy",
  icon: <SecurityIcon />,
  content: (
    <Box>
      <Typography variant="h6" gutterBottom className="manual-heading">
        Data Security
      </Typography>
      <Typography variant="body1" paragraph className="manual-body-text">
        SheetPilot is designed with security and privacy as top priorities.
        Here&apos;s how we protect your data:
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 2,
          mb: 3,
        }}
      >
        <Card variant="outlined" className="manual-card-success">
          <Typography variant="h6" className="manual-card-success-heading">
            Local Data Storage
          </Typography>
          <Typography variant="body2" className="manual-body-text">
            All your timesheet data and credentials are stored locally on your
            device using SQLite database. No data is transmitted to external
            servers except during SmartSheet submission.
          </Typography>
        </Card>

        <Card variant="outlined" className="manual-card-warning">
          <Typography variant="h6" className="manual-card-warning-heading">
            Encrypted Credentials
          </Typography>
          <Typography variant="body2" className="manual-body-text">
            Your SmartSheet credentials are encrypted before being stored
            locally. The encryption key is derived from your system and is not
            stored in the application.
          </Typography>
        </Card>

        <Card variant="outlined" className="manual-card-info">
          <Typography variant="h6" className="manual-card-info-heading">
            Secure Communication
          </Typography>
          <Typography variant="body2" className="manual-body-text">
            All communication with SmartSheet uses HTTPS encryption. Your
            credentials are only transmitted during the authentication process.
          </Typography>
        </Card>

        <Card variant="outlined" className="manual-card-secondary">
          <Typography variant="h6" className="manual-card-secondary-heading">
            No Data Collection
          </Typography>
          <Typography variant="body2" className="manual-body-text">
            SheetPilot does not collect, store, or transmit any usage data,
            analytics, or personal information to external services.
          </Typography>
        </Card>
      </Box>

      <Typography
        variant="h6"
        gutterBottom
        className="manual-heading manual-spacing-top"
      >
        Privacy Best Practices
      </Typography>
      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Regular Credential Updates"
            secondary="Change your stored credentials if you update your SmartSheet password"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Secure Device Access"
            secondary="Ensure your device is secured with appropriate access controls and antivirus software"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Regular Backups"
            secondary="Consider backing up your timesheet data regularly for business continuity"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Logout When Done"
            secondary="Close the application when not in use to prevent unauthorized access"
          />
        </ListItem>
      </List>

      <Alert severity="warning" sx={{ mt: 3 }}>
        <AlertTitle>Important Security Notes</AlertTitle>
        <Typography variant="body2" className="manual-body-text">
          • Never share your SmartSheet credentials with others
          <br />
          • Keep your device&apos;s operating system and security software up to
          date
          <br />
          • Be cautious when using SheetPilot on shared or public computers
          <br />• Report any suspicious activity or security concerns to your
          system administrator
        </Typography>
      </Alert>
    </Box>
  ),
};
