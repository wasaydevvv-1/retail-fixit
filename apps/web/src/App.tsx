import { Navigate, Route, Routes } from 'react-router-dom';
import { Permission } from '@retailfixit/shared';

import { NavRoute } from './components/NavRoute.js';
import { PortalLayout } from './components/PortalLayout.js';
import { RoleHomeRedirect } from './components/RoleHomeRedirect.js';
import { VendorProfileRoute } from './components/VendorProfileRoute.js';
import { AdminHomePage } from './features/admin/pages/AdminHomePage.js';
import { AdminTenantsPage } from './features/admin/pages/AdminTenantsPage.js';
import { AdminObservabilityPage } from './features/admin/pages/AdminObservabilityPage.js';
import { AdminRolePermissionsPage } from './features/admin/pages/AdminRolePermissionsPage.js';
import { AdminUsersPage } from './features/admin/pages/AdminUsersPage.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { VendorRegisterPage } from './features/auth/VendorRegisterPage.js';
import { ProtectedRoute } from './features/auth/ProtectedRoute.js';
import { CreateJobPage } from './features/jobs/pages/CreateJobPage.js';
import { JobDashboardPage } from './features/jobs/pages/JobDashboardPage.js';
import { JobDetailPage } from './features/jobs/pages/JobDetailPage.js';
import { VendorDirectoryPage } from './features/vendors/pages/VendorDirectoryPage.js';
import { VendorJobDetailPage } from './features/vendors/pages/VendorJobDetailPage.js';
import { VendorJobsPage } from './features/vendors/pages/VendorJobsPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register/vendor" element={<VendorRegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<NavRoute navId="overview"><AdminHomePage /></NavRoute>} />
        <Route path="/admin/tenants" element={<NavRoute navId="tenants"><AdminTenantsPage /></NavRoute>} />
        <Route path="/admin/users" element={<NavRoute navId="users"><AdminUsersPage /></NavRoute>} />
        <Route path="/admin/roles" element={<NavRoute navId="roles"><AdminRolePermissionsPage /></NavRoute>} />
        <Route
          path="/admin/observability"
          element={
            <NavRoute navId="observability">
              <AdminObservabilityPage />
            </NavRoute>
          }
        />

        <Route path="/dispatch/jobs" element={<NavRoute navId="dispatch"><JobDashboardPage /></NavRoute>} />
        <Route
          path="/dispatch/jobs/new"
          element={
            <NavRoute navId="dispatch" permission={Permission.JobsCreate}>
              <CreateJobPage />
            </NavRoute>
          }
        />
        <Route path="/dispatch/jobs/:id" element={<NavRoute navId="dispatch"><JobDetailPage /></NavRoute>} />

        <Route path="/support/jobs" element={<NavRoute navId="lookup"><JobDashboardPage /></NavRoute>} />
        <Route path="/support/jobs/:id" element={<NavRoute navId="lookup"><JobDetailPage /></NavRoute>} />

        <Route path="/vendor/profile" element={<VendorProfileRoute />} />
        <Route path="/vendor/jobs" element={<NavRoute navId="vendor-jobs"><VendorJobsPage /></NavRoute>} />
        <Route path="/vendor/jobs/:id" element={<NavRoute navId="vendor-jobs"><VendorJobDetailPage /></NavRoute>} />
        <Route path="/vendor/directory" element={<NavRoute navId="vendor-directory"><VendorDirectoryPage /></NavRoute>} />

        {/* Legacy redirects */}
        <Route path="/jobs" element={<Navigate to="/dispatch/jobs" replace />} />
        <Route path="/jobs/new" element={<Navigate to="/dispatch/jobs/new" replace />} />
        <Route path="/jobs/:id" element={<Navigate to="/dispatch/jobs/:id" replace />} />
      </Route>

      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}
