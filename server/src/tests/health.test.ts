import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { reconnectTestDatabase, setupTestDatabase, teardownTestDatabase } from './helpers/test-db';

const app = createApp();

beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

describe('GET /health', () => {
  it('reports the service and the database as healthy', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
    expect(typeof response.body.timestamp).toBe('string');
    expect(Number.isNaN(new Date(response.body.timestamp).getTime())).toBe(false);
  });

  it('reports degraded and the real database state when MongoDB is unreachable', async () => {
    await mongoose.disconnect();

    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('degraded');
    expect(response.body.database).toBe('disconnected');
    expect(typeof response.body.databaseError).toBe('string');

    await reconnectTestDatabase();
  });

  it('answers 404 with a structured error for unknown routes', async () => {
    const response = await request(app).get('/api/v1/does-not-exist').expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
