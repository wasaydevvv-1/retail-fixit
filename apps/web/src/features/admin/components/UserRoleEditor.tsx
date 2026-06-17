import { useState } from 'react';
import { UserRole, type TenantUserSummary, type UserRole as UserRoleType } from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useToast } from '../../../components/ToastProvider.js';
import { friendlyError } from '../../../lib/user-messages.js';
import { apiFetch } from '../../../lib/api-client.js';

const ROLE_OPTIONS: { value: UserRoleType; label: string }[] = [
  { value: UserRole.Admin, label: 'Tenant administrator' },
  { value: UserRole.Dispatcher, label: 'Dispatcher' },
  { value: UserRole.VendorManager, label: 'Vendor manager' },
  { value: UserRole.SupportAgent, label: 'Support agent' },
];

interface UserRoleEditorProps {
  user: TenantUserSummary;
  onSaved: (updated: TenantUserSummary) => void;
}

export function UserRoleEditor({ user, onSaved }: UserRoleEditorProps) {
  const { toast } = useToast();
  const isPlatformUser = user.roles.includes(UserRole.PlatformAdmin);
  const [roles, setRoles] = useState<UserRoleType[]>(user.roles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPlatformUser) {
    return <span className="hint">This account type cannot be changed here.</span>;
  }

  const dirty =
    roles.length !== user.roles.length ||
    roles.some((role) => !user.roles.includes(role));

  function toggleRole(role: UserRoleType) {
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );
  }

  async function save() {
    if (roles.length === 0) {
      setError('Select at least one role');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<TenantUserSummary>(`/users/${user.id}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles }),
      });
      onSaved(updated);
      toast(`Roles updated for ${updated.displayName}`, 'success');
    } catch (err) {
      setError(friendlyError(err, 'Could not save roles'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="role-editor">
      <div className="role-editor-options">
        {ROLE_OPTIONS.map((option) => (
          <label key={option.value} className="role-chip">
            <input
              type="checkbox"
              checked={roles.includes(option.value)}
              onChange={() => toggleRole(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && <ErrorAlert error={new Error(error)} title="Role update failed" />}
      <button
        type="button"
        className="btn-secondary btn-inline"
        disabled={!dirty || saving}
        onClick={() => void save()}
      >
        {saving ? 'Saving…' : 'Save roles'}
      </button>
    </div>
  );
}
