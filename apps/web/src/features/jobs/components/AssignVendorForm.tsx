import { useEffect, useState } from 'react';
import type { AIRecommendation, Vendor } from '@retailfixit/shared';
import { JobStatus, Permission } from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useToast } from '../../../components/ToastProvider.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { useAssignJob } from '../hooks/useAssignJob.js';

const ASSIGNABLE_STATUSES: JobStatus[] = [
  JobStatus.Created,
  JobStatus.AwaitingRecommendation,
  JobStatus.RecommendationReady,
  JobStatus.Escalated,
];

interface AssignVendorFormProps {
  jobId: string;
  jobStatus: JobStatus;
  assignableVendors: Vendor[];
  recommendation?: AIRecommendation;
  assignedVendorName?: string;
}

export function AssignVendorForm({
  jobId,
  jobStatus,
  assignableVendors,
  recommendation,
  assignedVendorName,
}: AssignVendorFormProps) {
  const { can } = useAuth();
  const { toast } = useToast();
  const assign = useAssignJob(jobId);
  const topVendorId = recommendation?.candidates[0]?.vendorId;
  const [vendorId, setVendorId] = useState(topVendorId ?? assignableVendors[0]?.id ?? '');

  useEffect(() => {
    if (topVendorId) {
      setVendorId(topVendorId);
    } else if (!vendorId && assignableVendors[0]?.id) {
      setVendorId(assignableVendors[0].id);
    }
  }, [topVendorId, assignableVendors, vendorId]);

  const canAssign = can(Permission.JobsAssign) && ASSIGNABLE_STATUSES.includes(jobStatus);

  if (jobStatus === JobStatus.Assigned || jobStatus === JobStatus.InProgress) {
    return (
      <section className="rf-panel rf-assign-panel">
        <h3>Assignment</h3>
        <p className="rf-assign-success">
          ✓ This job is assigned to <strong>{assignedVendorName ?? 'vendor'}</strong>.
        </p>
      </section>
    );
  }

  if (!canAssign) {
    return null;
  }

  if (assignableVendors.length === 0) {
    return (
      <section className="rf-panel rf-assign-panel">
        <h3>Assign vendor</h3>
        <p className="hint">No active vendors available for assignment.</p>
      </section>
    );
  }

  const willOverrideAi = Boolean(topVendorId && vendorId && topVendorId !== vendorId);
  const selected = assignableVendors.find((v) => v.id === vendorId);

  return (
    <section className="rf-panel rf-assign-panel">
      <h3>Assign vendor</h3>
      <p className="hint">
        Select a service partner to fulfill this work order. AI recommendations are advisory —
        dispatchers may override.
      </p>

      {topVendorId && (
        <p className="rf-ai-pick">
          AI top pick: <strong>{recommendation?.candidates[0]?.vendorName ?? topVendorId}</strong>
        </p>
      )}

      <form
        className="rf-assign-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!vendorId) return;
          const vendorName =
            assignableVendors.find((v) => v.id === vendorId)?.name ?? 'Vendor';
          assign.mutate(
            { vendorId },
            {
              onSuccess: () => toast(`Assigned to ${vendorName}`, 'success'),
              onError: () => toast('Assignment failed', 'error'),
            },
          );
        }}
      >
        <label className="form-field">
          <span>Selected partner</span>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            disabled={assign.isPending}
            className="rf-select-lg"
          >
            {assignableVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.id === topVendorId ? ' (Recommended)' : ''} — {v.rating.toFixed(1)}★ ·{' '}
                {v.activeJobCount} active
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <p className="hint rf-muted">
            {selected.skills.join(', ') || 'No skills listed'} · {selected.serviceAreas.join(', ') || 'No areas'}
          </p>
        )}

        {willOverrideAi && (
          <p className="override-notice">You are overriding the AI&apos;s top recommendation.</p>
        )}

        {assign.isError && <ErrorAlert error={assign.error} title="Assignment failed" />}

        <button
          type="submit"
          className="btn-rf btn-rf--primary btn-rf--block"
          disabled={assign.isPending || !vendorId}
        >
          {assign.isPending ? 'Assigning…' : 'Assign vendor'}
        </button>
      </form>
    </section>
  );
}
