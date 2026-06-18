import type { UserRole } from '@retailfixit/shared';
import { ROLE_LABELS, UserRole as UserRoleEnum } from '@retailfixit/shared';

export interface TenantPickerOption {
  id: string;
  name: string;
}

interface BusinessTenantPickerProps {
  value: string;
  onChange: (tenantId: string) => void;
  tenants: TenantPickerOption[];
  label?: string;
  className?: string;
}

export function BusinessTenantPicker({
  value,
  onChange,
  tenants,
  label = 'Business tenant',
  className,
}: BusinessTenantPickerProps) {
  return (
    <label className={className ?? 'rf-field'}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {tenants.map((tenant) => (
          <option key={tenant.id || 'all'} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function formatRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export const USER_ROLE_FILTER_OPTIONS: { value: '' | UserRole; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: UserRoleEnum.Admin, label: ROLE_LABELS[UserRoleEnum.Admin] },
  { value: UserRoleEnum.Dispatcher, label: ROLE_LABELS[UserRoleEnum.Dispatcher] },
  { value: UserRoleEnum.VendorManager, label: ROLE_LABELS[UserRoleEnum.VendorManager] },
  { value: UserRoleEnum.SupportAgent, label: ROLE_LABELS[UserRoleEnum.SupportAgent] },
];
