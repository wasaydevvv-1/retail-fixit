import { VendorStatus } from '@retailfixit/shared';
import { z } from 'zod';

export const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  skills: z.array(z.string().min(1).max(100)).min(1).max(20),
  serviceAreas: z.array(z.string().min(1).max(200)).min(1).max(20),
  rating: z.number().min(0).max(5).optional(),
});

export const vendorProfileSchema = z.object({
  name: z.string().min(1).max(200),
  skills: z.array(z.string().min(1).max(100)).min(1).max(20),
  serviceAreas: z.array(z.string().min(1).max(100)).min(1).max(20),
});

export const vendorRatingSchema = z.object({
  rating: z.number().min(0).max(5),
});

export const vendorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z
    .enum([VendorStatus.Active, VendorStatus.Inactive, VendorStatus.Suspended])
    .optional(),
  search: z.string().max(200).optional(),
  skills: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const list = Array.isArray(val) ? val : val.split(',').map((s) => s.trim());
      return list.filter(Boolean);
    }),
});
