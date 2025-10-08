import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  AlertTitle,
  Divider,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  CloudUpload as CloudUploadIcon,
  Assignment as AssignmentIcon,
  Archive as ArchiveIcon,
  VpnKey as VpnKeyIcon,
  BugReport as BugReportIcon,
  ContactSupport as ContactSupportIcon
} from '@mui/icons-material';
import './UserManual.css';

interface UserManualProps {
  // Add any props if needed in the future
}

export default function UserManual({}: UserManualProps) {
  const [expandedSection, setExpandedSection] = useState<string | false>('getting-started');

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  const manualSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <InfoIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom className="manual-heading">
            Welcome to SheetPilot
          </Typography>
          <Typography variant="body1" paragraph className="manual-body-text">
            SheetPilot is a comprehensive timesheet management application designed to streamline your workflow 
            and simplify the process of tracking and submitting time entries to SmartSheet.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>First Time Setup</AlertTitle>
            Before you can use SheetPilot, you'll need to add your SmartSheet credentials. 
            Navigate to the Home tab and click "Add Credentials" to get started.
          </Alert>

          <Typography variant="h6" gutterBottom className="manual-heading manual-spacing-top">
            Quick Start Guide
          </Typography>
          <Stepper orientation="vertical" activeStep={-1} sx={{ mt: 2 }}>
            <Step>
              <StepLabel>Add Your Credentials</StepLabel>
              <StepContent>
                <Typography variant="body2" className="manual-body-text">
                  Store your SmartSheet email and password securely in the application. 
                  Your credentials are encrypted and stored locally on your device.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>View Your Timesheet</StepLabel>
              <StepContent>
                <Typography variant="body2" className="manual-body-text">
                  Navigate to the Timesheet tab to see your current entries, add new time entries, 
                  and manage your weekly timesheet.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Submit to SmartSheet</StepLabel>
              <StepContent>
                <Typography variant="body2" className="manual-body-text">
                  Use the "Submit Timesheet" button to automatically send your entries to SmartSheet. 
                  The application will validate your data before submission.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Review Your Archive</StepLabel>
              <StepContent>
                <Typography variant="body2" className="manual-body-text">
                  Check the Archive tab to view all your previously submitted timesheet entries 
                  and track your submission history.
                </Typography>
              </StepContent>
            </Step>
          </Stepper>
        </Box>
      )
    },
    {
      id: 'features',
      title: 'Features Overview',
      icon: <CheckCircleIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom className="manual-heading">
            Core Features
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SecurityIcon className="manual-icon-spacing manual-icon-primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Secure Credential Storage</Typography>
              </Box>
              <Typography variant="body2" className="manual-body-text">
                Your SmartSheet credentials are encrypted and stored securely on your local device. 
                No credentials are transmitted to external servers.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AssignmentIcon className="manual-icon-spacing manual-icon-tertiary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Timesheet Management</Typography>
              </Box>
              <Typography variant="body2" className="manual-body-text">
                Create, edit, and manage your timesheet entries with an intuitive grid interface. 
                Real-time validation ensures data accuracy.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CloudUploadIcon className="manual-icon-spacing manual-icon-secondary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>SmartSheet Integration</Typography>
              </Box>
              <Typography variant="body2" className="manual-body-text">
                Seamlessly submit your timesheet entries directly to SmartSheet with automatic 
                validation and error handling.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ArchiveIcon className="manual-icon-spacing manual-icon-secondary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Submission Archive</Typography>
              </Box>
              <Typography variant="body2" className="manual-body-text">
                Keep track of all your submitted entries with a comprehensive archive that 
                shows submission history and status.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SpeedIcon className="manual-icon-spacing manual-icon-error" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Performance Optimized</Typography>
              </Box>
              <Typography variant="body2" className="manual-body-text">
                Built with performance in mind, SheetPilot provides fast, responsive 
                interactions and efficient data processing.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <StorageIcon className="manual-icon-spacing manual-icon-secondary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Local Data Storage</Typography>
              </Box>
              <Typography variant="body2" className="manual-body-text">
                All your data is stored locally using SQLite database, ensuring privacy 
                and allowing offline access to your timesheet entries.
              </Typography>
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom className="manual-heading manual-spacing-top">
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
      )
    },
    {
      id: 'workflows',
      title: 'Workflows & Best Practices',
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
                  Open SheetPilot and navigate to the Timesheet tab. Review any existing entries 
                  from previous days to ensure accuracy.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Log Your Time</StepLabel>
              <StepContent>
                <Typography variant="body2" className="manual-body-text">
                  Add new time entries as you complete tasks throughout the day. Include project codes, 
                  descriptions, and accurate time durations.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Review Before Submission</StepLabel>
              <StepContent>
                <Typography variant="body2" className="manual-body-text">
                  Before submitting, review all entries for the week to ensure they're complete 
                  and accurate. Check for any missing project codes or descriptions.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Submit Weekly</StepLabel>
              <StepContent>
                <Typography variant="body2" className="manual-body-text">
                  Submit your timesheet at the end of each week or as required by your organization. 
                  The application will validate all entries before submission.
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
                  sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText 
                  primary="Use descriptive project names and task descriptions"
                  sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText 
                  primary="Review and submit timesheets weekly for better accuracy"
                  sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemText 
                  primary="Keep your credentials up to date if your password changes"
                  sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                />
              </ListItem>
            </List>
          </Alert>

          <Typography variant="h6" gutterBottom className="manual-heading manual-spacing-top">
            Weekly Submission Process
          </Typography>
          <Paper className="manual-feature-card">
            <Typography variant="body1" className="manual-body-text manual-spacing-bottom">
              When you're ready to submit your weekly timesheet:
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
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: <BugReportIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom className="manual-heading">
            Common Issues and Solutions
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom className="manual-heading manual-spacing-bottom">
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
                    <Box>
                      <Typography variant="body2" className="manual-body-text">
                        <strong>Solution:</strong> Verify your SmartSheet email and password are correct. 
                        If you recently changed your password, update your stored credentials in the Home tab.
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <WarningIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary="Connection timeout"
                  secondary={
                    <Box>
                      <Typography variant="body2" className="manual-body-text">
                        <strong>Solution:</strong> Check your internet connection and ensure SmartSheet is accessible. 
                        Try again in a few minutes if the issue persists.
                      </Typography>
                    </Box>
                  }
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
                    <Box>
                      <Typography variant="body2" className="manual-body-text">
                        <strong>Solution:</strong> Check the error messages in the status area. Common causes include 
                        missing project codes, invalid time formats, or duplicate entries. Fix the issues and try again.
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <WarningIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary="No entries to submit"
                  secondary={
                    <Box>
                      <Typography variant="body2" className="manual-body-text">
                        <strong>Solution:</strong> Ensure you have timesheet entries for the current week. 
                        Check that entries are not already submitted (they won't appear in the submission queue).
                      </Typography>
                    </Box>
                  }
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
                    <Box>
                      <Typography variant="body2" className="manual-body-text">
                        <strong>Solution:</strong> Restart your computer and try again. If the issue persists, 
                        contact your system administrator for assistance.
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <WarningIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary="Data not loading"
                  secondary={
                    <Box>
                      <Typography variant="body2" className="manual-body-text">
                        <strong>Solution:</strong> Check if the database file is accessible and not corrupted. 
                        The application stores data locally in a SQLite database file.
                      </Typography>
                    </Box>
                  }
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
                  sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemIcon>
                  <InfoIcon color="info" />
                </ListItemIcon>
                <ListItemText 
                  primary="Check the application logs for detailed error information"
                  sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                />
              </ListItem>
              <ListItem sx={{ py: 0 }}>
                <ListItemIcon>
                  <VpnKeyIcon color="info" />
                </ListItemIcon>
                <ListItemText 
                  primary="Verify your SmartSheet account has the necessary permissions"
                  sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                />
              </ListItem>
            </List>
          </Alert>
        </Box>
      )
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      icon: <SecurityIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom className="manual-heading">
            Data Security
          </Typography>
          <Typography variant="body1" paragraph className="manual-body-text">
            SheetPilot is designed with security and privacy as top priorities. Here's how we protect your data:
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
            <Card variant="outlined" className="manual-card-success">
              <Typography variant="h6" className="manual-card-success-heading">
                Local Data Storage
              </Typography>
              <Typography variant="body2" className="manual-body-text">
                All your timesheet data and credentials are stored locally on your device using 
                SQLite database. No data is transmitted to external servers except during SmartSheet submission.
              </Typography>
            </Card>

            <Card variant="outlined" className="manual-card-warning">
              <Typography variant="h6" className="manual-card-warning-heading">
                Encrypted Credentials
              </Typography>
              <Typography variant="body2" className="manual-body-text">
                Your SmartSheet credentials are encrypted before being stored locally. 
                The encryption key is derived from your system and is not stored in the application.
              </Typography>
            </Card>

            <Card variant="outlined" className="manual-card-info">
              <Typography variant="h6" className="manual-card-info-heading">
                Secure Communication
              </Typography>
              <Typography variant="body2" className="manual-body-text">
                All communication with SmartSheet uses HTTPS encryption. Your credentials 
                are only transmitted during the authentication process.
              </Typography>
            </Card>

            <Card variant="outlined" className="manual-card-secondary">
              <Typography variant="h6" className="manual-card-secondary-heading">
                No Data Collection
              </Typography>
              <Typography variant="body2" className="manual-body-text">
                SheetPilot does not collect, store, or transmit any usage data, analytics, 
                or personal information to external services.
              </Typography>
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom className="manual-heading manual-spacing-top">
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
              • Never share your SmartSheet credentials with others<br/>
              • Keep your device's operating system and security software up to date<br/>
              • Be cautious when using SheetPilot on shared or public computers<br/>
              • Report any suspicious activity or security concerns to your system administrator
            </Typography>
          </Alert>
        </Box>
      )
    },
    {
      id: 'support',
      title: 'Support & Resources',
      icon: <ContactSupportIcon />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom className="manual-heading">
            Getting Help
          </Typography>
          <Typography variant="body1" paragraph className="manual-body-text">
            If you need assistance with SheetPilot, here are the resources available to you:
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Documentation
              </Typography>
              <Typography variant="body2" className="manual-body-text manual-spacing-bottom">
                This user manual provides comprehensive information about all SheetPilot features and workflows.
              </Typography>
              <Chip label="Always Available" color="primary" size="small" />
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                System Administrator
              </Typography>
              <Typography variant="body2" className="manual-body-text manual-spacing-bottom">
                Your organization's system administrator can help with technical issues and account problems.
              </Typography>
              <Chip label="Internal Support" color="secondary" size="small" />
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Application Logs
              </Typography>
              <Typography variant="body2" className="manual-body-text manual-spacing-bottom">
                Detailed error information is available in the application logs for troubleshooting.
              </Typography>
              <Chip label="Technical Details" color="info" size="small" />
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom className="manual-heading manual-spacing-top">
            Frequently Asked Questions
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" className="manual-heading manual-spacing-bottom-small">
              Q: How often should I submit my timesheet?
            </Typography>
            <Typography variant="body2" className="manual-body-text manual-spacing-bottom manual-padding-left">
              A: Most organizations require weekly timesheet submissions. Check with your supervisor 
              or HR department for specific requirements.
            </Typography>

            <Typography variant="subtitle1" className="manual-heading manual-spacing-bottom-small">
              Q: Can I edit entries after they've been submitted?
            </Typography>
            <Typography variant="body2" className="manual-body-text manual-spacing-bottom manual-padding-left">
              A: Once entries are submitted to SmartSheet, you cannot edit them through SheetPilot. 
              You would need to make changes directly in SmartSheet or contact your administrator.
            </Typography>

            <Typography variant="subtitle1" className="manual-heading manual-spacing-bottom-small">
              Q: What happens if my internet connection is lost during submission?
            </Typography>
            <Typography variant="body2" className="manual-body-text manual-spacing-bottom manual-padding-left">
              A: SheetPilot will show an error message. Check your connection and try submitting again. 
              The application will only submit entries that haven't been successfully submitted yet.
            </Typography>

            <Typography variant="subtitle1" className="manual-heading manual-spacing-bottom-small">
              Q: Can I use SheetPilot on multiple devices?
            </Typography>
            <Typography variant="body2" className="manual-body-text manual-spacing-bottom manual-padding-left">
              A: SheetPilot stores data locally on each device. You'll need to add your credentials 
              and manage timesheet entries separately on each device.
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom className="manual-heading">
            Application Information
          </Typography>
          <Paper className="manual-feature-card">
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
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
      )
    }
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Typography variant="h4" gutterBottom className="manual-heading manual-spacing-top">
        SheetPilot User Manual
      </Typography>
      
      {manualSections.map((section) => (
        <Accordion
          key={section.id}
          expanded={expandedSection === section.id}
          onChange={handleChange(section.id)}
          className="manual-accordion"
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            className="manual-accordion-summary"
            sx={{
              backgroundColor: expandedSection === section.id ? 'var(--md-sys-color-surface-container)' : 'transparent',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {section.icon}
              <Typography variant="h6" className="manual-heading">
                {section.title}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 3, pb: 3 }}>
            {section.content}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
