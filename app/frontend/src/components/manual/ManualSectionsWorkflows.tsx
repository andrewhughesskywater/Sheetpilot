import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Paper from "@mui/material/Paper";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import StepContent from "@mui/material/StepContent";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AssignmentIcon from "@mui/icons-material/Assignment";
import type { ManualSection } from "./ManualSectionsGettingStartedAndFeatures";

export const workflowsSection: ManualSection = {
  id: "workflows",
  title: "Workflows & Best Practices",
  icon: <AssignmentIcon />,
  content: (
    <Box>
      <Typography variant="h6" gutterBottom className="manual-heading">
        Daily Workflow
      </Typography>
      <Typography variant="body1" paragraph className="manual-body-text">
        Follow these steps for efficient timesheet management:
      </Typography>

      <Stepper orientation="vertical" activeStep={-1} sx={{ mt: 2 }}>
        <Step>
          <StepLabel>Start Your Day</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Open SheetPilot and navigate to the Timesheet tab. Review any
              existing entries from previous days to ensure accuracy.
            </Typography>
          </StepContent>
        </Step>
        <Step>
          <StepLabel>Log Your Time</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Add new time entries as you complete tasks throughout the day.
              Include project codes, descriptions, and accurate time durations.
            </Typography>
          </StepContent>
        </Step>
        <Step>
          <StepLabel>Review Before Submission</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Before submitting, review all entries for the week to ensure
              they&apos;re complete and accurate. Check for any missing project
              codes or descriptions.
            </Typography>
          </StepContent>
        </Step>
        <Step>
          <StepLabel>Submit Weekly</StepLabel>
          <StepContent>
            <Typography variant="body2" className="manual-body-text">
              Submit your timesheet at the end of each week or as required by
              your organization. The application will validate all entries
              before submission.
            </Typography>
          </StepContent>
        </Step>
      </Stepper>

      <Alert severity="warning" sx={{ mt: 3, mb: 3 }}>
        <AlertTitle>Best Practices</AlertTitle>
        <List dense>
          <ListItem sx={{ py: 0 }}>
            <ListItemText
              primary="Log time entries daily to avoid forgetting tasks"
              sx={{ "& .MuiListItemText-primary": { fontSize: "0.875rem" } }}
            />
          </ListItem>
          <ListItem sx={{ py: 0 }}>
            <ListItemText
              primary="Use descriptive project names and task descriptions"
              sx={{ "& .MuiListItemText-primary": { fontSize: "0.875rem" } }}
            />
          </ListItem>
          <ListItem sx={{ py: 0 }}>
            <ListItemText
              primary="Review and submit timesheets weekly for better accuracy"
              sx={{ "& .MuiListItemText-primary": { fontSize: "0.875rem" } }}
            />
          </ListItem>
          <ListItem sx={{ py: 0 }}>
            <ListItemText
              primary="Keep your credentials up to date if your password changes"
              sx={{ "& .MuiListItemText-primary": { fontSize: "0.875rem" } }}
            />
          </ListItem>
        </List>
      </Alert>

      <Typography
        variant="h6"
        gutterBottom
        className="manual-heading manual-spacing-top"
      >
        Weekly Submission Process
      </Typography>
      <Paper className="manual-feature-card">
        <Typography
          variant="body1"
          className="manual-body-text manual-spacing-bottom"
        >
          When you&apos;re ready to submit your weekly timesheet:
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Navigate to the Timesheet tab"
              secondary="Review all entries for the current week"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Click 'Submit Timesheet'"
              secondary="The application will validate all entries before submission"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Monitor the submission process"
              secondary="Watch the status messages for progress and any errors"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Verify successful submission"
              secondary="Check the Archive tab to confirm your entries were submitted"
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  ),
};
