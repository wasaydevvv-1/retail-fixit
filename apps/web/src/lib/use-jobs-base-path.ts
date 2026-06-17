import { useLocation } from 'react-router-dom';

/** Base path for job routes: /dispatch or /support */
export function useJobsBasePath(): string {
  const { pathname } = useLocation();
  if (pathname.startsWith('/support')) return '/support';
  return '/dispatch';
}
