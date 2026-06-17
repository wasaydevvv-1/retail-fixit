import { Permission } from '@retailfixit/shared';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.js';
import { CreateJobForm } from '../components/CreateJobForm.js';

export function CreateJobPage() {
  const { can } = useAuth();

  if (!can(Permission.JobsCreate)) {
    return <Navigate to="/dispatch/jobs" replace />;
  }
  return (
    <div className="rf-page">
      <CreateJobForm />
    </div>
  );
}
