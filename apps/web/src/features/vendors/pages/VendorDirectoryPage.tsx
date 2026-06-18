import { Permission } from '@retailfixit/shared';

import { BusinessTenantPicker } from '../../../components/BusinessTenantPicker.js';
import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { useBusinessTenantScope } from '../../../lib/use-business-tenant-scope.js';
import { VendorRatingDisplay, VendorRatingEditor } from '../components/VendorRatingEditor.js';
import { useVendorDirectory } from '../hooks/useVendorProfile.js';

export function VendorDirectoryPage() {
  const { can } = useAuth();
  const canRate = can(Permission.VendorsRate);
  const { isPlatformAdmin, tenantId, selectedTenantId, setSelectedTenantId, tenants } =
    useBusinessTenantScope();
  const { data, isLoading, isError, error } = useVendorDirectory({
    page: 1,
    pageSize: 20,
    ...(isPlatformAdmin ? { tenantId } : {}),
  });

  return (
    <div className="rf-page">
      {isPlatformAdmin && (
        <section className="rf-panel rf-panel-toolbar">
          <BusinessTenantPicker
            value={selectedTenantId}
            onChange={setSelectedTenantId}
            tenants={tenants ?? []}
          />
          <p className="hint">View-only access — vendor management actions are restricted.</p>
        </section>
      )}

      <p className="hint rf-page-lede">
        {isPlatformAdmin
          ? 'Browse vendor companies across business tenants (read-only).'
          : canRate
            ? 'Browse vendor companies and set quality ratings (0–5) used by AI job matching.'
            : 'Active vendors available for AI matching and dispatcher assignment.'}
      </p>

      <section className="rf-panel">
        {isLoading ? (
          <p>Loading vendors…</p>
        ) : isError ? (
          <ErrorAlert error={error} title="Failed to load vendors" />
        ) : (
          <div className="table-wrap">
            <table className="data-table rf-vendor-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Skills</th>
                  <th>Service areas</th>
                  <th>Rating</th>
                  <th>Active jobs</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.skills.join(', ')}</td>
                    <td>{v.serviceAreas.join(', ')}</td>
                    <td>
                      {canRate ? (
                        <VendorRatingEditor vendor={v} />
                      ) : (
                        <VendorRatingDisplay rating={v.rating} />
                      )}
                    </td>
                    <td>{v.activeJobCount}</td>
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
