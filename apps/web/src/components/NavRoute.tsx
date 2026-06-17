import type { Permission } from '@retailfixit/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider.js';
import { isNavItemEnabled } from '../lib/portal-config.js';

interface NavRouteProps {
  /** Must match an id in NAV_CATALOG (portal-config.ts). */
  navId: string;
  /** Optional extra permission (e.g. JobsCreate on /dispatch/jobs/new). */
  permission?: Permission;
  children: ReactNode;
}

/**
 * Route guard aligned with sidebar nav rules.
 * Blocks direct URL access when the sidebar item would be locked.
 */
export function NavRoute({ navId, permission, children }: NavRouteProps) {
  const { user, can } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isNavItemEnabled(user, navId)) {
    return <Navigate to={user.homePath} replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to={user.homePath} replace />;
  }

  return <>{children}</>;
}
