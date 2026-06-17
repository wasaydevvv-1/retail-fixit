import { Navigate, useLocation } from 'react-router-dom';

import { SessionLoadingScreen } from '../../components/SessionLoadingScreen.js';
import { useAuth } from './AuthProvider.js';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <SessionLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
