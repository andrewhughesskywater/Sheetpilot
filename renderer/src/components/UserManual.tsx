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
          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
            Welcome to SheetPilot
          </Typography>
          <Typography variant="body1" paragraph sx={{ color: '#6B7280' }}>
            SheetPilot is a comprehensive timesheet management application designed to streamline your workflow 
            and simplify the process of tracking and submitting time entries to SmartSheet.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>First Time Setup</AlertTitle>
            Before you can use SheetPilot, you'll need to add your SmartSheet credentials. 
            Navigate to the Home tab and click "Add Credentials" to get started.
          </Alert>

          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600, mt: 3 }}>
            Quick Start Guide
          </Typography>
          <Stepper orientation="vertical" activeStep={-1} sx={{ mt: 2 }}>
            <Step>
              <StepLabel>Add Your Credentials</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Store your SmartSheet email and password securely in the application. 
                  Your credentials are encrypted and stored locally on your device.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>View Your Timesheet</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Navigate to the Timesheet tab to see your current entries, add new time entries, 
                  and manage your weekly timesheet.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Submit to SmartSheet</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Use the "Submit Timesheet" button to automatically send your entries to SmartSheet. 
                  The application will validate your data before submission.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Review Your Archive</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
            Core Features
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SecurityIcon sx={{ mr: 1, color: '#4F8EF7' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Secure Credential Storage</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Your SmartSheet credentials are encrypted and stored securely on your local device. 
                No credentials are transmitted to external servers.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AssignmentIcon sx={{ mr: 1, color: '#34D399' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Timesheet Management</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Create, edit, and manage your timesheet entries with an intuitive grid interface. 
                Real-time validation ensures data accuracy.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CloudUploadIcon sx={{ mr: 1, color: '#A78BFA' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>SmartSheet Integration</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Seamlessly submit your timesheet entries directly to SmartSheet with automatic 
                validation and error handling.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ArchiveIcon sx={{ mr: 1, color: '#F59E0B' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Submission Archive</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Keep track of all your submitted entries with a comprehensive archive that 
                shows submission history and status.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SpeedIcon sx={{ mr: 1, color: '#EF4444' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Performance Optimized</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Built with performance in mind, SheetPilot provides fast, responsive 
                interactions and efficient data processing.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <StorageIcon sx={{ mr: 1, color: '#8B5CF6' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Local Data Storage</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                All your data is stored locally using SQLite database, ensuring privacy 
                and allowing offline access to your timesheet entries.
              </Typography>
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600, mt: 3 }}>
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
          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
            Daily Workflow
          </Typography>
          <Typography variant="body1" paragraph sx={{ color: '#6B7280' }}>
            Follow these steps for efficient timesheet management:
          </Typography>

          <Stepper orientation="vertical" activeStep={-1} sx={{ mt: 2 }}>
            <Step>
              <StepLabel>Start Your Day</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Open SheetPilot and navigate to the Timesheet tab. Review any existing entries 
                  from previous days to ensure accuracy.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Log Your Time</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Add new time entries as you complete tasks throughout the day. Include project codes, 
                  descriptions, and accurate time durations.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Review Before Submission</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Before submitting, review all entries for the week to ensure they're complete 
                  and accurate. Check for any missing project codes or descriptions.
                </Typography>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Submit Weekly</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
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

          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600, mt: 3 }}>
            Weekly Submission Process
          </Typography>
          <Paper sx={{ p: 3, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <Typography variant="body1" sx={{ color: '#6B7280', mb: 2 }}>
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
          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
            Common Issues and Solutions
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600, mt: 2 }}>
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
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
            <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
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
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
            <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
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
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
                      <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
            Data Security
          </Typography>
          <Typography variant="body1" paragraph sx={{ color: '#6B7280' }}>
            SheetPilot is designed with security and privacy as top priorities. Here's how we protect your data:
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
            <Card variant="outlined" sx={{ p: 2, backgroundColor: '#F0FDF4' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#166534', mb: 1 }}>
                Local Data Storage
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                All your timesheet data and credentials are stored locally on your device using 
                SQLite database. No data is transmitted to external servers except during SmartSheet submission.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2, backgroundColor: '#FEF3C7' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#92400E', mb: 1 }}>
                Encrypted Credentials
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                Your SmartSheet credentials are encrypted before being stored locally. 
                The encryption key is derived from your system and is not stored in the application.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2, backgroundColor: '#EEF2FF' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#3730A3', mb: 1 }}>
                Secure Communication
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                All communication with SmartSheet uses HTTPS encryption. Your credentials 
                are only transmitted during the authentication process.
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ p: 2, backgroundColor: '#FDF2F8' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#BE185D', mb: 1 }}>
                No Data Collection
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                SheetPilot does not collect, store, or transmit any usage data, analytics, 
                or personal information to external services.
              </Typography>
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600, mt: 3 }}>
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
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
            Getting Help
          </Typography>
          <Typography variant="body1" paragraph sx={{ color: '#6B7280' }}>
            If you need assistance with SheetPilot, here are the resources available to you:
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Documentation
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
                This user manual provides comprehensive information about all SheetPilot features and workflows.
              </Typography>
              <Chip label="Always Available" color="primary" size="small" />
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                System Administrator
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
                Your organization's system administrator can help with technical issues and account problems.
              </Typography>
              <Chip label="Internal Support" color="secondary" size="small" />
            </Card>

            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Application Logs
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
                Detailed error information is available in the application logs for troubleshooting.
              </Typography>
              <Chip label="Technical Details" color="info" size="small" />
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600, mt: 3 }}>
            Frequently Asked Questions
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
              Q: How often should I submit my timesheet?
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2, pl: 2 }}>
              A: Most organizations require weekly timesheet submissions. Check with your supervisor 
              or HR department for specific requirements.
            </Typography>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
              Q: Can I edit entries after they've been submitted?
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2, pl: 2 }}>
              A: Once entries are submitted to SmartSheet, you cannot edit them through SheetPilot. 
              You would need to make changes directly in SmartSheet or contact your administrator.
            </Typography>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
              Q: What happens if my internet connection is lost during submission?
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2, pl: 2 }}>
              A: SheetPilot will show an error message. Check your connection and try submitting again. 
              The application will only submit entries that haven't been successfully submitted yet.
            </Typography>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
              Q: Can I use SheetPilot on multiple devices?
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2, pl: 2 }}>
              A: SheetPilot stores data locally on each device. You'll need to add your credentials 
              and manage timesheet entries separately on each device.
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom sx={{ color: '#111827', fontWeight: 600 }}>
            Application Information
          </Typography>
          <Paper sx={{ p: 3, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                  Application Name
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  SheetPilot
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                  Database
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  SQLite (Local)
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                  Platform
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
                  Electron Desktop App
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                  Integration
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
      <Typography variant="h4" gutterBottom sx={{ color: '#111827', fontWeight: 600, mb: 3 }}>
        SheetPilot User Manual
      </Typography>
      
      {manualSections.map((section) => (
        <Accordion
          key={section.id}
          expanded={expandedSection === section.id}
          onChange={handleChange(section.id)}
          sx={{
            mb: 2,
            '&:before': {
              display: 'none',
            },
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            border: '1px solid #E5E7EB',
            borderRadius: '8px !important',
            '&.Mui-expanded': {
              margin: '0 0 16px 0',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: expandedSection === section.id ? '#F3F4F6' : 'transparent',
              borderRadius: expandedSection === section.id ? '8px 8px 0 0' : '8px',
              '&.Mui-expanded': {
                minHeight: '48px',
              },
              '& .MuiAccordionSummary-content': {
                margin: '12px 0',
                '&.Mui-expanded': {
                  margin: '12px 0',
                },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {section.icon}
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
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
