import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../lib/socket';

const router = Router();

// POST /api/queues/:queueId/jobs
router.post('/queues/:queueId/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const { name, type = 'IMMEDIATE', payload = {}, priority = 0, scheduledAt, delayMs, maxRetries = 3, idempotencyKey } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    if (idempotencyKey) {
      const existing = await prisma.job.findUnique({ where: { idempotencyKey } });
      if (existing) return res.json({ success: true, data: existing, idempotent: true });
    }

    let jobScheduledAt = new Date();
    if (type === 'DELAYED' && delayMs) jobScheduledAt = new Date(Date.now() + delayMs);
    if (type === 'SCHEDULED' && scheduledAt) jobScheduledAt = new Date(scheduledAt);

    const job = await prisma.job.create({
      data: {
        name, type, priority, maxRetries, idempotencyKey,
        status: type === 'IMMEDIATE' ? 'QUEUED' : 'SCHEDULED',
        scheduledAt: jobScheduledAt,
        queueId: req.params.queueId,
        payload: JSON.stringify(payload)
      }
    });

    getIO().emit('job:created', job);
    return res.status(201).json({ success: true, data: job });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/queues/:queueId/jobs/batch
router.post('/queues/:queueId/jobs/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { jobs } = req.body;
    if (!Array.isArray(jobs) || jobs.length === 0) return res.status(400).json({ success: false, error: 'jobs array required' });

    const created = await prisma.$transaction(
      jobs.map(j => prisma.job.create({
        data: {
          name: j.name, type: j.type || 'IMMEDIATE', priority: j.priority || 0,
          status: 'QUEUED', scheduledAt: new Date(),
          queueId: req.params.queueId,
          payload: JSON.stringify(j.payload || {})
        }
      }))
    );

    created.forEach(j => getIO().emit('job:created', j));
    return res.status(201).json({ success: true, data: created, count: created.length });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/queues/:queueId/jobs
router.get('/queues/:queueId/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const type = req.query.type as string;

    const where: any = { queueId: req.params.queueId };
    if (status) where.status = status.toUpperCase();
    if (type) where.type = type.toUpperCase();

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] }),
      prisma.job.count({ where })
    ]);

    return res.json({ success: true, data: jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/jobs/:jobId
router.get('/jobs/:jobId', async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      include: { executions: { include: { worker: true } }, logs: { orderBy: { createdAt: 'desc' }, take: 50 } }
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    return res.json({ success: true, data: job });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/jobs/:jobId/retry
router.post('/jobs/:jobId/retry', async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.jobId, status: { in: ['FAILED', 'DEAD'] } },
      data: { status: 'QUEUED', scheduledAt: new Date(), failedAt: null, workerId: null }
    });
    // Remove from DLQ if present
    await prisma.deadLetterQueue.deleteMany({ where: { jobId: job.id } }).catch(() => {});
    getIO().emit('job:retried', job);
    return res.json({ success: true, data: job });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/jobs/:jobId/cancel
router.post('/jobs/:jobId/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.jobId, status: { in: ['QUEUED', 'SCHEDULED'] } },
      data: { status: 'CANCELLED' }
    });
    getIO().emit('job:cancelled', job);
    return res.json({ success: true, data: job });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/jobs/:jobId/logs
router.get('/jobs/:jobId/logs', async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.jobLog.findMany({
      where: { jobId: req.params.jobId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return res.json({ success: true, data: logs });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

export default router;
