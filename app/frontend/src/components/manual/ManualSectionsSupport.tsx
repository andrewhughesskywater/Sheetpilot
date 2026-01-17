import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import ContactSupportIcon from "@mui/icons-material/ContactSupportIcon";
import type { ManualSection } from "./ManualSections1";

export const supportSection: ManualSection = {
  id: "support",
  title: "Support & Resources",
  icon: <ContactSupportIcon />,
  content: (
    <Box>
      <Typography variant="h6" gutterBottom className="manual-heading">
        Getting Help
      </Typography>
      <Typography variant="body1" paragraph className="manual-body-text">
        If you need assistance with SheetPilot, here are the resources available
        to you:
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 2,
          mb: 3,
        }}
      >
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Documentation
          </Typography>
          <Typography
            variant="body2"
            className="manual-body-text manual-spacing-bottom"
          >
            This user manual provides comprehensive information about all
            SheetPilot features and workflows.
          </Typography>
          <Chip label="Always Available" color="primary" size="small" />
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            System Administrator
          </Typography>
          <Typography
            variant="body2"
            className="manual-body-text manual-spacing-bottom"
          >
            Your organization&apos;s system administrator can help with
            technical issues and account problems.
          </Typography>
          <Chip label="Internal Support" color="secondary" size="small" />
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Application Logs
          </Typography>
          <Typography
            variant="body2"
            className="manual-body-text manual-spacing-bottom"
          >
            Detailed error information is available in the application logs for
            troubleshooting.
          </Typography>
          <Chip label="Technical Details" color="info" size="small" />
        </Card>
      </Box>

      <Typography
        variant="h6"
        gutterBottom
        className="manual-heading manual-spacing-top"
      >
        Frequently Asked Questions
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography
          variant="subtitle1"
          className="manual-heading manual-spacing-bottom-small"
        >
          Q: How often should I submit my timesheet?
        </Typography>
        <Typography
          variant="body2"
          className="manual-body-text manual-spacing-bottom manual-padding-left"
        >
          A: Most organizations require weekly timesheet submissions. Check with
          your supervisor or HR department for specific requirements.
        </Typography>

        <Typography
          variant="subtitle1"
          className="manual-heading manual-spacing-bottom-small"
        >
          Q: Can I edit entries after they&apos;ve been submitted?
        </Typography>
        <Typography
          variant="body2"
          className="manual-body-text manual-spacing-bottom manual-padding-left"
        >
          A: Once entries are submitted to SmartSheet, you cannot edit them
          through SheetPilot. You would need to make changes directly in
          SmartSheet or contact your administrator.
        </Typography>

        <Typography
          variant="subtitle1"
          className="manual-heading manual-spacing-bottom-small"
        >
          Q: What happens if my internet connection is lost during submission?
        </Typography>
        <Typography
          variant="body2"
          className="manual-body-text manual-spacing-bottom manual-padding-left"
        >
          A: SheetPilot will show an error message. Check your connection and
          try submitting again. The application will only submit entries that
          haven&apos;t been successfully submitted yet.
        </Typography>

        <Typography
          variant="subtitle1"
          className="manual-heading manual-spacing-bottom-small"
        >
          Q: Can I use SheetPilot on multiple devices?
        </Typography>
        <Typography
          variant="body2"
          className="manual-body-text manual-spacing-bottom manual-padding-left"
        >
          A: SheetPilot stores data locally on each device. You&apos;ll need to
          add your credentials and manage timesheet entries separately on each
          device.
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom className="manual-heading">
        Application Information
      </Typography>
      <Paper className="manual-feature-card">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle2" className="manual-heading">
              Application Name
            </Typography>
            <Typography variant="body2" className="manual-body-text">
              SheetPilot
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" className="manual-heading">
              Database
            </Typography>
            <Typography variant="body2" className="manual-body-text">
              SQLite (Local)
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" className="manual-heading">
              Platform
            </Typography>
            <Typography variant="body2" className="manual-body-text">
              Electron Desktop App
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" className="manual-heading">
              Integration
            </Typography>
            <Typography variant="body2" className="manual-body-text">
              SmartSheet API
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  ),
};
