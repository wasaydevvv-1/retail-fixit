import type { TenantUserSummary } from '@retailfixit/shared';
import { Permission, UserRole } from '@retailfixit/shared';
import { useState } from 'react';

import { BusinessTenantPicker, USER_ROLE_FILTER_OPTIONS, formatRoleLabel } from '../../../components/BusinessTenantPicker.js';
import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { AddUserForm } from '../components/AddUserForm.js';
import { UserRoleEditor } from '../components/UserRoleEditor.js';
import { useTenants } from '../hooks/useTenants.js';
import { useTenantUsers } from '../hooks/useTenantUsers.js';

export function AdminUsersPage() {
  const { user, can, loadCurrentUser } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;
  const { data: tenants } = useTenants(isPlatformAdmin);
  const [tenantFilter, setTenantFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('');
  const { data, isLoading, isError, error, refetch } = useTenantUsers({
    tenantId: isPlatformAdmin && tenantFilter ? tenantFilter : undefined,
    role: roleFilter || undefined,
  });

  async function handleRolesSaved(updated: TenantUserSummary) {
    await refetch();
    if (updated.id === user?.id) {
      await loadCurrentUser();
    }
  }

  return (
    <div className="rf-page">
      <p className="hint rf-page-lede">
        {isPlatformAdmin
          ? 'View users across all business tenants. Platform operators provision tenant admins only; tenant admins add dispatchers, vendor managers, and support agents.'
          : 'Add staff for your organization. Each tenant only sees its own users and jobs.'}
      </p>

      {isPlatformAdmin && (
        <section className="rf-panel rf-panel-toolbar">
          <BusinessTenantPicker
            value={tenantFilter}
            onChange={setTenantFilter}
            tenants={[{ id: '', name: 'All tenants' }, ...(tenants ?? [])]}
          />
          <label className="rf-field">
            <span>Role</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as '' | UserRole)}
            >
              {USER_ROLE_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {can(Permission.UsersManage) && <AddUserForm onCreated={() => void refetch()} />}

      <section className="rf-panel">
        {isLoading ? (
          <p>Loading users…</p>
        ) : isError ? (
          <ErrorAlert error={error} title="Failed to load users" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  {isPlatformAdmin && <th>Tenant</th>}
                  <th>Status</th>
                  <th>Roles</th>
                  <th>Vendor company</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((u: TenantUserSummary) => (
                  <tr key={u.id}>
                    <td>{u.displayName}</td>
                    <td>{u.email}</td>
                    {isPlatformAdmin && <td>{u.tenantName ?? u.tenantId}</td>}
                    <td>
                      <span className={`status-pill status-${u.status}`}>
                        {u.status === 'pending' ? 'Pending invite' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {can(Permission.UsersManage) ? (
                        <UserRoleEditor user={u} onSaved={handleRolesSaved} />
                      ) : (
                        u.roles.map(formatRoleLabel).join(', ')
                      )}
                    </td>
                    <td>{u.vendorName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
