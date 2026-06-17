import { Permission } from '@retailfixit/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { AppError } from '../../middleware/error.js';
import { createVendor, getMyAssignedJobDetail, getMyAssignedJobs, getMyVendorProfile, getVendorById, getVendorList, updateVendorRating, upsertMyVendorProfile } from './vendors.service.js';
import { createVendorSchema, vendorListQuerySchema, vendorProfileSchema, vendorRatingSchema } from './vendors.schema.js';
import { jobListQuerySchema } from '../jobs/jobs.schema.js';

export const vendorsRouter = Router();

vendorsRouter.use(authenticate);

vendorsRouter.get('/me', requirePermission(Permission.VendorsRead), async (req, res, next) => {
  try {
    const vendor = await getMyVendorProfile(req.auth!);
    res.json(vendor);
  } catch (err) {
    next(err);
  }
});

vendorsRouter.put('/me', requirePermission(Permission.VendorsCreate), async (req, res, next) => {
  try {
    const body = vendorProfileSchema.parse(req.body);
    const vendor = await upsertMyVendorProfile(req.auth!, body);
    res.json(vendor);
  } catch (err) {
    next(err);
  }
});

vendorsRouter.get('/me/jobs', requirePermission(Permission.VendorsRead), async (req, res, next) => {
  try {
    const query = jobListQuerySchema.parse(req.query);
    const result = await getMyAssignedJobs(req.auth!, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

vendorsRouter.get('/me/jobs/:id', requirePermission(Permission.VendorsRead), async (req, res, next) => {
  try {
    const jobId = req.params.id;
    if (!jobId) {
      throw new AppError(400, 'INVALID_JOB_ID', 'Job id is required');
    }
    const job = await getMyAssignedJobDetail(req.auth!, jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Assigned job not found for your company');
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

vendorsRouter.post('/', requirePermission(Permission.VendorsCreate), async (req, res, next) => {
  try {
    const body = createVendorSchema.parse(req.body);
    const vendor = await createVendor(req.auth!, body);
    res.status(201).json(vendor);
  } catch (err) {
    next(err);
  }
});

vendorsRouter.get('/', requirePermission(Permission.VendorsRead), async (req, res, next) => {
  try {
    const query = vendorListQuerySchema.parse(req.query);
    const result = await getVendorList(req.auth!, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

vendorsRouter.get('/:id', requirePermission(Permission.VendorsRead), async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    if (!vendorId) {
      throw new AppError(400, 'INVALID_VENDOR_ID', 'Vendor id is required');
    }
    const vendor = await getVendorById(req.auth!, vendorId);
    if (!vendor) {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }
    res.json(vendor);
  } catch (err) {
    next(err);
  }
});

vendorsRouter.patch('/:id/rating', requirePermission(Permission.VendorsRate), async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    if (!vendorId) {
      throw new AppError(400, 'INVALID_VENDOR_ID', 'Vendor id is required');
    }
    const body = vendorRatingSchema.parse(req.body);
    const vendor = await updateVendorRating(req.auth!, vendorId, body.rating);
    res.json(vendor);
  } catch (err) {
    next(err);
  }
});
