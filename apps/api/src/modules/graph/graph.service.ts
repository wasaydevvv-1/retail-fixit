import type {
  EntraConfigResponse,
  EntraDirectoryUser,
  EntraUserSearchResponse,
} from '@retailfixit/shared';

import { AppError } from '../../middleware/error.js';
import { isEntraGraphEnabled } from '../../config/index.js';
import {
  createEntraUser,
  getEntraDefaultDomain,
  searchEntraUsers,
  testGraphAuth,
  testGraphWritePermission,
} from './graph.client.js';

export async function getEntraConfig(): Promise<EntraConfigResponse> {
  if (!isEntraGraphEnabled()) {
    return {
      graphEnabled: false,
      canCreateUsers: false,
      message:
        'Add AZURE_AD_CLIENT_SECRET to apps/api/.env and grant Microsoft Graph application permissions (User.Read.All + User.ReadWrite.All + Application.Read.All + AppRoleAssignment.ReadWrite.All) with admin consent.',
    };
  }

  try {
    await testGraphAuth();
    const defaultDomain = await getEntraDefaultDomain();
    try {
      await testGraphWritePermission();
      return {
        graphEnabled: true,
        canCreateUsers: true,
        graphAuthOk: true,
        graphWriteOk: true,
        defaultDomain,
      };
    } catch (writeErr) {
      const message =
        writeErr instanceof AppError
          ? writeErr.message
          : 'User.ReadWrite.All application permission is required to create users in Entra.';
      return {
        graphEnabled: true,
        canCreateUsers: false,
        graphAuthOk: true,
        graphWriteOk: false,
        defaultDomain,
        message:
          message +
          ' In Azure Portal: App registrations → your app → API permissions → Add User.ReadWrite.All (Application) → Grant admin consent.',
      };
    }
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : 'Graph is configured but authentication failed. Create a new client secret on the same app as AZURE_AD_CLIENT_ID.';
    return {
      graphEnabled: true,
      canCreateUsers: false,
      graphAuthOk: false,
      graphWriteOk: false,
      message,
    };
  }
}

export async function searchDirectoryUsers(query: string): Promise<EntraUserSearchResponse> {
  if (!isEntraGraphEnabled()) {
    return {
      enabled: false,
      items: [],
      message:
        'Entra directory search is not configured. Add AZURE_AD_CLIENT_SECRET and grant User.Read.All on the app registration.',
    };
  }

  const results = await searchEntraUsers(query);
  const items: EntraDirectoryUser[] = results.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    mail: u.mail ?? undefined,
    userPrincipalName: u.userPrincipalName,
  }));

  return { enabled: true, items };
}

export { createEntraUser };
