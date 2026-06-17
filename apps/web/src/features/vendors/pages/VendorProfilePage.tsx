import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { VendorProfileRequest } from '@retailfixit/shared';
import { parseSkillList } from '@retailfixit/shared';

import { ErrorAlert } from '../../../components/ErrorAlert.js';
import { useToast } from '../../../components/ToastProvider.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { useMyVendorProfile, useSaveVendorProfile } from '../hooks/useVendorProfile.js';

const empty: VendorProfileRequest = {
  name: '',
  skills: [],
  serviceAreas: [],
};

export function VendorProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loadCurrentUser } = useAuth();
  const { data, isLoading } = useMyVendorProfile();
  const save = useSaveVendorProfile();
  const [form, setForm] = useState<VendorProfileRequest>(empty);
  const [skillsInput, setSkillsInput] = useState('');
  const [areasInput, setAreasInput] = useState('');
  const isOnboarding = Boolean(user?.needsVendorProfile);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        skills: data.skills,
        serviceAreas: data.serviceAreas,
      });
      setSkillsInput(data.skills.join(', '));
      setAreasInput(data.serviceAreas.join(', '));
    }
  }, [data]);

  function handleSkillsChange(value: string) {
    setSkillsInput(value.replace(/\s+/g, '_'));
  }

  function handleAreasChange(value: string) {
    setAreasInput(value.replace(/\s+/g, '_'));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const skills = parseSkillList(skillsInput);
    const serviceAreas = parseSkillList(areasInput);
    save.mutate(
      { ...form, skills, serviceAreas },
      {
        onSuccess: async () => {
          await loadCurrentUser();
          if (isOnboarding) {
            toast('Company profile saved — you can now receive job assignments', 'success');
            navigate('/vendor/jobs');
          } else {
            toast('Company profile updated', 'success');
          }
        },
      },
    );
  }

  return (
    <div className="rf-page">
      <form className="rf-form-panel rf-form-panel--wide" onSubmit={handleSubmit}>
        <header className="rf-form-header">
          <h3>Company profile</h3>
          <p>
            {isOnboarding
              ? 'Tell dispatchers what your company does and where you operate. This is required before you can receive jobs.'
              : 'Update your company details used for AI vendor matching and job assignments.'}
          </p>
        </header>

        {isLoading ? (
          <p>Loading profile…</p>
        ) : (
          <>
            <section className="rf-form-section">
              <h4>Company</h4>
              <label className="rf-field">
                <span>Company name</span>
                <input
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. North Region HVAC Services"
                />
              </label>
            </section>

            <section className="rf-form-section">
              <h4>Capabilities</h4>
              <div className="rf-form-grid">
                <label className="rf-field">
                  <span>Skills</span>
                  <input
                    required
                    value={skillsInput}
                    onChange={(e) => handleSkillsChange(e.target.value)}
                    placeholder="hvac, electrical, fridge_repairing"
                  />
                  <span className="rf-field-hint">
                    Comma-separated. Use underscores — HVAC and hvac both match.
                  </span>
                </label>

                <label className="rf-field">
                  <span>Service areas</span>
                  <input
                    required
                    value={areasInput}
                    onChange={(e) => handleAreasChange(e.target.value)}
                    placeholder="north_region, east_wing, store_1044"
                  />
                  <span className="rf-field-hint">
                    Regions, sites, or zones where your team can work.
                  </span>
                </label>
              </div>
            </section>

            {!isOnboarding && data && (
              <p className="rf-form-note">
                Quality rating:{' '}
                {data.rating > 0 ? (
                  <strong>{data.rating.toFixed(1)} / 5</strong>
                ) : (
                  <strong>Not rated yet</strong>
                )}{' '}
                — set by support agents on the vendor network page.
              </p>
            )}

            {save.isError && <ErrorAlert error={save.error} title="Failed to save profile" />}

            <div className="rf-form-actions">
              {!isOnboarding && (
                <Link to="/vendor/jobs" className="btn-rf btn-rf--ghost">
                  Cancel
                </Link>
              )}
              <button type="submit" className="btn-rf btn-rf--primary" disabled={save.isPending}>
                {save.isPending
                  ? 'Saving…'
                  : isOnboarding
                    ? 'Save and continue'
                    : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
