import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { VendorRegisterRequest, VendorRegisterResponse, VendorRegistrationConfigResponse } from '@retailfixit/shared';

import { ErrorAlert } from '../../components/ErrorAlert.js';
import { apiFetch } from '../../lib/api-client.js';
import { friendlyError, friendlyUserMessage } from '../../lib/user-messages.js';

export function VendorRegisterPage() {
  const [config, setConfig] = useState<VendorRegistrationConfigResponse | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<VendorRegisterResponse | null>(null);

  useEffect(() => {
    void apiFetch<VendorRegistrationConfigResponse>('/auth/register/vendor/config')
      .then(setConfig)
      .catch(() => setConfig({ enabled: false, mode: 'entra' }));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !userName.trim()) {
      setError('Display name and username are required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: VendorRegisterRequest = {
        displayName: displayName.trim(),
        userName: userName.trim(),
        password: autoPassword ? undefined : password,
      };
      const result = await apiFetch<VendorRegisterResponse>('/auth/register/vendor', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setCreated(result);
    } catch (err) {
      setError(friendlyError(err, 'Registration failed'));
    } finally {
      setSaving(false);
    }
  }

  const domain = config?.entra?.defaultDomain ?? 'yourtenant.onmicrosoft.com';
  const canRegister = config?.enabled && (config.mode === 'dev' || config.entra?.canCreateUsers);

  if (created) {
    return (
      <main className="rf-login-page rf-login-page--solo">
        <div className="rf-login-backdrop" aria-hidden>
          <div className="rf-login-glow rf-login-glow--left" />
          <div className="rf-login-glow rf-login-glow--right" />
        </div>
        <div className="rf-login-shell">
          <div className="rf-login-card rf-login-card--elevated rf-login-card--wide">
          <header className="rf-form-header">
            <h1>Account created</h1>
            <p>
              {config?.mode === 'entra'
                ? 'Sign in with Microsoft using the credentials below, then complete your company profile.'
                : 'Use the dev login picker and select your new account, then complete your company profile.'}
            </p>
          </header>

          {created.entraAssignedRole && (
            <p className="rf-form-note rf-form-note--ok">
              Role assigned: <strong>{created.entraAssignedRole}</strong>
            </p>
          )}
          {created.entraAssignmentWarning && (
            <p className="rf-form-note rf-form-note--warn">
              {friendlyUserMessage(created.entraAssignmentWarning)}
            </p>
          )}

          {created.userPrincipalName && created.temporaryPassword && (
            <div className="rf-credential-grid">
              <div className="rf-credential-item">
                <span>Sign-in email</span>
                <code>{created.userPrincipalName}</code>
              </div>
              <div className="rf-credential-item">
                <span>Temporary password</span>
                <code>{created.temporaryPassword}</code>
              </div>
            </div>
          )}

          {created.devUserId && (
            <p className="rf-form-note rf-form-note--ok">
              Test account ready — choose <strong>{created.displayName}</strong> on the sign-in page.
            </p>
          )}

          <div className="rf-form-actions">
            <Link to="/login" className="btn-rf btn-rf--primary">
              Go to sign in
            </Link>
          </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="rf-login-page">
      <div className="rf-login-backdrop" aria-hidden>
        <div className="rf-login-glow rf-login-glow--left" />
        <div className="rf-login-glow rf-login-glow--right" />
        <div className="rf-login-grid" />
      </div>

      <div className="rf-login-shell">
        <section className="rf-login-hero" aria-hidden>
          <p className="rf-login-eyebrow">Vendor network</p>
          <h2>Join the RetailFixIt vendor network</h2>
          <p className="rf-login-lede">
            Register your company, set skills and coverage areas, and receive assigned jobs.
          </p>
        </section>

        <div className="rf-login-card rf-login-card--elevated rf-login-card--wide">
        <div className="rf-login-brand">
          <div className="rf-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div>
            <strong>RetailFixIt</strong>
            <span>Vendor registration</span>
          </div>
        </div>

        <header className="rf-form-header">
          <h1>Register your company</h1>
          <p>Create your vendor manager account — no admin invite required.</p>
        </header>

        {!config && <p>Loading registration options…</p>}

        {config && !canRegister && (
          <p className="rf-form-note rf-form-note--warn">
            {config.entra?.message
              ? friendlyUserMessage(config.entra.message)
              : 'Self-registration is not available. Ask an administrator to add you.'}
          </p>
        )}

        {config && canRegister && (
          <form className="rf-form-panel rf-form-panel--flat" onSubmit={(e) => void handleSubmit(e)}>
            <section className="rf-form-section rf-form-section--flat">
              <label className="rf-field">
                <span>Your name</span>
                <input
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Vendor"
                />
              </label>

              {config.mode === 'entra' ? (
                <label className="rf-field rf-field--upn">
                  <span>Username</span>
                  <div className="rf-upn-row">
                    <input
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                      placeholder="jane"
                    />
                    <span className="rf-upn-domain" title={domain}>
                      @{domain}
                    </span>
                  </div>
                </label>
              ) : (
                <label className="rf-field">
                  <span>Username</span>
                  <input
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                    placeholder="jane"
                  />
                  <span className="rf-field-hint">For local testing — account appears on the sign-in page.</span>
                </label>
              )}

              {config.mode === 'entra' && (
                <>
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
                </>
              )}
            </section>

            {error && <ErrorAlert error={new Error(error)} title="Registration failed" />}

            <div className="rf-form-actions rf-form-actions--flat">
              <Link to="/login" className="btn-rf btn-rf--ghost">
                Back to sign in
              </Link>
              <button type="submit" className="btn-rf btn-rf--primary" disabled={saving}>
                {saving ? 'Creating account…' : 'Create vendor account'}
              </button>
            </div>
          </form>
        )}

        <p className="hint" style={{ marginTop: '1rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        </div>
      </div>
    </main>
  );
}
