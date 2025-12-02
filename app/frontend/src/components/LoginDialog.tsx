import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import './LoginDialog.css';
import { autoCompleteEmailDomain } from '../../utils/emailAutoComplete';

interface LoginDialogProps {
  open: boolean;
  onLoginSuccess: (token: string, email: string, isAdmin: boolean) => void;
}

function LoginDialog({ open, onLoginSuccess }: LoginDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Check if this is a first-time user (no credentials exist)
  useEffect(() => {
    if (open) {
      checkFirstTime();
    }
  }, [open]);

  const checkFirstTime = async () => {
    try {
      if (window.credentials?.list) {
        const response = await window.credentials.list();
        setIsFirstTime(!response.success || !response.credentials || response.credentials.length === 0);
      }
    } catch (err) {
      window.logger?.error('Could not check credentials', { error: err });
      setIsFirstTime(true);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (!window.auth?.login) {
      setError('Authentication API not available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      window.logger?.userAction('login-attempt', { email });
      const result = await window.auth.login(email, password, stayLoggedIn);

      if (result.success && result.token) {
        window.logger?.info('Login successful', { email, isAdmin: result.isAdmin });
        onLoginSuccess(result.token, email, result.isAdmin || false);
        // Reset form
        setEmail('');
        setPassword('');
        setStayLoggedIn(true);
        setError('');
      } else {
        const errorMsg = result.error || 'Login failed. Please check your credentials.';
        setError(errorMsg);
        window.logger?.error('Could not login', { error: errorMsg });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      window.logger?.error('Login error', { error: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const completedValue = autoCompleteEmailDomain(value);
    setEmail(completedValue);
    setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin();
    }
  };

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      disableRestoreFocus
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'login-dialog-paper'
      }}
    >
      <DialogTitle className="login-dialog-title">
        {isFirstTime ? 'Create Account' : 'Login to SheetPilot'}
      </DialogTitle>
      <DialogContent className="login-dialog-content">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {isFirstTime
            ? 'Enter your SmartSheet credentials to get started. These will be securely stored on your device.'
            : 'Enter your SmartSheet credentials to continue.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          onKeyPress={handleKeyPress}
          placeholder="your.email@skywatertechnology.com"
          margin="normal"
          variant="outlined"
          disabled={isLoading}
          autoFocus
          className="login-email-field"
        />
        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          onKeyPress={handleKeyPress}
          placeholder="Your password"
          margin="normal"
          variant="outlined"
          disabled={isLoading}
          className="login-password-field"
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              disabled={isLoading}
            />
          }
          label="Stay logged in for 30 days"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions className="login-dialog-actions">
        <Button
          onClick={handleLogin}
          variant="contained"
          disabled={!email || !password || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
          className="login-submit-button"
        >
          {isLoading ? 'Logging in...' : isFirstTime ? 'Create Account' : 'Login'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginDialog;

