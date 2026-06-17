import { useState, type FormEvent } from 'react';
import type { CreateJobRequest, JobPriority } from '@retailfixit/shared';
import { JobPriority as JobPriorityEnum, parseSkillList } from '@retailfixit/shared';
import { Link } from 'react-router-dom';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useCreateJob } from '../hooks/useCreateJob.js';

const PRIORITY_LABELS: Record<JobPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const PRIORITIES = Object.values(JobPriorityEnum);

const emptyForm: CreateJobRequest = {
  title: '',
  rawDescription: '',
  customerName: '',
  location: '',
  priority: JobPriorityEnum.Medium,
  requiredSkills: [],
};

export function CreateJobForm() {
  const create = useCreateJob();
  const [form, setForm] = useState<CreateJobRequest>(emptyForm);
  const [skillsInput, setSkillsInput] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const skills = parseSkillList(skillsInput);
    create.mutate({ ...form, requiredSkills: skills });
  }

  function handleSkillsChange(value: string) {
    setSkillsInput(value.replace(/\s+/g, '_'));
  }

  return (
    <form className="rf-form-panel rf-form-panel--wide" onSubmit={handleSubmit}>
      <header className="rf-form-header">
        <h3>New service job</h3>
        <p>
          AI will analyze the job and recommend vendors automatically after creation.
        </p>
      </header>

      <section className="rf-form-section">
        <h4>Job details</h4>
        <label className="rf-field">
          <span>Title</span>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. HVAC maintenance — Store #1044"
          />
        </label>

        <label className="rf-field">
          <span>Description</span>
          <textarea
            required
            rows={4}
            maxLength={5000}
            value={form.rawDescription}
            onChange={(e) => setForm({ ...form, rawDescription: e.target.value })}
            placeholder="Describe the issue reported by the customer…"
          />
        </label>
      </section>

      <section className="rf-form-section">
        <h4>Customer & location</h4>
        <div className="rf-form-grid">
          <label className="rf-field">
            <span>Customer name</span>
            <input
              required
              maxLength={200}
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="Store manager or contact"
            />
          </label>

          <label className="rf-field">
            <span>Location</span>
            <input
              required
              maxLength={500}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="City, state or site address"
            />
          </label>
        </div>
      </section>

      <section className="rf-form-section">
        <h4>Matching criteria</h4>
        <div className="rf-form-grid">
          <label className="rf-field">
            <span>Priority</span>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as JobPriority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="rf-field">
            <span>Required skills</span>
            <input
              value={skillsInput}
              onChange={(e) => handleSkillsChange(e.target.value)}
              placeholder="hvac, electrical, fridge_repairing"
            />
            <span className="rf-field-hint">
              Comma-separated. Use underscores — HVAC and hvac both match vendor skills.
            </span>
          </label>
        </div>
      </section>

      {create.isError && <ErrorAlert error={create.error} title="Failed to create job" />}

      <div className="rf-form-actions">
        <Link to="/dispatch/jobs" className="btn-rf btn-rf--ghost">
          Cancel
        </Link>
        <button type="submit" className="btn-rf btn-rf--primary" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create job'}
        </button>
      </div>
    </form>
  );
}
