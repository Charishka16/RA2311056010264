import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // User
  const hash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@jobforge.dev' },
    update: {},
    create: { email: 'demo@jobforge.dev', passwordHash: hash, name: 'Demo User', role: 'ADMIN' }
  });

  // Org
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: { name: 'Acme Corp', slug: 'acme-corp', createdBy: user.id, members: { create: { userId: user.id, role: 'OWNER' } } }
  });

  // Project
  const project = await prisma.project.upsert({
    where: { orgId_slug: { orgId: org.id, slug: 'main-platform' } },
    update: {},
    create: { name: 'Main Platform', slug: 'main-platform', orgId: org.id, createdBy: user.id }
  });

  // Queues
  const emailQ = await prisma.queue.upsert({
    where: { projectId_name: { projectId: project.id, name: 'email-notifications' } },
    update: {},
    create: { name: 'email-notifications', description: 'Transactional email processing', priority: 10, concurrencyLimit: 5, projectId: project.id }
  });

  const dataQ = await prisma.queue.upsert({
    where: { projectId_name: { projectId: project.id, name: 'data-processing' } },
    update: {},
    create: { name: 'data-processing', description: 'Heavy data pipeline', priority: 5, concurrencyLimit: 3, projectId: project.id }
  });

  // Jobs
  const jobNames = ['Send Welcome Email', 'Process CSV Export', 'Generate Report', 'Sync User Data', 'Cleanup Temp Files'];
  for (const name of jobNames) {
    await prisma.job.create({
      data: { name, type: 'IMMEDIATE', status: 'QUEUED', queueId: emailQ.id, priority: Math.floor(Math.random() * 10), payload: JSON.stringify({ duration: 1500, failRate: 0.1 }) }
    });
  }

  // Scheduled job
  await prisma.scheduledJob.create({
    data: { name: 'Daily Report', cronExpression: '0 9 * * *', queueId: dataQ.id, payload: JSON.stringify({ type: 'daily-summary' }), nextRunAt: new Date(Date.now() + 30000) }
  });

  console.log('✅ Seed complete!');
  console.log('   Login: demo@jobforge.dev / password123');
  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
