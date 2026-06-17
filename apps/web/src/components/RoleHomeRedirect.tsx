import { Navigate } from 'react-router-dom';

import { SessionLoadingScreen } from './SessionLoadingScreen.js';
import { useAuth } from '../features/auth/AuthProvider.js';

export function RoleHomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SessionLoadingScreen />;
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.homePath} replace />;
}
