import { Permission } from '@retailfixit/shared';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.js';
import { useJobs } from '../../jobs/hooks/useJobs.js';
import { useVendorDirectory } from '../../vendors/hooks/useVendorProfile.js';

export function AdminHomePage() {
  const { user, can } = useAuth();
  const { data: jobsData } = useJobs({ page: 1, pageSize: 1 });
  const { data: vendorsData } = useVendorDirectory(1);

  const totalJobs = jobsData?.total ?? '—';
  const totalVendors = vendorsData?.total ?? '—';

  return (
    <div className="rf-page">
      <p className="hint rf-page-lede">
        Tenant health, access control, and operational modules for {user?.tenantName}.
      </p>

      <div className="rf-kpi-grid">
        <article className="rf-kpi-card">
          <span className="rf-kpi-label">Total jobs</span>
          <strong className="rf-kpi-value">{totalJobs}</strong>
          <span className="rf-kpi-trend rf-kpi-trend--up">Active pipeline</span>
        </article>
        <article className="rf-kpi-card">
          <span className="rf-kpi-label">Active vendors</span>
          <strong className="rf-kpi-value">{totalVendors}</strong>
          <span className="rf-kpi-trend">Directory</span>
        </article>
        <article className="rf-kpi-card">
          <span className="rf-kpi-label">AI recommendations</span>
          <strong className="rf-kpi-value">Active</strong>
          <span className="rf-kpi-trend rf-kpi-trend--up">Vendor matching</span>
        </article>
        <article className="rf-kpi-card">
          <span className="rf-kpi-label">Live updates</span>
          <strong className="rf-kpi-value">On</strong>
          <span className="rf-kpi-trend rf-kpi-trend--up">Real-time board</span>
        </article>
      </div>

      <div className="rf-admin-grid">
        <section className="rf-panel">
          <h2>System insights</h2>
          <p className="hint">
            RetailFixIt uses an event-driven pipeline: job created → AI vendor recommendation →
            dispatcher assignment → realtime dashboard update.
          </p>
          <ul className="rf-insight-list">
            <li>Roles are managed here; Microsoft sign-in handles authentication.</li>
            <li>Vendor managers complete company profiles before receiving assigned work.</li>
            <li>Support agents have read-only job lookup — no dispatch or assignment.</li>
          </ul>
        </section>

        <section className="rf-panel">
          <h2>Quick modules</h2>
          <div className="rf-quick-grid">
            {can(Permission.UsersRead) && (
              <Link to="/admin/users" className="rf-quick-card">
                <span className="rf-quick-icon">◎</span>
                <div>
                  <strong>Users & access</strong>
                  <p>Staff accounts and roles</p>
                </div>
              </Link>
            )}
            {can(Permission.UsersManage) && (
              <Link to="/admin/roles" className="rf-quick-card">
                <span className="rf-quick-icon">▧</span>
                <div>
                  <strong>Role permissions</strong>
                  <p>What each role can do</p>
                </div>
              </Link>
            )}
            {can(Permission.UsersManage) && (
              <Link to="/admin/observability" className="rf-quick-card">
                <span className="rf-quick-icon">◫</span>
                <div>
                  <strong>System health</strong>
                  <p>Activity and monitoring</p>
                </div>
              </Link>
            )}
            {can(Permission.JobsRead) &&
              (can(Permission.JobsCreate) || can(Permission.JobsAssign)) && (
                <Link to="/dispatch/jobs" className="rf-quick-card">
                  <span className="rf-quick-icon">▣</span>
                  <div>
                    <strong>Dispatch board</strong>
                    <p>Jobs, AI, assignments</p>
                  </div>
                </Link>
              )}
            {can(Permission.VendorsRead) && (
              <Link to="/vendor/directory" className="rf-quick-card">
                <span className="rf-quick-icon">▥</span>
                <div>
                  <strong>Vendor network</strong>
                  <p>Service companies</p>
                </div>
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
