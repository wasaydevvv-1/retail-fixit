import { Navigate, useLocation } from 'react-router-dom';
import type { Permission } from '@retailfixit/shared';

import { useAuth } from '../features/auth/AuthProvider.js';

interface PermissionRouteProps {
  permission?: Permission;
  children: React.ReactNode;
  fallback?: string;
}

export function PermissionRoute({
  permission,
  children,
  fallback = '/',
}: PermissionRouteProps) {
  const { user, can } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (permission && !can(permission)) {
    return <Navigate to={user.homePath ?? fallback} replace />;
  }

  return children;
}
