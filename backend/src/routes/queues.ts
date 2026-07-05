import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../lib/socket';

const router = Router();

// GET /api/projects/:projectId/queues
router.get('/projects/:projectId/queues', async (req: AuthRequest, res: Response) => {
  try {
    const queues = await prisma.queue.findMany({
      where: { projectId: req.params.projectId },
      include: {
        _count: { select: { jobs: true } },
        jobs: { where: { status: { in: ['QUEUED', 'RUNNING', 'CLAIMED'] } }, select: { status: true } }
      }
    });
    const data = queues.map(q => ({
      ...q,
      stats: {
        total: q._count.jobs,
        queued: q.jobs.filter(j => j.status === 'QUEUED').length,
        running: q.jobs.filter(j => j.status === 'RUNNING' || j.status === 'CLAIMED').length
      }
    }));
    return res.json({ success: true, data });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/projects/:projectId/queues
router.post('/projects/:projectId/queues', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, priority, concurrencyLimit } = req.body;
    const queue = await prisma.queue.create({
      data: { name, description, priority: priority || 0, concurrencyLimit: concurrencyLimit || 10, projectId: req.params.projectId }
    });
    return res.status(201).json({ success: true, data: queue });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/queues/:queueId
router.get('/queues/:queueId', async (req: AuthRequest, res: Response) => {
  try {
    const queue = await prisma.queue.findUnique({
      where: { id: req.params.queueId },
      include: { _count: { select: { jobs: true, scheduledJobs: true, dlqEntries: true } } }
    });
    if (!queue) return res.status(404).json({ success: false, error: 'Queue not found' });
    return res.json({ success: true, data: queue });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// PATCH /api/queues/:queueId
router.patch('/queues/:queueId', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, priority, concurrencyLimit, isPaused } = req.body;
    const queue = await prisma.queue.update({
      where: { id: req.params.queueId },
      data: { name, description, priority, concurrencyLimit, isPaused }
    });
    return res.json({ success: true, data: queue });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/queues/:queueId/pause
router.post('/queues/:queueId/pause', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.queue.update({ where: { id: req.params.queueId }, data: { isPaused: true } });
    getIO().emit('queue:paused', { queueId: req.params.queueId });
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/queues/:queueId/resume
router.post('/queues/:queueId/resume', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.queue.update({ where: { id: req.params.queueId }, data: { isPaused: false } });
    getIO().emit('queue:resumed', { queueId: req.params.queueId });
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/queues/:queueId/stats
router.get('/queues/:queueId/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [total, queued, running, completed, failed, dead] = await Promise.all([
      prisma.job.count({ where: { queueId: req.params.queueId } }),
      prisma.job.count({ where: { queueId: req.params.queueId, status: 'QUEUED' } }),
      prisma.job.count({ where: { queueId: req.params.queueId, status: { in: ['RUNNING', 'CLAIMED'] } } }),
      prisma.job.count({ where: { queueId: req.params.queueId, status: 'COMPLETED' } }),
      prisma.job.count({ where: { queueId: req.params.queueId, status: 'FAILED' } }),
      prisma.job.count({ where: { queueId: req.params.queueId, status: 'DEAD' } }),
    ]);
    return res.json({ success: true, data: { total, queued, running, completed, failed, dead } });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

export default router;
