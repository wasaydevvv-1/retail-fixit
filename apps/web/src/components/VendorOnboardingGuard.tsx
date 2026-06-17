import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { UserRole } from '@retailfixit/shared';

import { useAuth } from '../features/auth/AuthProvider.js';

const ONBOARDING_ALLOWED = ['/vendor/profile'];

/** Redirect vendor managers with incomplete profiles to company profile setup. */
export function VendorOnboardingGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (
    user?.needsVendorProfile &&
    user.roles.includes(UserRole.VendorManager) &&
    !ONBOARDING_ALLOWED.some((path) => location.pathname.startsWith(path))
  ) {
    return <Navigate to="/vendor/profile" replace />;
  }

  return <>{children}</>;
}
