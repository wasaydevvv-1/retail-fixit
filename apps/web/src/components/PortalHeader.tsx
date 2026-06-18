import { Permission } from '@retailfixit/shared';
import { Link, useLocation } from 'react-router-dom';

import { pageMetaForPath } from '../lib/portal-config.js';
import { useDocumentTitle } from '../lib/use-document-title.js';
import { useAuth } from '../features/auth/AuthProvider.js';

export function PortalHeader() {
  const { pathname } = useLocation();
  const { can } = useAuth();
  const meta = pageMetaForPath(pathname);
  useDocumentTitle(meta.title);
  const isJobDetail = /\/jobs\/[^/]+$/.test(pathname) && !pathname.endsWith('/new');

  return (
    <header className="rf-topbar">
      <div className="rf-topbar-title">
        {isJobDetail && (
          <Link to={pathname.replace(/\/[^/]+$/, '')} className="rf-back-btn" aria-label="Back">
            ←
          </Link>
        )}
        <div>
          {meta.eyebrow && <span className="rf-topbar-eyebrow">{meta.eyebrow}</span>}
          <h1>{meta.title}</h1>
        </div>
      </div>

      <div className="rf-topbar-actions">
        {can(Permission.JobsCreate) && (
          <Link to="/dispatch/jobs/new" className="btn-rf btn-rf--primary">
            <span aria-hidden>+</span> Create job
          </Link>
        )}
      </div>
    </header>
  );
}
