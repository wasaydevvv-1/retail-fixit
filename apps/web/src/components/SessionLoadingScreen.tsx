export function SessionLoadingScreen() {
  return (
    <main className="rf-session-loading" aria-live="polite" aria-busy="true">
      <div className="rf-login-backdrop" aria-hidden>
        <div className="rf-login-glow rf-login-glow--left" />
        <div className="rf-login-glow rf-login-glow--right" />
        <div className="rf-login-grid" />
      </div>

      <div className="rf-session-loading-card">
        <div className="rf-brand-icon rf-session-loading-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div className="rf-spinner rf-spinner--lg" aria-hidden />
        <p className="rf-session-loading-text">Checking your session…</p>
      </div>
    </main>
  );
}
