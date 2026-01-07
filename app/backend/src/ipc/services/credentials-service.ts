import { ipcLogger } from '../../../shared/logger';
import { CredentialsStorageError } from '../../../shared/errors';
import { deleteCredentials, listCredentials, storeCredentials } from '../repositories';
import { validateInput } from '../validation/validate-ipc-input';
import { deleteCredentialsSchema, storeCredentialsSchema } from '../validation/ipc-schemas';

export type CredentialsStoreResult = { success: boolean; message?: string; error?: unknown; changes: number };
export type CredentialsListResult = { success: boolean; error?: string; credentials: Array<{ service: string; email: string }> };
export type CredentialsDeleteResult = { success: boolean; message?: string; error?: unknown; changes: number };

export function storeCredentialsRequest(service: string, email: string, password: string): CredentialsStoreResult {
  const validation = validateInput(storeCredentialsSchema, { service, email, password }, 'credentials:store');
  if (!validation.success) {
    return { success: false, error: validation.error, changes: 0 };
  }

  const validated = validation.data!;
  ipcLogger.audit('store-credentials', 'User storing credentials', { service: validated.service, email: validated.email });

  try {
    const result = storeCredentials(validated.service, validated.email, validated.password);
    ipcLogger.info('Credentials stored successfully', {
      service: validated.service,
      email: validated.email,
      changes: result.changes
    });
    return { success: true, changes: result.changes };
  } catch (err: unknown) {
    const isCredentialsError = err instanceof Error && err.name.includes('Credentials');

    if (isCredentialsError) {
      ipcLogger.security('credentials-storage-error', 'Could not store credentials', { service: validated.service, error: err });
    } else {
      ipcLogger.error('Could not store credentials', err);
    }

    throw new CredentialsStorageError(validated.service, {
      error: err instanceof Error ? err.message : String(err),
      originalError: err instanceof Error ? err.name : 'Unknown'
    });
  }
}

export function listCredentialsRequest(): CredentialsListResult {
  try {
    const credentials = listCredentials();
    return { success: true, credentials };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage, credentials: [] };
  }
}

export function deleteCredentialsRequest(service: string): CredentialsDeleteResult {
  const validation = validateInput(deleteCredentialsSchema, { service }, 'credentials:delete');
  if (!validation.success) {
    return { success: false, error: validation.error, changes: 0 };
  }

  const validated = validation.data!;
  ipcLogger.audit('delete-credentials', 'User deleting credentials', { service: validated.service });

  try {
    const result = deleteCredentials(validated.service);
    ipcLogger.info('Credentials deleted', { service: validated.service, changes: result.changes });
    return { success: true, changes: result.changes };
  } catch (err: unknown) {
    ipcLogger.error('Could not delete credentials', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, message: errorMessage, changes: 0 };
  }
}
