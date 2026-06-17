import { NavLink } from 'react-router-dom';

import { navItemsForUser } from '../lib/portal-config.js';
import { portalSubtitle, primaryRoleLabel } from '../lib/role-labels.js';
import { useAuth } from '../features/auth/AuthProvider.js';
import { NavIcon } from './NavIcon.js';

interface PortalSidebarProps {
  realtimeConnected: boolean;
  onLogout: () => void;
}

export function PortalSidebar({ realtimeConnected, onLogout }: PortalSidebarProps) {
  const { user } = useAuth();
  if (!user) return null;

  const navItems = navItemsForUser(user);
  const subtitle = portalSubtitle(user.roles);
  const roleLabel = primaryRoleLabel(user.roles);

  return (
    <aside className="rf-sidebar">
      <div className="rf-brand">
        <div className="rf-brand-icon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div>
          <strong className="rf-brand-title">RetailFixIt</strong>
          <span className="rf-brand-sub">{subtitle}</span>
        </div>
      </div>

      <nav className="rf-nav" aria-label="Main navigation">
        {navItems.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `rf-nav-link${isActive ? ' rf-nav-link--active' : ''}`}
              title={item.label}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ) : (
            <span
              key={item.id}
              className="rf-nav-link rf-nav-link--disabled"
              title={item.lockReason}
              aria-disabled="true"
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              <span className="rf-nav-lock" aria-hidden>
                🔒
              </span>
            </span>
          ),
        )}
      </nav>

      <div className="rf-sidebar-footer">
        <div className={`rf-system-pill${realtimeConnected ? ' rf-system-pill--ok' : ''}`}>
          <span className="rf-system-dot" />
          {realtimeConnected ? 'Live updates on' : 'Connecting…'}
        </div>

        <div className="rf-user-card">
          <div className="rf-user-avatar" aria-hidden>
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="rf-user-meta">
            <strong>{user.displayName}</strong>
            <span>{roleLabel}</span>
          </div>
        </div>

        <button type="button" className="rf-signout" onClick={onLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
