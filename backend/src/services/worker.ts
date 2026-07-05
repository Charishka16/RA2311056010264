import { prisma } from '../lib/prisma';
import { getIO } from '../lib/socket';
import logger from '../lib/prisma';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

let workerId: string;
let pollingInterval: NodeJS.Timeout;
let heartbeatInterval: NodeJS.Timeout;
let staleInterval: NodeJS.Timeout;
let isShuttingDown = false;

export async function startWorker() {
  workerId = uuidv4();
  await prisma.worker.create({
    data: { id: workerId, name: `worker-${os.hostname()}-${process.pid}`, hostname: os.hostname(), pid: process.pid }
  });
  logger.info(`[Worker] Started ${workerId}`);

  pollingInterval = setInterval(pollJobs, 1000);
  heartbeatInterval = setInterval(heartbeat, 5000);
  staleInterval = setInterval(recoverStaleJobs, 30000);

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

async function pollJobs() {
  if (isShuttingDown) return;
  try {
    // Optimistic locking: claim with version check to prevent duplicate execution
    const candidate = await prisma.job.findFirst({
      where: { status: 'QUEUED', scheduledAt: { lte: new Date() }, queue: { isPaused: false } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
    });
    if (!candidate) return;

    const updated = await prisma.job.updateMany({
      where: { id: candidate.id, version: candidate.version, status: 'QUEUED' },
      data: { status: 'CLAIMED', workerId, claimedAt: new Date(), version: { increment: 1 } }
    });

    if (updated.count > 0) {
      const job = await prisma.job.findUnique({ where: { id: candidate.id } });
      if (job) {
        getIO().emit('job:claimed', job);
        executeJob(job);
      }
    }
  } catch (_) {}
}

async function executeJob(job: any) {
  const execId = uuidv4();
  const startTime = Date.now();

  await prisma.job.update({ where: { id: job.id }, data: { status: 'RUNNING', startedAt: new Date() } });
  await prisma.jobExecution.create({ data: { id: execId, jobId: job.id, attempt: job.attempt + 1, workerId, status: 'RUNNING' } });
  getIO().emit('job:running', { id: job.id, status: 'RUNNING' });

  try {
    const payload = JSON.parse(job.payload || '{}');
    const duration = payload.duration || Math.floor(Math.random() * 2000) + 500;
    await new Promise(res => setTimeout(res, duration));

    if (payload.failRate && Math.random() < payload.failRate) throw new Error('Simulated failure (failRate)');

    const durationMs = Date.now() - startTime;
    await prisma.job.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await prisma.jobExecution.update({ where: { id: execId }, data: { status: 'COMPLETED', completedAt: new Date(), durationMs } });
    await prisma.worker.update({ where: { id: workerId }, data: { jobsProcessed: { increment: 1 } } });
    await prisma.jobLog.create({ data: { jobId: job.id, level: 'info', message: `Job completed in ${durationMs}ms` } });

    const updated = await prisma.job.findUnique({ where: { id: job.id } });
    getIO().emit('job:completed', updated);
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    await prisma.jobExecution.update({ where: { id: execId }, data: { status: 'FAILED', completedAt: new Date(), durationMs, errorMessage: err.message } });
    await prisma.jobLog.create({ data: { jobId: job.id, level: 'error', message: err.message } });

    const nextAttempt = job.attempt + 1;
    if (nextAttempt >= job.maxRetries) {
      await prisma.job.update({ where: { id: job.id }, data: { status: 'DEAD', failedAt: new Date() } });
      await prisma.deadLetterQueue.upsert({
        where: { jobId: job.id },
        create: { jobId: job.id, queueId: job.queueId, failureReason: 'Max retries exceeded', failureCount: nextAttempt, lastError: err.message },
        update: { lastError: err.message, failureCount: nextAttempt }
      });
      const dead = await prisma.job.findUnique({ where: { id: job.id } });
      getIO().emit('job:dead', dead);
    } else {
      // Exponential backoff: baseDelay * 2^attempt
      const delay = 2000 * Math.pow(2, nextAttempt);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'QUEUED', attempt: nextAttempt, scheduledAt: new Date(Date.now() + delay) }
      });
      await prisma.worker.update({ where: { id: workerId }, data: { jobsFailed: { increment: 1 } } });
      const retried = await prisma.job.findUnique({ where: { id: job.id } });
      getIO().emit('job:failed', retried);
    }
  }
}

async function heartbeat() {
  await prisma.worker.update({ where: { id: workerId }, data: { lastHeartbeat: new Date() } });
  await prisma.workerHeartbeat.create({ data: { workerId, status: 'healthy' } });
  getIO().emit('worker:heartbeat', { workerId, timestamp: new Date() });
}

async function recoverStaleJobs() {
  const threshold = new Date(Date.now() - 60000);
  const stale = await prisma.job.updateMany({
    where: { status: { in: ['CLAIMED', 'RUNNING'] }, startedAt: { lt: threshold } },
    data: { status: 'QUEUED', workerId: null, claimedAt: null, startedAt: null }
  });
  if (stale.count > 0) logger.info(`[Worker] Recovered ${stale.count} stale jobs`);
}

async function gracefulShutdown() {
  logger.info('[Worker] Graceful shutdown...');
  isShuttingDown = true;
  clearInterval(pollingInterval);
  clearInterval(heartbeatInterval);
  clearInterval(staleInterval);
  await prisma.worker.update({ where: { id: workerId }, data: { status: 'OFFLINE', stoppedAt: new Date() } });
  process.exit(0);
}
