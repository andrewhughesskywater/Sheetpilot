/**
 * @fileoverview Login Dialog Component
 * 
 * Non-modal authentication card for SmartSheet credential entry.
 * Adapts UI based on first-time vs returning user state.
 * Uses Card instead of Dialog to avoid aria-hidden issues with Navigation.
 * 
 * Features:
 * - Auto-completion for company email domain
 * - "Stay logged in" option for session persistence
 * - Automatic first-time user detection
 * - Enter key submission support
 * - Error handling with user-friendly messages
 */

import React, { useState, useEffect, useRef } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import './LoginDialog.css';
import { autoCompleteEmailDomain } from '../utils/emailAutoComplete';

interface LoginDialogProps {
  open: boolean;
  onLoginSuccess: (token: string, email: string, isAdmin: boolean) => void;
}

/**
 * Login card component for SmartSheet authentication
 * 
 * Presents a centered login card that adapts UI based on whether credentials exist.
 * First-time users see "Create Account" messaging, returning users see "Login".
 * Uses Card instead of Dialog to avoid Modal's aria-hidden behavior.
 * 
 * Features:
 * - Auto-detection of first-time vs returning user
 * - Email domain auto-completion (@skywatertechnology.com)
 * - "Stay logged in" checkbox for 30-day session persistence
 * - Enter key submission support
 * - Error display with dismissible alerts
 * - Loading state during authentication
 * 
 * @param props - Component props
 * @param props.open - Whether card is visible
 * @param props.onLoginSuccess - Callback fired on successful login with token and user info
 * @returns Login card component
 */
function LoginDialog({ open, onLoginSuccess }: LoginDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Check if this is a first-time user (no credentials exist) and focus email field
  useEffect(() => {
    if (open) {
      checkFirstTime();
      // Ensure email field gets focus after render
      const focusTimer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimer);
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

  if (!open) {
    return null;
  }

  return (
    <Box className="login-dialog-container">
      <Card className="login-dialog-paper" sx={{ maxWidth: 'sm', width: '100%' }}>
        <CardContent>
          <Typography variant="h5" className="login-dialog-title" sx={{ mb: 2 }}>
            {isFirstTime ? 'Create Account' : 'Login to SheetPilot'}
          </Typography>
          
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
            inputRef={emailInputRef}
            inputProps={{ tabIndex: 0 }}
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
            inputProps={{ tabIndex: 0 }}
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
        </CardContent>
        <CardActions className="login-dialog-actions">
          <Button
            onClick={handleLogin}
            variant="contained"
            disabled={!email || !password || isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
            className="login-submit-button"
          >
            {isLoading ? 'Logging in...' : isFirstTime ? 'Create Account' : 'Login'}
          </Button>
        </CardActions>
      </Card>
    </Box>
  );
}

export default LoginDialog;

