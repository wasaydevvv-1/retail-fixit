export function JobListSkeleton() {
  return (
    <div className="skeleton-table" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
