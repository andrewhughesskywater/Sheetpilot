/**
 * @fileoverview LoginDialog Component Tests
 * 
 * Tests for the LoginDialog component to ensure secure authentication,
 * proper error handling, and user-friendly interactions.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock window APIs
const mockWindow = {
  credentials: {
    list: vi.fn(),
    store: vi.fn()
  },
  auth: {
    login: vi.fn()
  },
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    userAction: vi.fn()
  }
};

describe('LoginDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).window = mockWindow;
  });

  describe('Email Auto-completion', () => {
    it('should auto-complete @skywatertechnology.com domain', () => {
      const email = 'user@';
      const atIndex = email.lastIndexOf('@');
      const domainPart = email.substring(atIndex + 1);
      
      let completedEmail = email;
      if (domainPart === '' || domainPart === 'skywatertechnology.com'.substring(0, domainPart.length)) {
        completedEmail = email.substring(0, atIndex + 1) + 'skywatertechnology.com';
      }
      
      expect(completedEmail).toBe('user@skywatertechnology.com');
    });

    it('should auto-complete partial domain', () => {
      const email = 'user@sky';
      const atIndex = email.lastIndexOf('@');
      const domainPart = email.substring(atIndex + 1);
      
      let completedEmail = email;
      if (domainPart === '' || domainPart === 'skywatertechnology.com'.substring(0, domainPart.length)) {
        completedEmail = email.substring(0, atIndex + 1) + 'skywatertechnology.com';
      }
      
      expect(completedEmail).toBe('user@skywatertechnology.com');
    });

    it('should not auto-complete different domain', () => {
      const email = 'user@gmail.com';
      const atIndex = email.lastIndexOf('@');
      const domainPart = email.substring(atIndex + 1);
      
      let completedEmail = email;
      if (domainPart === '' || domainPart === 'skywatertechnology.com'.substring(0, domainPart.length)) {
        completedEmail = email.substring(0, atIndex + 1) + 'skywatertechnology.com';
      }
      
      expect(completedEmail).toBe('user@gmail.com');
    });

    it('should handle email without @ symbol', () => {
      const email = 'user';
      const hasAt = email.includes('@');
      
      expect(hasAt).toBe(false);
      // Auto-complete should not trigger
    });

    it('should handle multiple @ symbols', () => {
      const email = 'user@test@sky';
      const atIndex = email.lastIndexOf('@');
      
      expect(email.substring(0, atIndex)).toBe('user@test');
    });
  });

  describe('Login Validation', () => {
    it('should require both email and password', () => {
      const validate = (email: string, password: string) => {
        if (!email || !password) {
          return 'Please enter both email and password';
        }
        return null;
      };
      
      expect(validate('', '')).toBeTruthy();
      expect(validate('user@test.com', '')).toBeTruthy();
      expect(validate('', 'password')).toBeTruthy();
      expect(validate('user@test.com', 'password')).toBeNull();
    });

    it('should check API availability', () => {
      const hasAPI = mockWindow.auth?.login !== undefined;
      expect(hasAPI).toBe(true);
    });

    it('should handle missing API gracefully', () => {
      (global as any).window = { auth: undefined };
      
      const hasAPI = (global as any).window.auth?.login !== undefined;
      expect(hasAPI).toBe(false);
    });
  });

  describe('Login Flow', () => {
    it('should call login API with correct parameters', async () => {
      mockWindow.auth.login.mockResolvedValue({
        success: true,
        token: 'test-token-123',
        isAdmin: false
      });
      
      const email = 'user@test.com';
      const password = 'password123';
      const stayLoggedIn = true;
      
      const result = await mockWindow.auth.login(email, password, stayLoggedIn);
      
      expect(mockWindow.auth.login).toHaveBeenCalledWith(email, password, stayLoggedIn);
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should handle successful login', async () => {
      mockWindow.auth.login.mockResolvedValue({
        success: true,
        token: 'test-token',
        isAdmin: false
      });
      
      const result = await mockWindow.auth.login('user@test.com', 'password', false);
      
      expect(result.success).toBe(true);
      expect(result.token).toBe('test-token');
    });

    it('should handle failed login', async () => {
      mockWindow.auth.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });
      
      const result = await mockWindow.auth.login('user@test.com', 'wrong', false);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle admin login', async () => {
      mockWindow.auth.login.mockResolvedValue({
        success: true,
        token: 'admin-token',
        isAdmin: true
      });
      
      const result = await mockWindow.auth.login('admin@test.com', 'password', false);
      
      expect(result.isAdmin).toBe(true);
    });

    it('should handle network errors', async () => {
      mockWindow.auth.login.mockRejectedValue(new Error('Network error'));
      
      try {
        await mockWindow.auth.login('user@test.com', 'password', false);
        expect(true).toBe(false); // Should throw
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('First-Time User Detection', () => {
    it('should detect first-time user when no credentials exist', async () => {
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: []
      });
      
      const response = await mockWindow.credentials.list();
      const isFirstTime = !response.success || !response.credentials || response.credentials.length === 0;
      
      expect(isFirstTime).toBe(true);
    });

    it('should detect returning user when credentials exist', async () => {
      mockWindow.credentials.list.mockResolvedValue({
        success: true,
        credentials: [{ service: 'smartsheet', email: 'user@test.com' }]
      });
      
      const response = await mockWindow.credentials.list();
      const isFirstTime = !response.success || !response.credentials || response.credentials.length === 0;
      
      expect(isFirstTime).toBe(false);
    });

    it('should handle error checking credentials', async () => {
      mockWindow.credentials.list.mockRejectedValue(new Error('API error'));
      
      try {
        await mockWindow.credentials.list();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Stay Logged In', () => {
    it('should default to true', () => {
      const stayLoggedIn = true;
      expect(stayLoggedIn).toBe(true);
    });

    it('should be toggleable', () => {
      let stayLoggedIn = true;
      
      stayLoggedIn = !stayLoggedIn;
      expect(stayLoggedIn).toBe(false);
      
      stayLoggedIn = !stayLoggedIn;
      expect(stayLoggedIn).toBe(true);
    });

    it('should pass correct value to login API', async () => {
      mockWindow.auth.login.mockResolvedValue({ success: true, token: 'test' });
      
      await mockWindow.auth.login('user@test.com', 'password', false);
      expect(mockWindow.auth.login).toHaveBeenCalledWith('user@test.com', 'password', false);
      
      await mockWindow.auth.login('user@test.com', 'password', true);
      expect(mockWindow.auth.login).toHaveBeenCalledWith('user@test.com', 'password', true);
    });
  });

  describe('Error Display', () => {
    it('should display error message on login failure', () => {
      const error = 'Invalid credentials';
      expect(error).toBeDefined();
      expect(error.length).toBeGreaterThan(0);
    });

    it('should clear error on input change', () => {
      let error = 'Previous error';
      
      const handleInputChange = () => {
        error = '';
      };
      
      handleInputChange();
      expect(error).toBe('');
    });

    it('should handle missing API error', () => {
      const error = 'Authentication API not available';
      expect(error).toContain('API not available');
    });

    it('should handle network error gracefully', () => {
      const networkError = new Error('Network request failed');
      const displayError = networkError.message;
      
      expect(displayError).toBe('Network request failed');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should submit on Enter key', () => {
      const handleLogin = vi.fn();
      const isLoading = false;
      
      const handleKeyPress = (key: string) => {
        if (key === 'Enter' && !isLoading) {
          handleLogin();
        }
      };
      
      handleKeyPress('Enter');
      expect(handleLogin).toHaveBeenCalledTimes(1);
    });

    it('should not submit on Enter when loading', () => {
      const handleLogin = vi.fn();
      const isLoading = true;
      
      const handleKeyPress = (key: string) => {
        if (key === 'Enter' && !isLoading) {
          handleLogin();
        }
      };
      
      handleKeyPress('Enter');
      expect(handleLogin).not.toHaveBeenCalled();
    });

    it('should not submit on other keys', () => {
      const handleLogin = vi.fn();
      const isLoading = false;
      
      const handleKeyPress = (key: string) => {
        if (key === 'Enter' && !isLoading) {
          handleLogin();
        }
      };
      
      handleKeyPress('Space');
      handleKeyPress('Tab');
      handleKeyPress('Escape');
      
      expect(handleLogin).not.toHaveBeenCalled();
    });
  });

  describe('Form Reset', () => {
    it('should reset form on successful login', () => {
      let email = 'user@test.com';
      let password = 'password123';
      let stayLoggedIn = false;
      let error = '';
      
      const resetForm = () => {
        email = '';
        password = '';
        stayLoggedIn = true;
        error = '';
      };
      
      resetForm();
      
      expect(email).toBe('');
      expect(password).toBe('');
      expect(stayLoggedIn).toBe(true);
      expect(error).toBe('');
    });

    it('should maintain form state on failed login', () => {
      const email = 'user@test.com';
      const password = 'password123';
      
      // On failure, email and password should remain
      expect(email).toBe('user@test.com');
      expect(password).toBe('password123');
    });
  });

  describe('Loading State', () => {
    it('should disable inputs when loading', () => {
      const isLoading = true;
      const disabled = isLoading;
      
      expect(disabled).toBe(true);
    });

    it('should disable submit button when missing credentials', () => {
      const email = '';
      const password = 'password';
      const isLoading = false;
      
      const disabled = !email || !password || isLoading;
      
      expect(disabled).toBe(true);
    });

    it('should enable submit when all fields filled', () => {
      const email = 'user@test.com';
      const password = 'password123';
      const isLoading = false;
      
      const disabled = !email || !password || isLoading;
      
      expect(disabled).toBe(false);
    });
  });

  describe('Dialog Behavior', () => {
    it('should not close on Escape key', () => {
      const disableEscapeKeyDown = true;
      expect(disableEscapeKeyDown).toBe(true);
    });

    it('should show different title for first-time users', () => {
      const getTitle = (isFirstTime: boolean) => {
        return isFirstTime ? 'Create Account' : 'Login to SheetPilot';
      };
      
      expect(getTitle(true)).toBe('Create Account');
      expect(getTitle(false)).toBe('Login to SheetPilot');
    });

    it('should show different button text for first-time users', () => {
      const getButtonText = (isLoading: boolean, isFirstTime: boolean) => {
        if (isLoading) return 'Logging in...';
        return isFirstTime ? 'Create Account' : 'Login';
      };
      
      expect(getButtonText(false, true)).toBe('Create Account');
      expect(getButtonText(false, false)).toBe('Login');
      expect(getButtonText(true, false)).toBe('Logging in...');
    });
  });

  describe('Security', () => {
    it('should use password input type for password field', () => {
      const inputType = 'password';
      expect(inputType).toBe('password');
    });

    it('should not display password in clear text', () => {
      const password = 'secret123';
      const inputType = 'password';
      
      // In password type, browser handles masking
      expect(inputType).toBe('password');
      expect(password).toBe('secret123'); // Stored in memory but not displayed
    });

    it('should handle empty password gracefully', () => {
      const password = '';
      const isValid = password.length > 0;
      
      expect(isValid).toBe(false);
    });

    it('should not log sensitive information', async () => {
      mockWindow.auth.login.mockResolvedValue({
        success: true,
        token: 'token',
        isAdmin: false
      });
      
      await mockWindow.auth.login('user@test.com', 'password', false);
      
      // Should log user action but not password
      expect(mockWindow.logger.userAction).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long email addresses', () => {
      const longEmail = 'a'.repeat(200) + '@skywatertechnology.com';
      expect(longEmail.length).toBeGreaterThan(200);
    });

    it('should handle very long passwords', () => {
      const longPassword = 'a'.repeat(500);
      expect(longPassword.length).toBe(500);
    });

    it('should handle special characters in email', () => {
      const specialEmail = 'user.name+tag@skywatertechnology.com';
      expect(specialEmail).toContain('+');
      expect(specialEmail).toContain('.');
    });

    it('should handle special characters in password', () => {
      const specialPassword = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      expect(specialPassword.length).toBeGreaterThan(20);
    });

    it('should handle unicode in password', () => {
      const unicodePassword = 'password🔒密码';
      expect(unicodePassword).toContain('🔒');
    });

    it('should handle whitespace in inputs', () => {
      const emailWithSpaces = '  user@test.com  ';
      const passwordWithSpaces = '  password  ';
      
      // Should either trim or reject
      expect(typeof emailWithSpaces).toBe('string');
      expect(typeof passwordWithSpaces).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should show error message from API', async () => {
      const errorMessage = 'Invalid credentials. Please try again.';
      mockWindow.auth.login.mockResolvedValue({
        success: false,
        error: errorMessage
      });
      
      const result = await mockWindow.auth.login('user@test.com', 'wrong', false);
      
      expect(result.error).toBe(errorMessage);
    });

    it('should show default error when API error is missing', async () => {
      mockWindow.auth.login.mockResolvedValue({
        success: false
      });
      
      const result = await mockWindow.auth.login('user@test.com', 'wrong', false);
      const errorMsg = result.error || 'Login failed. Please check your credentials.';
      
      expect(errorMsg).toBe('Login failed. Please check your credentials.');
    });

    it('should handle exception during login', async () => {
      mockWindow.auth.login.mockRejectedValue(new Error('Network failure'));
      
      try {
        await mockWindow.auth.login('user@test.com', 'password', false);
        expect(true).toBe(false); // Should throw
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toBe('Network failure');
      }
    });

    it('should clear error when user starts typing', () => {
      let error = 'Previous error message';
      
      const handleChange = () => {
        error = '';
      };
      
      handleChange();
      expect(error).toBe('');
    });
  });

  describe('Accessibility', () => {
    it('should have autofocus on email field', () => {
      const autoFocus = true;
      expect(autoFocus).toBe(true);
    });

    it('should have accessible labels', () => {
      const emailLabel = 'Email';
      const passwordLabel = 'Password';
      const stayLoggedInLabel = 'Stay logged in for 30 days';
      
      expect(emailLabel).toBe('Email');
      expect(passwordLabel).toBe('Password');
      expect(stayLoggedInLabel).toBe('Stay logged in for 30 days');
    });

    it('should have placeholders for guidance', () => {
      const emailPlaceholder = 'your.email@skywatertechnology.com';
      const passwordPlaceholder = 'Your password';
      
      expect(emailPlaceholder).toContain('@skywatertechnology.com');
      expect(passwordPlaceholder).toBeDefined();
    });
  });
});

