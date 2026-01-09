export async function login(
  email: string,
  password: string,
  stayLoggedIn: boolean
): Promise<{
  success: boolean;
  token?: string;
  isAdmin?: boolean;
  error?: string;
}> {
  if (!window.auth?.login) {
    return { success: false, error: 'Authentication API not available' };
  }
  return window.auth.login(email, password, stayLoggedIn);
}

export async function validateSession(token: string): Promise<{ valid: boolean; email?: string; isAdmin?: boolean }> {
  if (!window.auth?.validateSession) {
    return { valid: false };
  }
  return window.auth.validateSession(token);
}

export async function logout(token: string): Promise<{ success: boolean; error?: string }> {
  if (!window.auth?.logout) {
    return { success: false, error: 'Authentication API not available' };
  }
  return window.auth.logout(token);
}
