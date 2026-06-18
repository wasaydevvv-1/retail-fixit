import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './AuthProvider.js';
import { isEntraConfiguredOnWeb } from './auth-config.js';
import { ApiClientError } from '../../lib/api-client.js';
import { friendlyUserMessage } from '../../lib/user-messages.js';
import { useDocumentTitle } from '../../lib/use-document-title.js';

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function LoginPage() {
  const { user, mode, devUsers, loginWithEntra, loginWithDevUser, isLoading } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useDocumentTitle('Sign in');

  if (!isLoading && user) {
    return <Navigate to={(location.state as { from?: string } | null)?.from ?? user.homePath} replace />;
  }

  async function handleEntraLogin() {
    setError(null);
    setPending(true);
    try {
      await loginWithEntra();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? friendlyUserMessage(err.message)
          : err instanceof Error
            ? friendlyUserMessage(err.message)
            : 'Sign-in failed. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  async function handleDevLogin(userId: string) {
    setError(null);
    setPending(true);
    try {
      await loginWithDevUser(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setPending(false);
    }
  }

  const entraReady = mode === 'entra' && isEntraConfiguredOnWeb();

  return (
    <main className="rf-login-page">
      <div className="rf-login-backdrop" aria-hidden>
        <div className="rf-login-glow rf-login-glow--left" />
        <div className="rf-login-glow rf-login-glow--right" />
        <div className="rf-login-grid" />
      </div>

      <div className="rf-login-shell">
        <section className="rf-login-hero" aria-hidden>
          <p className="rf-login-eyebrow">Retail operations</p>
          <h2>Dispatch smarter with AI-assisted vendor matching</h2>
          <p className="rf-login-lede">
            Track jobs, assign vendors, and keep stores running — all in one place.
          </p>

          <ul className="rf-login-features">
            <li>
              <span className="rf-login-feature-icon" aria-hidden>✦</span>
              <div>
                <strong>AI recommendations</strong>
                <span>Ranked vendor picks for every job</span>
              </div>
            </li>
            <li>
              <span className="rf-login-feature-icon" aria-hidden>▣</span>
              <div>
                <strong>Live dispatch board</strong>
                <span>Real-time updates as work moves</span>
              </div>
            </li>
            <li>
              <span className="rf-login-feature-icon" aria-hidden>◎</span>
              <div>
                <strong>Multi-store ready</strong>
                <span>Separate tenants for each retail brand</span>
              </div>
            </li>
          </ul>
        </section>

        <div className="rf-login-card rf-login-card--elevated">
          <div className="rf-login-brand">
            <div className="rf-brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <div>
              <strong>RetailFixIt</strong>
              <span>Operations platform</span>
            </div>
          </div>

          <header className="rf-login-header">
            <h1>Welcome back</h1>
            <p className="rf-login-subtitle">Sign in with your work Microsoft account to continue.</p>
          </header>

          {mode === 'loading' && (
            <div className="rf-login-loading">
              <div className="rf-spinner" aria-hidden />
              <p>Preparing sign-in…</p>
            </div>
          )}

          {entraReady && (
            <button
              type="button"
              className="rf-ms-signin-btn"
              disabled={pending}
              onClick={() => void handleEntraLogin()}
            >
              <MicrosoftIcon />
              <span>{pending ? 'Signing in…' : 'Sign in with Microsoft'}</span>
            </button>
          )}

          {mode === 'entra' && !isEntraConfiguredOnWeb() && (
            <div className="rf-login-alert rf-login-alert--error">
              Sign-in is not set up yet. Contact your administrator.
            </div>
          )}

          {mode === 'dev' && devUsers.length === 0 && (
            <p className="rf-login-footnote">
              Local development mode.{' '}
              <Link to="/register/vendor">Register a vendor account</Link>
            </p>
          )}

          {mode === 'dev' && devUsers.length > 0 && (
            <div className="rf-dev-users">
              <p className="rf-login-footnote">Local development — choose a test account</p>
              <div className="rf-dev-users-list">
                {devUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="rf-dev-user-btn"
                    disabled={pending}
                    onClick={() => void handleDevLogin(u.id)}
                  >
                    <span>{u.displayName}</span>
                    <span className="rf-dev-user-role">{u.roles.join(', ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rf-login-alert rf-login-alert--error" role="alert">
              {error}
            </div>
          )}

          {/* {entraReady && (
            // <footer className="rf-login-footer">
            //   <p>
            //     Vendors can{' '}
            //     <Link to="/register/vendor">register their company</Link> without an admin invite.
            //   </p>
            // </footer>
          )} */}
        </div>
      </div>
    </main>
  );
}
