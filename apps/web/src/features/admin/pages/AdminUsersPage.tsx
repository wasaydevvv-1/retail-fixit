import type { TenantUserSummary } from '@retailfixit/shared';
import { Permission } from '@retailfixit/shared';
import { useState } from 'react';

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
  const [selectedTenantId, setSelectedTenantId] = useState(
    isPlatformAdmin ? 'tenant_acme' : (user?.tenantId ?? 'tenant_acme'),
  );
  const listTenantId = isPlatformAdmin ? selectedTenantId : undefined;
  const { data, isLoading, isError, error, refetch } = useTenantUsers(listTenantId);

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
          ? 'Select a business tenant, then add its tenant admin or staff. Tenant admins manage only their own tenant.'
          : 'Add staff for your organization. Each tenant only sees its own users and jobs.'}
      </p>

      {isPlatformAdmin && (
        <section className="rf-panel">
          <label className="rf-field">
            <span>View users for tenant</span>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              {(tenants ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
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
                        u.roles.join(', ')
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
