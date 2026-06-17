import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider.js';
import { isNavItemEnabled } from '../lib/portal-config.js';
import { VendorProfilePage } from '../features/vendors/pages/VendorProfilePage.js';

export function VendorProfileRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (!isNavItemEnabled(user, 'vendor-profile')) {
    return <Navigate to={user.homePath} replace />;
  }

  return <VendorProfilePage />;
}
