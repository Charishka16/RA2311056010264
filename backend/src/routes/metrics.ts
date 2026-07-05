import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/workers
router.get('/workers', async (req: AuthRequest, res: Response) => {
  try {
    const workers = await prisma.worker.findMany({
      include: { _count: { select: { jobs: true } } },
      orderBy: { lastHeartbeat: 'desc' }
    });
    return res.json({ success: true, data: workers });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/workers/:workerId
router.get('/workers/:workerId', async (req: AuthRequest, res: Response) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.workerId },
      include: { heartbeats: { orderBy: { createdAt: 'desc' }, take: 20 }, jobs: { take: 10, orderBy: { createdAt: 'desc' } } }
    });
    if (!worker) return res.status(404).json({ success: false, error: 'Worker not found' });
    return res.json({ success: true, data: worker });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/metrics/overview
router.get('/metrics/overview', async (req: AuthRequest, res: Response) => {
  try {
    const [totalJobs, queued, running, completed, failed, dead, activeWorkers, queueCount, dlqCount] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'QUEUED' } }),
      prisma.job.count({ where: { status: { in: ['RUNNING', 'CLAIMED'] } } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.job.count({ where: { status: 'FAILED' } }),
      prisma.job.count({ where: { status: 'DEAD' } }),
      prisma.worker.count({ where: { status: 'ACTIVE', lastHeartbeat: { gte: new Date(Date.now() - 30000) } } }),
      prisma.queue.count(),
      prisma.deadLetterQueue.count({ where: { purgedAt: null } })
    ]);
    return res.json({
      success: true,
      data: { totalJobs, jobsByStatus: { queued, running, completed, failed, dead }, activeWorkers, queueCount, dlqCount }
    });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/metrics/throughput
router.get('/metrics/throughput', async (req: AuthRequest, res: Response) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const jobs = await prisma.job.findMany({
      where: { status: 'COMPLETED', completedAt: { gte: since } },
      select: { completedAt: true }
    });
    const buckets: Record<string, number> = {};
    jobs.forEach(j => {
      if (!j.completedAt) return;
      const hour = new Date(j.completedAt);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      buckets[key] = (buckets[key] || 0) + 1;
    });
    const data = Object.entries(buckets).map(([timestamp, count]) => ({ timestamp, count }));
    return res.json({ success: true, data });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/queues/:queueId/dlq
router.get('/queues/:queueId/dlq', async (req: AuthRequest, res: Response) => {
  try {
    const entries = await prisma.deadLetterQueue.findMany({
      where: { queueId: req.params.queueId, purgedAt: null },
      include: { job: true }
    });
    return res.json({ success: true, data: entries });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/dlq/:id/retry
router.post('/dlq/:id/retry', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.deadLetterQueue.update({ where: { id: req.params.id }, data: { retriedAt: new Date() } });
    await prisma.job.update({ where: { id: entry.jobId }, data: { status: 'QUEUED', scheduledAt: new Date(), attempt: 0 } });
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

export default router;
