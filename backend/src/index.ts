import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { prisma, default as logger } from './lib/prisma';
import { initSocket } from './lib/socket';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { startWorker } from './services/worker';
import { startCronScheduler } from './services/scheduler';
import authRoutes from './routes/auth';
import orgRoutes from './routes/orgs';
import queueRoutes from './routes/queues';
import jobRoutes from './routes/jobs';
import metricsRoutes from './routes/metrics';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
initSocket(httpServer);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logging
app.use((req, _res, next) => { logger.info(`${req.method} ${req.path}`); next(); });

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/orgs', authenticate, orgRoutes);
app.use('/api', authenticate, queueRoutes);
app.use('/api', authenticate, jobRoutes);
app.use('/api', authenticate, metricsRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '3001');

async function main() {
  // Test DB connection
  await prisma.$connect();
  logger.info('Database connected');

  httpServer.listen(PORT, () => {
    logger.info(`⚡ JobForge server running on http://localhost:${PORT}`);
  });

  // Start background services
  await startWorker();
  startCronScheduler();
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
