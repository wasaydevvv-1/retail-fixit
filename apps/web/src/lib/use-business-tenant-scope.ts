import { useState } from 'react';

import { useAuth } from '../features/auth/AuthProvider.js';
import { useTenants } from '../features/admin/hooks/useTenants.js';

const DEFAULT_BUSINESS_TENANT = 'tenant_acme';

/** Platform operators pick a business tenant; everyone else uses their own. */
export function useBusinessTenantScope() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin ?? false;
  const { data: tenants } = useTenants(isPlatformAdmin);
  const [selectedTenantId, setSelectedTenantId] = useState(DEFAULT_BUSINESS_TENANT);

  const tenantId = isPlatformAdmin ? selectedTenantId : (user?.tenantId ?? DEFAULT_BUSINESS_TENANT);

  return {
    isPlatformAdmin,
    tenantId,
    selectedTenantId,
    setSelectedTenantId,
    tenants,
  };
}
