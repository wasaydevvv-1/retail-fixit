import type { NavIconName } from '../lib/portal-config.js';

interface NavIconProps {
  name: NavIconName;
  className?: string;
}

export function NavIcon({ name, className = 'nav-svg' }: NavIconProps) {
  const props = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75 };

  switch (name) {
    case 'overview':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M16 11h5M18.5 8.5v5" />
        </svg>
      );
    case 'roles':
      return (
        <svg {...props}>
          <path d="M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'dispatch':
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h10M4 18h14" />
          <circle cx="19" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'lookup':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" />
        </svg>
      );
    case 'vendors':
      return (
        <svg {...props}>
          <path d="M3 9l9-5 9 5v10H3V9z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case 'vendorJobs':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20c1.5-3.5 4.5-5.5 7-5.5s5.5 2 7 5.5" />
        </svg>
      );
    case 'observability':
      return (
        <svg {...props}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15l3-4 3 2 4-6" />
        </svg>
      );
    case 'tenants':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="8" height="7" rx="1" />
          <rect x="13" y="4" width="8" height="7" rx="1" />
          <rect x="3" y="13" width="8" height="7" rx="1" />
          <rect x="13" y="13" width="8" height="7" rx="1" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
