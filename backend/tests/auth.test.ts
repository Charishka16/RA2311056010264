import request from 'supertest';
import express from 'express';
import authRoutes from '../src/routes/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { prisma } from '../src/lib/prisma';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: 'test-jest@example.com' } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: 'test-jest@example.com' } });
  await prisma.$disconnect();
});

describe('Auth Routes', () => {
  let token: string;

  test('POST /api/auth/register - creates a user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test-jest@example.com',
      password: 'password123',
      name: 'Test User'
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    token = res.body.data.token;
  });

  test('POST /api/auth/register - rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test-jest@example.com',
      password: 'password123',
      name: 'Test User'
    });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/login - authenticates user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test-jest@example.com',
      password: 'password123'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  test('POST /api/auth/login - rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test-jest@example.com',
      password: 'wrongpassword'
    });
    expect(res.status).toBe(401);
  });
});
