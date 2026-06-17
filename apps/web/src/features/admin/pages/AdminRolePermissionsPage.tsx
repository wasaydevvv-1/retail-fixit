import { useEffect, useState } from 'react';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  Permission,
  ROLE_LABELS,
  UserRole,
  type RolePermissionMatrix,
} from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useToast } from '../../../components/ToastProvider.js';
import { friendlyError } from '../../../lib/user-messages.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { useTenants } from '../hooks/useTenants.js';
import { useRoleMatrix, useUpdateRoleMatrix } from '../hooks/useRoleMatrix.js';

const LOCKED_ROLES = new Set<UserRole>([UserRole.Admin, UserRole.PlatformAdmin]);
const EDITABLE_ROLES = Object.values(UserRole).filter((role) => !LOCKED_ROLES.has(role));

export function AdminRolePermissionsPage() {
  const { toast } = useToast();
  const { user, can, loadCurrentUser } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;
  const { data: tenants } = useTenants(isPlatformAdmin);
  const [selectedTenantId, setSelectedTenantId] = useState(
    isPlatformAdmin ? 'tenant_acme' : (user?.tenantId ?? 'tenant_acme'),
  );
  const matrixTenantId = isPlatformAdmin ? selectedTenantId : undefined;

  const canEdit = can(Permission.UsersManage);
  const { data, isLoading, isError, error } = useRoleMatrix(matrixTenantId);
  const updateMatrix = useUpdateRoleMatrix(matrixTenantId);
  const [draft, setDraft] = useState<RolePermissionMatrix | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const matrix = draft ?? data?.matrix ?? null;

  useEffect(() => {
    setDraft(null);
    setSaveError(null);
  }, [selectedTenantId]);

  function togglePermission(role: UserRole, permission: Permission) {
    if (!matrix) return;
    const current = matrix[role] ?? [];
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];

    setDraft({
      ...matrix,
      [role]: next,
    });
  }

  async function save() {
    if (!matrix) return;
    setSaveError(null);
    try {
      await updateMatrix.mutateAsync(matrix);
      setDraft(null);
      await loadCurrentUser();
      toast('Permissions saved', 'success');
    } catch (err) {
      setSaveError(friendlyError(err, 'Could not save permissions'));
    }
  }

  function reset() {
    setDraft(null);
    setSaveError(null);
  }

  const dirty = draft !== null;

  return (
    <div className="rf-page">
      <p className="hint rf-page-lede">
        {isPlatformAdmin
          ? 'Choose what each role can do within a business tenant. Platform operator roles are fixed.'
          : 'Choose what each role is allowed to do. Users get access from their assigned roles. Tenant administrators always have full access.'}
      </p>

      {isPlatformAdmin && (
        <section className="rf-panel">
          <label className="rf-field">
            <span>Edit permissions for tenant</span>
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

      {saveError && <ErrorAlert error={new Error(saveError)} title="Save failed" />}

      <section className="rf-panel">
        <div className="rf-panel-toolbar">
          <h2>Permission matrix</h2>
          {canEdit && (
            <div className="rf-panel-actions">
              <button type="button" className="btn-rf btn-rf--ghost" disabled={!dirty} onClick={reset}>
                Reset
              </button>
              <button
                type="button"
                className="btn-rf btn-rf--primary"
                disabled={!dirty || updateMatrix.isPending}
                onClick={() => void save()}
              >
                {updateMatrix.isPending ? 'Saving…' : 'Save permissions'}
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <p>Loading permissions…</p>
        ) : isError ? (
          <ErrorAlert error={error} title="Could not load permissions" />
        ) : matrix ? (
          <div className="table-wrap">
            <table className="data-table permission-matrix">
              <thead>
                <tr>
                  <th>Role</th>
                  {ALL_PERMISSIONS.map((permission) => (
                    <th key={permission} className="matrix-perm-col">
                      <span title={permission}>{PERMISSION_LABELS[permission]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(UserRole).map((role) => (
                  <tr key={role}>
                    <td>
                      <strong>{ROLE_LABELS[role]}</strong>
                      {role === UserRole.Admin && (
                        <p className="hint matrix-role-note">Always full access</p>
                      )}
                      {role === UserRole.PlatformAdmin && (
                        <p className="hint matrix-role-note">Fixed operator role</p>
                      )}
                    </td>
                    {ALL_PERMISSIONS.map((permission) => {
                      const checked = matrix[role]?.includes(permission) ?? false;
                      const locked = LOCKED_ROLES.has(role);
                      return (
                        <td key={permission} className="matrix-cell">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canEdit || locked || !EDITABLE_ROLES.includes(role)}
                            aria-label={`${ROLE_LABELS[role]} — ${PERMISSION_LABELS[permission]}`}
                            onChange={() => togglePermission(role, permission)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
