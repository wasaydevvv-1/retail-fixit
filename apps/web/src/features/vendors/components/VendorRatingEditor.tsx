import { useEffect, useState } from 'react';
import type { Vendor } from '@retailfixit/shared';

import { useToast } from '../../../components/ToastProvider.js';
import { useUpdateVendorRating } from '../hooks/useVendorRating.js';

interface VendorRatingEditorProps {
  vendor: Vendor;
}

const RATING_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export function VendorRatingEditor({ vendor }: VendorRatingEditorProps) {
  const { toast } = useToast();
  const update = useUpdateVendorRating();
  const [value, setValue] = useState(vendor.rating);

  useEffect(() => {
    setValue(vendor.rating);
  }, [vendor.id, vendor.rating]);

  function handleChange(next: number) {
    setValue(next);
    update.mutate(
      { vendorId: vendor.id, rating: next },
      {
        onSuccess: () => toast(`Rating saved for ${vendor.name}`, 'success'),
        onError: () => {
          setValue(vendor.rating);
          toast('Failed to save rating', 'error');
        },
      },
    );
  }

  return (
    <div className="rf-rating-editor">
      <select
        className="rf-rating-select"
        value={value}
        disabled={update.isPending}
        onChange={(e) => handleChange(Number(e.target.value))}
        aria-label={`Rating for ${vendor.name}`}
      >
        {RATING_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 0 ? 'Not rated' : `${option.toFixed(1)} / 5`}
          </option>
        ))}
      </select>
      {update.isPending && <span className="rf-rating-saving">Saving…</span>}
    </div>
  );
}

export function VendorRatingDisplay({ rating }: { rating: number }) {
  if (rating <= 0) {
    return <span className="rf-rating-muted">Not rated</span>;
  }
  return (
    <span className="rf-rating-display" title={`${rating.toFixed(1)} out of 5`}>
      <span className="rf-rating-stars" aria-hidden>
        {'★'.repeat(Math.round(rating))}
        {'☆'.repeat(5 - Math.round(rating))}
      </span>
      <span>{rating.toFixed(1)}</span>
    </span>
  );
}
