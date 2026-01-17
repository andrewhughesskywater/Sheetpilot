import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import ContactSupportIcon from "@mui/icons-material/ContactSupportIcon";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import type { ManualSection } from "./ManualSections1";

export const troubleshootingSection: ManualSection = {
  id: "troubleshooting",
  title: "Troubleshooting",
  icon: <InfoIcon />,
  content: (
    <Box>
      <Typography variant="h6" gutterBottom className="manual-heading">
        Common Issues and Solutions
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          gutterBottom
          className="manual-heading manual-spacing-bottom"
        >
          Authentication Issues
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary="Invalid credentials error"
              secondary={
                <>
                  <strong>Solution:</strong> Verify your SmartSheet email and
                  password are correct. If you recently changed your password,
                  update your stored credentials in the Home tab.
                </>
              }
              secondaryTypographyProps={{ className: "manual-body-text" }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary="Connection timeout"
              secondary={
                <>
                  <strong>Solution:</strong> Check your internet connection and
                  ensure SmartSheet is accessible. Try again in a few minutes if
                  the issue persists.
                </>
              }
              secondaryTypographyProps={{ className: "manual-body-text" }}
            />
          </ListItem>
        </List>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom className="manual-heading">
          Submission Issues
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary="Some entries failed to submit"
              secondary={
                <>
                  <strong>Solution:</strong> Check the error messages in the
                  status area. Common causes include missing project codes,
                  invalid time formats, or duplicate entries. Fix the issues and
                  try again.
                </>
              }
              secondaryTypographyProps={{ className: "manual-body-text" }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary="No entries to submit"
              secondary={
                <>
                  <strong>Solution:</strong> Ensure you have timesheet entries
                  for the current week. Check that entries are not already
                  submitted (they won&apos;t appear in the submission queue).
                </>
              }
              secondaryTypographyProps={{ className: "manual-body-text" }}
            />
          </ListItem>
        </List>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom className="manual-heading">
          Application Issues
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary="Application won't start"
              secondary={
                <>
                  <strong>Solution:</strong> Restart your computer and try
                  again. If the issue persists, contact your system
                  administrator for assistance.
                </>
              }
              secondaryTypographyProps={{ className: "manual-body-text" }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <WarningIcon color="warning" />
            </ListItemIcon>
            <ListItemText
              primary="Data not loading"
              secondary={
                <>
                  <strong>Solution:</strong> Check if the database file is
                  accessible and not corrupted. The application stores data
                  locally in a SQLite database file.
                </>
              }
              secondaryTypographyProps={{ className: "manual-body-text" }}
            />
          </ListItem>
        </List>
      </Box>

      <Alert severity="info" sx={{ mt: 3 }}>
        <AlertTitle>Getting Additional Help</AlertTitle>
        <Typography variant="body2" className="manual-body-text">
          If you continue to experience issues after trying these solutions:
        </Typography>
        <List dense sx={{ mt: 1 }}>
          <ListItem sx={{ py: 0 }}>
            <ListItemIcon>
              <ContactSupportIcon color="info" />
            </ListItemIcon>
            <ListItemText
              primary="Contact your system administrator"
              sx={{ "& .MuiListItemText-primary": { fontSize: "0.875rem" } }}
            />
          </ListItem>
          <ListItem sx={{ py: 0 }}>
            <ListItemIcon>
              <InfoIcon color="info" />
            </ListItemIcon>
            <ListItemText
              primary="Check the application logs for detailed error information"
              sx={{ "& .MuiListItemText-primary": { fontSize: "0.875rem" } }}
            />
          </ListItem>
          <ListItem sx={{ py: 0 }}>
            <ListItemIcon>
              <VpnKeyIcon color="info" />
            </ListItemIcon>
            <ListItemText
              primary="Verify your SmartSheet account has the necessary permissions"
              sx={{ "& .MuiListItemText-primary": { fontSize: "0.875rem" } }}
            />
          </ListItem>
        </List>
      </Alert>
    </Box>
  ),
};
