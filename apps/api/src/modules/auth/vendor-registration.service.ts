import type { VendorRegisterResponse } from '@retailfixit/shared';
import { UserRole } from '@retailfixit/shared';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

import { config, isEntraAuthEnabled, isEntraGraphEnabled } from '../../config/index.js';
import { AppError } from '../../middleware/error.js';
import { logger } from '../../observability/logger.js';
import { findUserByLoginOrEmail, isPendingUserId, upsertUser } from '../auth/users.repository.js';
import { createEntraUser, getEntraConfig } from '../graph/graph.service.js';
import { syncEntraAppRoleAssignment } from '../graph/graph.app-roles.js';

export const vendorRegisterSchema = z.object({
  displayName: z.string().min(1).max(120),
  userName: z.string().min(1).max(64),
  password: z.string().min(8).max(128).optional(),
});

export async function getVendorRegistrationConfig() {
  const entra = await getEntraConfig();
  const enabled =
    config.auth.vendorSelfRegistrationEnabled &&
    (isEntraGraphEnabled() || !isEntraAuthEnabled());

  return {
    enabled,
    mode: isEntraAuthEnabled() ? ('entra' as const) : ('dev' as const),
    entra: isEntraAuthEnabled() ? entra : undefined,
  };
}

export async function registerVendorManager(
  body: z.infer<typeof vendorRegisterSchema>,
): Promise<VendorRegisterResponse> {
  if (!config.auth.vendorSelfRegistrationEnabled) {
    throw new AppError(
      403,
      'REGISTRATION_DISABLED',
      'Vendor self-registration is disabled on this environment.',
    );
  }

  const tenantId = config.auth.defaultTenantId;
  const displayName = body.displayName.trim();
  const roles = [UserRole.VendorManager];

  if (isEntraAuthEnabled()) {
    if (!isEntraGraphEnabled()) {
      throw new AppError(
        503,
        'REGISTRATION_UNAVAILABLE',
        'Vendor registration requires Entra Graph (AZURE_AD_CLIENT_SECRET and User.ReadWrite.All).',
      );
    }

    const created = await createEntraUser({
      displayName,
      userName: body.userName.trim(),
      password: body.password,
    });
    const loginId = created.userPrincipalName.toLowerCase();
    const email = (created.user.mail ?? created.userPrincipalName).toLowerCase();

    const existingLogin = await findUserByLoginOrEmail(tenantId, loginId);
    if (existingLogin) {
      throw new AppError(
        409,
        'USER_EMAIL_TAKEN',
        `An account with sign-in ${loginId} already exists`,
      );
    }

    let entraAssignmentWarning: string | undefined;
    let entraAssignedRole: string | undefined;
    try {
      const assignment = await syncEntraAppRoleAssignment(created.user.id, roles);
      entraAssignedRole = assignment.assignedRole;
      entraAssignmentWarning = assignment.warning;
    } catch (err) {
      entraAssignmentWarning =
        err instanceof AppError
          ? err.message
          : 'Account created but Entra app role assignment failed.';
    }

    const user = await upsertUser({
      id: `pending_${uuid()}`,
      tenantId,
      email,
      loginId,
      displayName,
      roles,
      entraObjectId: created.user.id,
    });

    logger.info(
      { userId: user.id, email: user.email, loginId },
      'Vendor manager self-registered (pending first sign-in)',
    );

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      status: isPendingUserId(user.id) ? 'pending' : 'active',
      tenantId,
      temporaryPassword: created.temporaryPassword,
      userPrincipalName: created.userPrincipalName,
      entraAssignedRole,
      entraAssignmentWarning,
    };
  }

  const loginId = `${body.userName.trim().toLowerCase()}@dev.local`;
  const existingLogin = await findUserByLoginOrEmail(tenantId, loginId);
  if (existingLogin) {
    throw new AppError(409, 'USER_EMAIL_TAKEN', `An account with ${loginId} already exists`);
  }

  const user = await upsertUser({
    id: `user_${uuid()}`,
    tenantId,
    email: loginId,
    loginId,
    displayName,
    roles,
  });

  logger.info({ userId: user.id, email: user.email }, 'Vendor manager registered (dev mode)');

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    status: 'active',
    tenantId,
    devUserId: user.id,
  };
}
