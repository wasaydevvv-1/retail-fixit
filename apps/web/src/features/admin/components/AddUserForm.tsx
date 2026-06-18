import { useEffect, useState, type FormEvent } from 'react';
import {
  UserRole,
  assignableRolesForManager,
  type CreateTenantUserRequest,
  type CreateTenantUserResponse,
  type EntraConfigResponse,
  type TenantUserSummary,
  type UserRole as UserRoleType,
} from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { friendlyError, friendlyUserMessage } from '../../../lib/user-messages.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { useTenants } from '../hooks/useTenants.js';
import { apiFetch } from '../../../lib/api-client.js';

const ROLE_DESCRIPTIONS: Record<UserRoleType, string> = {
  [UserRole.PlatformAdmin]: 'Cross-tenant operator',
  [UserRole.Admin]: 'Manage users and settings for this tenant',
  [UserRole.Dispatcher]: 'Create and assign jobs',
  [UserRole.VendorManager]: 'Manage vendor company',
  [UserRole.SupportAgent]: 'Read-only job lookup',
};

interface AddUserFormProps {
  onCreated: (user: TenantUserSummary) => void;
}

export function AddUserForm({ onCreated }: AddUserFormProps) {
  const { user } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;
  const assignableRoles = assignableRolesForManager(user?.roles ?? []);
  const roleOptions = assignableRoles.map((value) => ({
    value,
    label:
      value === UserRole.Admin
        ? 'Tenant admin'
        : value === UserRole.Dispatcher
          ? 'Dispatcher'
          : value === UserRole.VendorManager
            ? 'Vendor manager'
            : 'Support agent',
    description: ROLE_DESCRIPTIONS[value],
  }));
  const defaultRole = assignableRoles[0] ?? UserRole.Dispatcher;

  const { data: tenants } = useTenants(isPlatformAdmin);
  const [open, setOpen] = useState(false);
  const [tenantId, setTenantId] = useState(
    isPlatformAdmin ? 'tenant_acme' : (user?.tenantId ?? 'tenant_acme'),
  );
  const [entraConfig, setEntraConfig] = useState<EntraConfigResponse | null>(null);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRoleType>(defaultRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<CreateTenantUserResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    void apiFetch<EntraConfigResponse>('/users/entra-config')
      .then(setEntraConfig)
      .catch(() => setEntraConfig({ graphEnabled: false, canCreateUsers: false }));
  }, [open]);

  useEffect(() => {
    setRole(defaultRole);
  }, [defaultRole]);

  function reset() {
    setUserName('');
    setPassword('');
    setAutoPassword(true);
    setDisplayName('');
    setRole(defaultRole);
    setTenantId(isPlatformAdmin ? 'tenant_acme' : (user?.tenantId ?? 'tenant_acme'));
    setError(null);
    setCreatedCredentials(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userName.trim() || !displayName.trim()) {
      setError('Display name and username are required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: CreateTenantUserRequest = {
        displayName: displayName.trim(),
        roles: [role],
        createInEntra: true,
        userName: userName.trim(),
        password: autoPassword ? undefined : password,
        ...(isPlatformAdmin ? { tenantId } : {}),
      };

      const created = await apiFetch<CreateTenantUserResponse>('/users', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (created.temporaryPassword) {
        setCreatedCredentials(created);
        onCreated(created);
      } else {
        reset();
        setOpen(false);
        onCreated(created);
      }
    } catch (err) {
      setError(friendlyError(err, 'Could not add user'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="rf-add-user-closed">
        <button type="button" className="btn-rf btn-rf--primary" onClick={() => setOpen(true)}>
          + Add user
        </button>
      </div>
    );
  }

  if (createdCredentials?.temporaryPassword) {
    return (
      <div className="rf-form-panel rf-form-panel--success">
        <header className="rf-form-header">
          <h3>User created</h3>
          <p>Share these credentials with {createdCredentials.displayName}.</p>
        </header>

        {createdCredentials.entraAssignedRole && (
          <p className="rf-form-note rf-form-note--ok">
            Microsoft role assigned: <strong>{createdCredentials.entraAssignedRole}</strong>
          </p>
        )}
        {createdCredentials.entraAssignmentWarning && (
          <p className="rf-form-note rf-form-note--warn">
            {friendlyUserMessage(createdCredentials.entraAssignmentWarning)}
          </p>
        )}

        <div className="rf-credential-grid">
          <div className="rf-credential-item">
            <span>Sign-in email</span>
            <code>{createdCredentials.userPrincipalName}</code>
          </div>
          <div className="rf-credential-item">
            <span>Temporary password</span>
            <code>{createdCredentials.temporaryPassword}</code>
          </div>
        </div>

        <div className="rf-form-actions">
          <button
            type="button"
            className="btn-rf btn-rf--primary"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const domain = entraConfig?.defaultDomain ?? 'yourtenant.onmicrosoft.com';
  const canCreate = entraConfig?.canCreateUsers ?? false;

  return (
    <form className="rf-form-panel" onSubmit={(e) => void handleSubmit(e)}>
      <header className="rf-form-header">
        <h3>Add user</h3>
        <p>
          {isPlatformAdmin
            ? 'Provision a tenant admin for Acme or Beta.'
            : 'Create dispatcher, vendor manager, or support agent staff for your tenant.'}
        </p>
      </header>

      {!canCreate && (
        <p className="rf-form-note rf-form-note--warn">
          {entraConfig?.message
            ? friendlyUserMessage(entraConfig.message)
            : 'New accounts cannot be created right now. Contact your platform administrator.'}
        </p>
      )}

      {isPlatformAdmin ? (
        <section className="rf-form-section">
          <h4>Business tenant</h4>
          <label className="rf-field">
            <span>Tenant</span>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
              {(tenants ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <p className="rf-field-hint">Platform operators provision tenant admins only.</p>
        </section>
      ) : (
        <section className="rf-form-section">
          <h4>Tenant</h4>
          <p className="rf-field-hint">
            New users join <strong>{user?.tenantName ?? user?.tenantId}</strong> only.
          </p>
        </section>
      )}

      <section className="rf-form-section">
        <h4>Account</h4>
        <div className="rf-form-grid">
          <label className="rf-field">
            <span>Display name</span>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Agent"
            />
          </label>

          <label className="rf-field rf-field--upn">
            <span>Username</span>
            <div className="rf-upn-row">
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                placeholder="john"
              />
              <span className="rf-upn-domain" title={domain}>
                @{domain}
              </span>
            </div>
          </label>
        </div>

        <label className="rf-check">
          <input
            type="checkbox"
            checked={autoPassword}
            onChange={(e) => setAutoPassword(e.target.checked)}
          />
          <span>Auto-generate secure password</span>
        </label>

        {!autoPassword && (
          <label className="rf-field">
            <span>Password</span>
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </label>
        )}
      </section>

      <section className="rf-form-section">
        <h4>Role</h4>
        <p className="rf-field-hint">One role per user.</p>
        <div className="rf-role-grid">
          {roleOptions.map((option) => (
            <label
              key={option.value}
              className={`rf-role-card${role === option.value ? ' rf-role-card--active' : ''}`}
            >
              <input
                type="radio"
                name="add-user-role"
                checked={role === option.value}
                onChange={() => setRole(option.value)}
              />
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </label>
          ))}
        </div>
      </section>

      {error && <ErrorAlert error={new Error(error)} title="Could not add user" />}

      <div className="rf-form-actions">
        <button
          type="button"
          className="btn-rf btn-rf--ghost"
          disabled={saving}
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </button>
        <button type="submit" className="btn-rf btn-rf--primary" disabled={saving || !canCreate}>
          {saving ? 'Creating…' : 'Create account'}
        </button>
      </div>
    </form>
  );
}
