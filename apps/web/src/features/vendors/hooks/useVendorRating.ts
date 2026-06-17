import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Vendor } from '@retailfixit/shared';

import { updateVendorRating } from '../api.js';

export function useUpdateVendorRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vendorId, rating }: { vendorId: string; rating: number }) =>
      updateVendorRating(vendorId, { rating }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}
