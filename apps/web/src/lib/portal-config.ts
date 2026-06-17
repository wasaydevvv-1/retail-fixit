import { Permission, UserRole, type AuthUserResponse } from '@retailfixit/shared';

export type NavIconName =
  | 'overview'
  | 'users'
  | 'roles'
  | 'dispatch'
  | 'lookup'
  | 'vendors'
  | 'vendorJobs'
  | 'profile'
  | 'observability'
  | 'tenants';

export interface PortalNavItem {
  id: string;
  label: string;
  path: string;
  icon: NavIconName;
  /** When true, only highlight on exact path (not child routes). */
  end?: boolean;
  /** User needs at least one of these permissions to navigate. */
  permissions: Permission[];
  /** Extra gate beyond permissions (e.g. vendor-only routes). */
  isAvailable?: (user: AuthUserResponse) => boolean;
}

/** Full sidebar catalog — every item is visible; unavailable items render disabled. */
export const NAV_CATALOG: PortalNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/admin',
    icon: 'overview',
    end: true,
    permissions: [Permission.UsersManage],
  },
  {
    id: 'tenants',
    label: 'Tenants',
    path: '/admin/tenants',
    icon: 'tenants',
    permissions: [Permission.TenantsRead],
    isAvailable: (user) => user.isPlatformAdmin,
  },
  {
    id: 'users',
    label: 'Users & access',
    path: '/admin/users',
    icon: 'users',
    permissions: [Permission.UsersRead],
  },
  {
    id: 'roles',
    label: 'Roles & permissions',
    path: '/admin/roles',
    icon: 'roles',
    permissions: [Permission.UsersManage],
  },
  {
    id: 'observability',
    label: 'System health',
    path: '/admin/observability',
    icon: 'observability',
    permissions: [Permission.UsersManage],
  },
  {
    id: 'dispatch',
    label: 'Dispatch board',
    path: '/dispatch/jobs',
    icon: 'dispatch',
    permissions: [Permission.JobsCreate, Permission.JobsAssign, Permission.JobsRead],
    isAvailable: (user) =>
      user.permissions.includes(Permission.JobsCreate) ||
      user.permissions.includes(Permission.JobsAssign),
  },
  {
    id: 'lookup',
    label: 'Job lookup',
    path: '/support/jobs',
    icon: 'lookup',
    permissions: [Permission.JobsRead],
    isAvailable: (user) =>
      !user.permissions.includes(Permission.JobsCreate) &&
      !user.permissions.includes(Permission.JobsAssign),
  },
  {
    id: 'vendor-directory',
    label: 'Vendor network',
    path: '/vendor/directory',
    icon: 'vendors',
    permissions: [Permission.VendorsRead],
  },
  {
    id: 'vendor-jobs',
    label: 'My assigned jobs',
    path: '/vendor/jobs',
    icon: 'vendorJobs',
    permissions: [Permission.VendorsRead],
    isAvailable: (user) =>
      user.roles.includes(UserRole.VendorManager) || Boolean(user.vendorId),
  },
  {
    id: 'vendor-profile',
    label: 'Company profile',
    path: '/vendor/profile',
    icon: 'profile',
    permissions: [Permission.VendorsCreate, Permission.VendorsRead],
    isAvailable: (user) => {
      const isVendor =
        user.roles.includes(UserRole.VendorManager) || Boolean(user.vendorId);
      const onboarding =
        user.needsVendorProfile && user.roles.includes(UserRole.VendorManager);
      return isVendor || onboarding;
    },
  },
];

export interface ResolvedNavItem extends Omit<PortalNavItem, 'permissions' | 'isAvailable'> {
  enabled: boolean;
  lockReason?: string;
}

function hasAnyPermission(user: AuthUserResponse, permissions: Permission[]): boolean {
  return permissions.some((p) => user.permissions.includes(p));
}

/** Same enablement logic as the sidebar — single source of truth for route guards. */
export function isNavItemEnabled(user: AuthUserResponse, navId: string): boolean {
  const item = NAV_CATALOG.find((n) => n.id === navId);
  if (!item) return false;

  const hasPerm = hasAnyPermission(user, item.permissions);
  const passesGate = item.isAvailable ? item.isAvailable(user) : true;
  return hasPerm && passesGate;
}

export function navItemsForUser(user: AuthUserResponse): ResolvedNavItem[] {
  return NAV_CATALOG.map((item) => {
    const hasPerm = hasAnyPermission(user, item.permissions);
    const passesGate = item.isAvailable ? item.isAvailable(user) : true;
    const enabled = hasPerm && passesGate;

    let lockReason: string | undefined;
    if (!hasPerm) {
      lockReason = 'Your role does not include access to this module';
    } else if (!passesGate) {
      lockReason = 'Not available for your account type';
    }

    return {
      id: item.id,
      label: item.label,
      path: item.path,
      icon: item.icon,
      end: item.end,
      enabled,
      lockReason,
    };
  });
}

export interface PageMeta {
  title: string;
  eyebrow?: string;
  lede?: string;
}

export function pageMetaForPath(pathname: string): PageMeta {
  if (pathname.startsWith('/admin/tenants')) {
    return {
      title: 'Tenants',
      eyebrow: 'Platform',
      lede: 'Business tenants and tenant admin provisioning.',
    };
  }
  if (pathname.startsWith('/admin/users')) {
    return {
      title: 'Users & access',
      eyebrow: 'Administration',
      lede: 'Manage staff accounts, sign-in details, and roles.',
    };
  }
  if (pathname.startsWith('/admin/roles')) {
    return {
      title: 'Roles & permissions',
      eyebrow: 'Administration',
      lede: 'Choose what each role is allowed to do in the application.',
    };
  }
  if (pathname.startsWith('/admin/observability')) {
    return {
      title: 'System health',
      eyebrow: 'Administration',
      lede: 'Live platform activity and monitoring status for your tenant.',
    };
  }
  if (pathname === '/admin') {
    return {
      title: 'Admin overview',
      eyebrow: 'Command center',
      lede: 'Tenant health, access control, and operational modules.',
    };
  }
  if (pathname.includes('/jobs/new')) {
    return { title: 'Create job', eyebrow: 'Dispatch' };
  }
  if (pathname.match(/\/dispatch\/jobs\/[^/]+/)) {
    return { title: 'Job detail', eyebrow: 'Dispatch' };
  }
  if (pathname.startsWith('/dispatch')) {
    return {
      title: 'Dispatch board',
      eyebrow: 'Operations',
      lede: 'Track dispatch work, AI recommendations, and vendor assignments.',
    };
  }
  if (pathname.match(/\/support\/jobs\/[^/]+/)) {
    return { title: 'Job detail', eyebrow: 'Support' };
  }
  if (pathname.startsWith('/support')) {
    return {
      title: 'Job lookup center',
      eyebrow: 'Support',
      lede: 'Read-only job search for support agents. Access is view-only.',
    };
  }
  if (pathname.startsWith('/vendor/directory')) {
    return {
      title: 'Vendor network',
      eyebrow: 'Directory',
      lede: 'Browse service companies, skills, coverage areas, and quality ratings.',
    };
  }
  if (pathname.startsWith('/vendor/profile')) {
    return { title: 'Company profile', eyebrow: 'Vendor' };
  }
  if (pathname.startsWith('/vendor/jobs')) {
    return { title: 'My assigned jobs', eyebrow: 'Vendor' };
  }
  return { title: 'RetailFixIt', eyebrow: 'Operations' };
}
