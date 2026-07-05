import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';
import logger from '../lib/prisma';
import cron from 'node-cron';

export function startCronScheduler() {
  // Check every 30 seconds for due scheduled jobs
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const dueJobs = await prisma.scheduledJob.findMany({
        where: { isActive: true, nextRunAt: { lte: new Date() } }
      });

      for (const sj of dueJobs) {
        // Create a new job for this cron trigger
        const job = await prisma.job.create({
          data: {
            name: sj.name,
            type: 'SCHEDULED',
            status: 'QUEUED',
            queueId: sj.queueId,
            priority: sj.priority,
            maxRetries: sj.maxRetries,
            payload: sj.payload,
            scheduledAt: new Date()
          }
        });

        // Calculate next run using simple offset (30 seconds for demo, real: parse cron)
        await prisma.scheduledJob.update({
          where: { id: sj.id },
          data: { lastRunAt: new Date(), totalRuns: { increment: 1 }, nextRunAt: new Date(Date.now() + 60000) }
        });

        getIO().emit('job:created', job);
        logger.info(`[Cron] Created job for scheduled job ${sj.id}`);
      }
    } catch (err: any) {
      logger.error(`[Cron] Error: ${err.message}`);
    }
  });

  logger.info('[Cron] Scheduler started');
}
