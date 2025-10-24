import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import './Help.css';

interface LogEntry {
  lineNumber: number;
  timestamp?: string;
  level?: string;
  message?: string;
  component?: string;
  sessionId?: string;
  username?: string;
  application?: string;
  version?: string;
  environment?: string;
  process?: {
    pid: number;
    platform: string;
    nodeVersion: string;
  };
  data?: unknown;
  raw?: string;
}

const Help: React.FC = () => {
  const [logPath, setLogPath] = useState<string>('');
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedLogFile, setSelectedLogFile] = useState<string>('');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [selectedLogEntry, setSelectedLogEntry] = useState<LogEntry | null>(null);

  // Load log files on component mount
  useEffect(() => {
    loadLogFiles();
  }, []);

  const loadLogFiles = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await window.logs.getLogPath();
      if (response.success) {
        setLogPath(response.logPath || '');
        setLogFiles(response.logFiles || []);
        if (response.logFiles && response.logFiles.length > 0) {
          setSelectedLogFile(response.logFiles[response.logFiles.length - 1]); // Select latest
        }
      } else {
        setError(response.error || 'Failed to load log files');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!selectedLogFile) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const fullLogPath = logPath.replace(/[^\\]*$/, selectedLogFile);
      const response = await window.logs.readLogFile(fullLogPath);
      
      if (response.success) {
        setLogs(response.logs || []);
      } else {
        setError(response.error || 'Failed to load logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const exportLogs = async (format: 'json' | 'txt') => {
    if (!selectedLogFile) return;
    
    setIsExporting(true);
    
    try {
      const fullLogPath = logPath.replace(/[^\\]*$/, selectedLogFile);
      const response = await window.logs.exportLogs(fullLogPath, format);
      
      if (response.success && response.content && response.filename) {
        // Create and download file
        const blob = new Blob([response.content], { type: response.mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(response.error || 'Failed to export logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExporting(false);
    }
  };

  const getLogLevelIcon = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warn': return <WarningIcon color="warning" />;
      case 'info': return <InfoIcon color="info" />;
      case 'debug': return <BugReportIcon color="action" />;
      default: return <CheckCircleIcon color="success" />;
    }
  };

  const getLogLevelColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'error';
      case 'warn': return 'warning';
      case 'info': return 'info';
      case 'debug': return 'default';
      default: return 'success';
    }
  };

  const filteredLogs = logs.filter(log => 
    logLevelFilter === 'all' || log.level?.toLowerCase() === logLevelFilter.toLowerCase()
  );

  // Load logs when selected log file changes
  useEffect(() => {
    if (selectedLogFile) {
      loadLogs();
    }
  }, [selectedLogFile]);

  return (
    <div className="help-container">
      <Box className="help-header">
        <Typography variant="h4" component="h1" className="help-title">
          Help & Support
        </Typography>
        <Typography variant="body1" color="text.secondary" className="help-subtitle">
          View application logs, troubleshoot issues, and get support
        </Typography>
      </Box>

      {/* Log Management Section */}
      <Card className="log-management-card">
        <CardContent>
          <Box className="log-management-header">
            <Typography variant="h6" component="h2">
              Application Logs
            </Typography>
            <Box className="log-management-actions">
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadLogFiles}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box className="log-controls">
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Log File</InputLabel>
              <Select
                value={selectedLogFile}
                onChange={(e) => setSelectedLogFile(e.target.value)}
                label="Log File"
              >
                {logFiles.map((file) => (
                  <MenuItem key={file} value={file}>
                    {file}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Log Level Filter</InputLabel>
              <Select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value)}
                label="Log Level Filter"
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
              </Select>
            </FormControl>

            <Box className="log-export-actions">
              <Button
                variant="contained"
                startIcon={isExporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => exportLogs('txt')}
                disabled={isExporting || !selectedLogFile}
                sx={{ mr: 1 }}
              >
                Export TXT
              </Button>
              <Button
                variant="outlined"
                startIcon={isExporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                onClick={() => exportLogs('json')}
                disabled={isExporting || !selectedLogFile}
              >
                Export JSON
              </Button>
            </Box>
          </Box>

          {/* Log Entries */}
          {isLoading ? (
            <Box className="log-loading">
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Loading logs...
              </Typography>
            </Box>
          ) : (
            <Box className="log-entries">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {filteredLogs.length} log entries (filtered from {logs.length} total)
              </Typography>
              
              <List className="log-list">
                {filteredLogs.slice(-50).reverse().map((log) => (
                  <ListItem
                    key={log.lineNumber}
                    className="log-entry"
                    onClick={() => {
                      setSelectedLogEntry(log);
                      setShowLogDialog(true);
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <Box className="log-entry-icon">
                      {getLogLevelIcon(log.level)}
                    </Box>
                    <ListItemText
                      primary={
                        <Box className="log-entry-header">
                          <Chip
                            label={log.level || 'unknown'}
                            size="small"
                            color={getLogLevelColor(log.level) as any}
                            sx={{ mr: 1 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'No timestamp'}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" className="log-entry-message">
                          {log.message || log.raw || 'No message'}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="View Details">
                        <IconButton edge="end" size="small">
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Support Information */}
      <Card className="support-card">
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>
            Support Information
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            If you encounter issues with Sheetpilot:
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="1. Check the application logs above for error details"
                secondary="Look for entries with 'error' or 'warn' levels"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Export logs and share with support"
                secondary="Use the export buttons above to save logs in TXT or JSON format"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Contact your IT administrator"
                secondary="For enterprise antivirus issues, see the Sophos Configuration Guide"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog
        open={showLogDialog}
        onClose={() => setShowLogDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Log Entry Details
        </DialogTitle>
        <DialogContent>
          {selectedLogEntry && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Entry #{selectedLogEntry.lineNumber}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box className="log-detail-grid">
                <Box className="log-detail-item">
                  <Typography variant="subtitle2" color="text.secondary">
                    Timestamp
                  </Typography>
                  <Typography variant="body2">
                    {selectedLogEntry.timestamp ? new Date(selectedLogEntry.timestamp).toLocaleString() : 'N/A'}
                  </Typography>
                </Box>
                
                <Box className="log-detail-item">
                  <Typography variant="subtitle2" color="text.secondary">
                    Level
                  </Typography>
                  <Chip
                    label={selectedLogEntry.level || 'unknown'}
                    color={getLogLevelColor(selectedLogEntry.level) as any}
                    size="small"
                  />
                </Box>
                
                <Box className="log-detail-item">
                  <Typography variant="subtitle2" color="text.secondary">
                    Component
                  </Typography>
                  <Typography variant="body2">
                    {selectedLogEntry.component || 'N/A'}
                  </Typography>
                </Box>
                
                <Box className="log-detail-item">
                  <Typography variant="subtitle2" color="text.secondary">
                    Session ID
                  </Typography>
                  <Typography variant="body2" className="log-detail-value">
                    {selectedLogEntry.sessionId || 'N/A'}
                  </Typography>
                </Box>
                
                <Box className="log-detail-item">
                  <Typography variant="subtitle2" color="text.secondary">
                    Username
                  </Typography>
                  <Typography variant="body2">
                    {selectedLogEntry.username || 'N/A'}
                  </Typography>
                </Box>
                
                <Box className="log-detail-item">
                  <Typography variant="subtitle2" color="text.secondary">
                    Version
                  </Typography>
                  <Typography variant="body2">
                    {selectedLogEntry.version || 'N/A'}
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box className="log-detail-item">
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Message
                </Typography>
                <Typography variant="body2" className="log-detail-message">
                  {selectedLogEntry.message || selectedLogEntry.raw || 'No message'}
                </Typography>
              </Box>
              
              {selectedLogEntry.data !== undefined && selectedLogEntry.data !== null && (
                <Box className="log-detail-item">
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Additional Data
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={JSON.stringify(selectedLogEntry.data, null, 2)}
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                    sx={{ fontFamily: 'monospace' }}
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLogDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default Help;
