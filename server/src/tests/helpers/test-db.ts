import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Device } from '../../modules/devices/device.model';
import { Telemetry } from '../../modules/telemetry/telemetry.model';
import { PostureEvent } from '../../modules/events/event.model';
import { Session } from '../../modules/sessions/session.model';
import { Recommendation } from '../../modules/ai/ai.model';

/**
 * Isolated, throwaway MongoDB instance per test file.
 * Production data is never touched: the server URI comes from a temporary
 * mongod process that is destroyed in `teardownTestDatabase`.
 */
let memoryServer: MongoMemoryServer | null = null;
let memoryUri = '';

export async function setupTestDatabase(): Promise<void> {
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'smartposture_test' } });
  memoryUri = memoryServer.getUri();
  await mongoose.connect(memoryUri, { dbName: 'smartposture_test' });

  // Unique indexes are what make telemetry/event de-duplication work.
  await Promise.all([
    Device.syncIndexes(),
    Telemetry.syncIndexes(),
    PostureEvent.syncIndexes(),
    Session.syncIndexes(),
    Recommendation.syncIndexes(),
  ]);
}

export async function reconnectTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  await mongoose.connect(memoryUri, { dbName: 'smartposture_test' });
}

export async function teardownTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export async function clearDatabase(): Promise<void> {
  await Promise.all([
    Device.deleteMany({}),
    Telemetry.deleteMany({}),
    PostureEvent.deleteMany({}),
    Session.deleteMany({}),
    Recommendation.deleteMany({}),
  ]);
}

export const TEST_DEVICE_ID = 'smartposture-esp32-test';
