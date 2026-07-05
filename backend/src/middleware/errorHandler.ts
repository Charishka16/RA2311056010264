import { Request, Response, NextFunction } from 'express';
import logger from '../lib/prisma';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err.status || 500;
  logger.error(`${req.method} ${req.path} → ${err.message}`);
  res.status(status).json({
    success: false,
    error: { message: err.message || 'Internal server error', code: err.code || 'INTERNAL_ERROR' }
  });
}
