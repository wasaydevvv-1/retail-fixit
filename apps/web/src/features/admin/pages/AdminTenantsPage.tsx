import { Link } from 'react-router-dom';
import { Permission } from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { CreateTenantForm } from '../components/CreateTenantForm.js';
import { useTenants } from '../hooks/useTenants.js';

export function AdminTenantsPage() {
  const { user, can } = useAuth();
  const { data, isLoading, isError, error, refetch } = useTenants(true);

  return (
    <div className="rf-page">
      <p className="hint rf-page-lede">
        Platform operator view. Create business tenants, then provision a{' '}
        <strong>tenant administrator</strong> for each one. Tenant admins manage their own staff.
      </p>

      {can(Permission.TenantsManage) && <CreateTenantForm onCreated={() => void refetch()} />}

      <section className="rf-panel info-card">
        <h3>Setup flow</h3>
        <ol className="rf-insight-list">
          <li>Create a business tenant (above) or use an existing one like Acme or Beta.</li>
          <li>Create a <strong>Tenant administrator</strong> for that tenant (Users & access).</li>
          <li>Share sign-in details with each tenant administrator.</li>
          <li>Each tenant admin signs in and adds their own staff — data stays separate per tenant.</li>
        </ol>
        <div className="rf-panel-actions">
          <Link to="/admin/users" className="btn-rf btn-rf--primary">
            Go to Users & access
          </Link>
        </div>
      </section>

      <section className="rf-panel">
        <h2>Business tenants</h2>
        <p className="hint">Signed in as {user?.displayName} · {user?.tenantName}</p>

        {isLoading ? (
          <p>Loading tenants…</p>
        ) : isError ? (
          <ErrorAlert error={error} title="Failed to load tenants" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Tenant id</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      <code>{t.id}</code>
                    </td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
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
