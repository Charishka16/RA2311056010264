import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/orgs
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const org = await prisma.organization.create({
      data: { name, slug: `${slug}-${Date.now()}`, createdBy: req.user!.id,
        members: { create: { userId: req.user!.id, role: 'OWNER' } }
      }
    });
    return res.status(201).json({ success: true, data: org });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/orgs
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { members: { some: { userId: req.user!.id } } },
      include: { _count: { select: { members: true, projects: true } } }
    });
    return res.json({ success: true, data: orgs });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/orgs/:orgId/projects
router.get('/:orgId/projects', async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: { orgId: req.params.orgId },
      include: { _count: { select: { queues: true } } }
    });
    return res.json({ success: true, data: projects });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/orgs/:orgId/projects
router.post('/:orgId/projects', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const project = await prisma.project.create({
      data: { name, slug, orgId: req.params.orgId, createdBy: req.user!.id }
    });
    return res.status(201).json({ success: true, data: project });
  } catch (err: any) { return res.status(500).json({ success: false, error: err.message }); }
});

export default router;
