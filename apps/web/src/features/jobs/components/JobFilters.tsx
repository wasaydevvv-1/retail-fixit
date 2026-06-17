import type { JobListQuery } from '@retailfixit/shared';
import type { JobStatus } from '@retailfixit/shared';

import { JOB_STATUS_FILTER_OPTIONS } from '../lib/job-status-labels.js';

interface JobFiltersProps {
  filters: JobListQuery;
  onChange: (next: JobListQuery) => void;
}

export function JobFilters({ filters, onChange }: JobFiltersProps) {
  const activeStatus = filters.status ?? '';

  function setStatus(status: JobStatus | '') {
    onChange({
      ...filters,
      status: status || undefined,
      page: 1,
    });
  }

  const hasExtraFilters = Boolean(filters.priority);

  function clearExtraFilters() {
    onChange({
      ...filters,
      priority: undefined,
      page: 1,
    });
  }

  return (
    <div className="job-filters">
      <label className="job-filters__search">
        <span className="visually-hidden">Search jobs</span>
        <input
          type="search"
          placeholder="Search by title, customer, or location…"
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined, page: 1 })}
        />
      </label>

      <div className="job-filters__status" role="group" aria-label="Filter by status">
        {JOB_STATUS_FILTER_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`job-filters__chip${activeStatus === option.value ? ' job-filters__chip--active' : ''}`}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {hasExtraFilters && (
        <button type="button" className="job-filters__clear" onClick={clearExtraFilters}>
          Clear filters
        </button>
      )}
    </div>
  );
}
