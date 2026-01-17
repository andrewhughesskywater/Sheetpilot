import { ipcLogger } from "@sheetpilot/shared/logger";
import { getCredentials, storeCredentials } from "@/models";
import { validateInput } from "@/validation/validate-ipc-input";
import { loginSchema } from "@/validation/ipc-schemas";

export type LoginPayload = {
  email: string;
  password: string;
  stayLoggedIn: boolean;
};

export type LoginResponse = {
  success: boolean;
  error?: string;
  token?: string;
  isAdmin?: boolean;
};

export const buildLoginError = (error: string): LoginResponse => ({
  success: false,
  error,
});

export const getValidatedLoginPayload = (
  email: string,
  password: string,
  stayLoggedIn: boolean
):
  | { success: true; data: LoginPayload }
  | { success: false; error: string } => {
  const validation = validateInput(
    loginSchema,
    { email, password, stayLoggedIn },
    "auth:login"
  );
  if (!validation.success) {
    return { success: false, error: validation.error ?? "Validation failed" };
  }
  return { success: true, data: validation.data! };
};

export const isAdminLogin = (
  payload: LoginPayload,
  adminUsername: string,
  adminPassword?: string
): boolean => {
  if (!adminPassword) {
    return false;
  }
  const isAdmin =
    payload.email === adminUsername && payload.password === adminPassword;
  if (isAdmin) {
    ipcLogger.info("Admin login successful", { email: payload.email });
  }
  return isAdmin;
};

const getCredentialMismatchError = (
  storedEmail: string,
  providedEmail: string
): string | null => {
  if (storedEmail === providedEmail) {
    return null;
  }
  ipcLogger.warn("Login email mismatch", {
    providedEmail,
    storedEmail,
  });
  return `Credentials are stored for ${storedEmail}. Use that email or clear credentials in Settings.`;
};

const getPasswordMismatchError = (
  storedPassword: string,
  providedPassword: string,
  email: string
): string | null => {
  if (storedPassword === providedPassword) {
    return null;
  }
  ipcLogger.warn("Login password mismatch", { email });
  return "Incorrect password. Please try again.";
};

const validateReturningUser = (
  storedEmail: string,
  storedPassword: string,
  payload: LoginPayload
): string | null => {
  const emailError = getCredentialMismatchError(storedEmail, payload.email);
  if (emailError) {
    return emailError;
  }
  const passwordError = getPasswordMismatchError(
    storedPassword,
    payload.password,
    payload.email
  );
  if (passwordError) {
    return passwordError;
  }
  ipcLogger.verbose("Password verified for returning user", {
    email: payload.email,
  });
  return null;
};

const storeNewUserCredentials = (payload: LoginPayload): string | null => {
  ipcLogger.verbose("Storing credentials for new user", {
    email: payload.email,
  });
  const storeResult = storeCredentials(
    "smartsheet",
    payload.email,
    payload.password
  );
  if (!storeResult.success) {
    return storeResult.message;
  }
  return null;
};

export const ensureUserCredentials = (payload: LoginPayload): string | null => {
  const existingCredentials = getCredentials("smartsheet");
  if (existingCredentials) {
    return validateReturningUser(
      existingCredentials.email,
      existingCredentials.password,
      payload
    );
  }
  return storeNewUserCredentials(payload);
};
