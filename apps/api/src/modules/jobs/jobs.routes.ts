import { Permission } from '@retailfixit/shared';
import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { AppError } from '../../middleware/error.js';
import { assignVendorToJob } from '../assignments/assignments.service.js';
import { assignJobSchema } from '../assignments/assignments.schema.js';
import { createJob, getJobDetail, getJobList } from './jobs.service.js';
import { createJobSchema, jobListQuerySchema } from './jobs.schema.js';

export const jobsRouter = Router();

jobsRouter.use(authenticate);

jobsRouter.post('/', requirePermission(Permission.JobsCreate), async (req, res, next) => {
  try {
    const body = createJobSchema.parse(req.body);
    const job = await createJob(req.auth!, body, req.traceId!);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

jobsRouter.get('/', requirePermission(Permission.JobsRead), async (req, res, next) => {
  try {
    const query = jobListQuerySchema.parse(req.query);
    const result = await getJobList(req.auth!, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

jobsRouter.get('/:id', requirePermission(Permission.JobsRead), async (req, res, next) => {
  try {
    const jobId = req.params.id;
    if (!jobId) {
      throw new AppError(400, 'INVALID_JOB_ID', 'Job id is required');
    }
    const detail = await getJobDetail(req.auth!, jobId);
    if (!detail) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

jobsRouter.post('/:id/assign', requirePermission(Permission.JobsAssign), async (req, res, next) => {
  try {
    const jobId = req.params.id;
    if (!jobId) {
      throw new AppError(400, 'INVALID_JOB_ID', 'Job id is required');
    }
    const body = assignJobSchema.parse(req.body);
    const result = await assignVendorToJob(req.auth!, jobId, body.vendorId, req.traceId!);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
