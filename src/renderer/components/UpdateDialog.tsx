import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  LinearProgress,
  Box,
  CircularProgress
} from '@mui/material';
import './UpdateDialog.css';

interface UpdateDialogProps {
  open: boolean;
  version?: string;
  progress?: number;
  status: 'downloading' | 'installing';
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ open, version, progress, status }) => {
  return (
    <Dialog 
      open={open} 
      disableEscapeKeyDown
      onClose={(event, reason) => {
        // Prevent closing dialog
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          event.preventDefault();
        }
      }}
      maxWidth="sm"
      fullWidth
      disableBackdropClick
      PaperProps={{
        style: {
          pointerEvents: 'auto'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          {status === 'downloading' && (
            <CircularProgress size={24} />
          )}
          {status === 'installing' && (
            <CircularProgress size={24} />
          )}
          <Typography variant="h6">
            {status === 'downloading' ? 'Downloading Update' : 'Installing Update'}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {version && (
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Updating to version {version}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {status === 'downloading' 
              ? 'Please wait while the update is downloaded. Do not close this window.'
              : 'The update is being installed. The application will restart shortly.'}
          </Typography>
          
          {status === 'downloading' && progress !== undefined && (
            <>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary" align="center" display="block">
                {progress.toFixed(1)}%
              </Typography>
            </>
          )}
          
          {status === 'installing' && (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ my: 2 }}>
              <CircularProgress size={40} />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary">
          {status === 'downloading' ? 'Download in progress...' : 'Installing update...'}
        </Typography>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateDialog;

