import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import StepContent from "@mui/material/StepContent";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import StorageIcon from "@mui/icons-material/Storage";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ArchiveIcon from "@mui/icons-material/Archive";

export interface ManualSection {
  id: string;
  title: string;
  icon: React.ReactElement;
  content: React.ReactElement;
}

export const gettingStartedSection: ManualSection = {
  id: "getting-started",
  title: "Getting Started",
  icon: <CheckCircleIcon />,
  content: (
    <Box>
      <Typography variant="h6" gutterBottom className="manual-heading">
        Welcome to SheetPilot
      </Typography>
      <Typography variant="body1" paragraph className="manual-body-text">
        SheetPilot is a comprehensive timesheet management application designed
        to streamline your workflow and simplify the process of tracking and
        submitting time entries to SmartSheet.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>First Time Setup</AlertTitle>
        Before you can use SheetPilot, you&apos;ll need to add your SmartSheet
        credentials. Navigate to the Home tab and click &quot;Add
        Credentials&quot; to get started.
      </Alert>

      <Typography
        variant="h6"
        gutterBottom
        className="manual-heading manual-spacing-top"
      >
        Quick Start Guide
      </Typography>
      <Stepper orientation="vertical" activeStep={-1} sx={{ mt: 2 }}>
        <Step>
          <StepLabel>Add Your Credentials</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Store your SmartSheet email and password securely in the
              application. Your credentials are encrypted and stored locally on
              your device.
            </Typography>
          </StepContent>
        </Step>
        <Step>
          <StepLabel>View Your Timesheet</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Navigate to the Timesheet tab to see your current entries, add new
              time entries, and manage your weekly timesheet.
            </Typography>
          </StepContent>
        </Step>
        <Step>
          <StepLabel>Submit to SmartSheet</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Use the &quot;Submit Timesheet&quot; button to automatically send
              your entries to SmartSheet. The application will validate your
              data before submission.
            </Typography>
          </StepContent>
        </Step>
        <Step>
          <StepLabel>Review Your Archive</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Check the Archive tab to view all your previously submitted
              timesheet entries and track your submission history.
            </Typography>
          </StepContent>
        </Step>
      </Stepper>
    </Box>
  ),
};

export const featuresSection: ManualSection = {
  id: "features",
  title: "Features Overview",
  icon: <CheckCircleIcon />,
  content: (
    <Box>
      <Typography variant="h6" gutterBottom className="manual-heading">
        Core Features
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
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <SecurityIcon className="manual-icon-spacing manual-icon-primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Secure Credential Storage
            </Typography>
          </Box>
          <Typography variant="body2" className="manual-body-text">
            Your SmartSheet credentials are encrypted and stored securely on
            your local device. No credentials are transmitted to external
            servers.
          </Typography>
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <AssignmentIcon className="manual-icon-spacing manual-icon-tertiary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Timesheet Management
            </Typography>
          </Box>
          <Typography variant="body2" className="manual-body-text">
            Create, edit, and manage your timesheet entries with an intuitive
            grid interface. Real-time validation ensures data accuracy.
          </Typography>
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <CloudUploadIcon className="manual-icon-spacing manual-icon-secondary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              SmartSheet Integration
            </Typography>
          </Box>
          <Typography variant="body2" className="manual-body-text">
            Seamlessly submit your timesheet entries directly to SmartSheet with
            automatic validation and error handling.
          </Typography>
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <ArchiveIcon className="manual-icon-spacing manual-icon-secondary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Submission Archive
            </Typography>
          </Box>
          <Typography variant="body2" className="manual-body-text">
            Keep track of all your submitted entries with a comprehensive
            archive that shows submission history and status.
          </Typography>
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <SpeedIcon className="manual-icon-spacing manual-icon-error" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Performance Optimized
            </Typography>
          </Box>
          <Typography variant="body2" className="manual-body-text">
            Built with performance in mind, SheetPilot provides fast, responsive
            interactions and efficient data processing.
          </Typography>
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <StorageIcon className="manual-icon-spacing manual-icon-secondary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Local Data Storage
            </Typography>
          </Box>
          <Typography variant="body2" className="manual-body-text">
            All your data is stored locally using SQLite database, ensuring
            privacy and allowing offline access to your timesheet entries.
          </Typography>
        </Card>
      </Box>

      <Typography
        variant="h6"
        gutterBottom
        className="manual-heading manual-spacing-top"
      >
        Advanced Features
      </Typography>
      <List>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Automatic Data Validation"
            secondary="Real-time validation ensures all timesheet entries meet SmartSheet requirements before submission"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Batch Submission"
            secondary="Submit multiple timesheet entries simultaneously with progress tracking and error reporting"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Error Recovery"
            secondary="Automatic retry mechanisms and detailed error messages help resolve submission issues"
          />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Export Capabilities"
            secondary="Export your timesheet data to CSV format for backup or external analysis (coming soon)"
          />
        </ListItem>
      </List>
    </Box>
  ),
};
