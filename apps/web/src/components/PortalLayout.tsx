import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthProvider.js';
import { useRealtimeJobs } from '../features/realtime/useRealtimeJobs.js';
import { queryKeys } from '../lib/query-keys.js';
import { vendorQueryKeys } from '../features/vendors/hooks/useVendorProfile.js';
import { PortalHeader } from './PortalHeader.js';
import { PortalSidebar } from './PortalSidebar.js';
import { VendorOnboardingGuard } from './VendorOnboardingGuard.js';

export function PortalLayout() {
  const { user, logout, claimAdmin, loadCurrentUser } = useAuth();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [flashJobId, setFlashJobId] = useState<string | null>(null);

  useRealtimeJobs(
    (event) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      void queryClient.invalidateQueries({ queryKey: ['vendors', 'my-jobs'] });
      if (event.jobId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(event.jobId) });
        void queryClient.invalidateQueries({ queryKey: vendorQueryKeys.myJob(event.jobId) });
        setFlashJobId(event.jobId);
        setTimeout(() => setFlashJobId(null), 2400);
      }
    },
    Boolean(user),
    () => setRealtimeConnected(true),
  );

  return (
    <div className="rf-shell">
      <PortalSidebar realtimeConnected={realtimeConnected} onLogout={() => void logout()} />

      <div className="rf-main-column">
        <PortalHeader />

        <main className="rf-main">
          {user?.canClaimAdmin && (
            <div className="rf-banner rf-banner--info">
              <div>
                <strong>No tenant administrator configured</strong>
                <p>Claim admin access once to unlock user management and role configuration.</p>
              </div>
              <button
                type="button"
                className="btn-rf btn-rf--primary"
                disabled={claiming}
                onClick={() => {
                  setClaiming(true);
                  void claimAdmin()
                    .then(() => loadCurrentUser())
                    .finally(() => setClaiming(false));
                }}
              >
                {claiming ? 'Claiming…' : 'Claim admin'}
              </button>
            </div>
          )}
          <VendorOnboardingGuard>
            <Outlet context={{ flashJobId }} />
          </VendorOnboardingGuard>
        </main>
      </div>
    </div>
  );
}
