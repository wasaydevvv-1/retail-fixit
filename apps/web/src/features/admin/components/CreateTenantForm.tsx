import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CreateTenantRequest, Tenant } from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { friendlyError } from '../../../lib/user-messages.js';
import { apiFetch } from '../../../lib/api-client.js';

interface CreateTenantFormProps {
  onCreated: (tenant: Tenant) => void;
}

export function CreateTenantForm({ onCreated }: CreateTenantFormProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tenant name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: CreateTenantRequest = { name: name.trim() };
      const tenant = await apiFetch<Tenant>('/tenants', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await queryClient.invalidateQueries({ queryKey: ['tenants'] });
      reset();
      setOpen(false);
      onCreated(tenant);
    } catch (err) {
      setError(friendlyError(err, 'Could not create tenant'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="rf-add-user-closed">
        <button type="button" className="btn-rf btn-rf--primary" onClick={() => setOpen(true)}>
          + Create tenant
        </button>
      </div>
    );
  }

  return (
    <form className="rf-form-panel" onSubmit={(e) => void handleSubmit(e)}>
      <header className="rf-form-header">
        <h3>Create business tenant</h3>
        <p>
          Add a new retail organization (like Acme or Beta). After creating the tenant, provision
          its tenant administrator from Users & access.
        </p>
      </header>

      <section className="rf-form-section">
        <label className="rf-field">
          <span>Tenant name</span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gamma Retail Co"
          />
        </label>
        <p className="rf-field-hint">
          A unique tenant id is generated automatically (for example, <code>tenant_gamma_retail_co</code>).
        </p>
      </section>

      {error && <ErrorAlert error={new Error(error)} title="Could not create tenant" />}

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
        <button type="submit" className="btn-rf btn-rf--primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create tenant'}
        </button>
      </div>
    </form>
  );
}
