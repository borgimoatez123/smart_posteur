import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'unknown';

let listenersRegistered = false;
let lastConnectionError: string | null = null;

const READY_STATE = {
  disconnected: 0,
  connected: 1,
  connecting: 2,
  disconnecting: 3,
} as const;

function registerConnectionListeners(): void {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  const connection = mongoose.connection;
  connection.on('connected', () => {
    lastConnectionError = null;
    logger.info('Database connection: CONNECTED (MongoDB)');
  });
  connection.on('disconnected', () => {
    logger.warn('Database connection: DISCONNECTED (MongoDB)');
  });
  connection.on('reconnected', () => {
    lastConnectionError = null;
    logger.info('Database connection: RECONNECTED (MongoDB)');
  });
  connection.on('error', (error: Error) => {
    lastConnectionError = error.message;
    logger.error({ err: error }, 'Database connection: ERROR (MongoDB)');
  });
}

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  registerConnectionListeners();
  mongoose.set('strictQuery', true);

  if (mongoose.connection.readyState === READY_STATE.connected) {
    return mongoose;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
    return mongoose;
  } catch (error) {
    lastConnectionError = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  registerConnectionListeners();
  if (mongoose.connection.readyState === READY_STATE.disconnected) {
    return;
  }
  await mongoose.disconnect();
}

export function getDatabaseStatus(): DatabaseStatus {
  switch (mongoose.connection.readyState) {
    case READY_STATE.connected:
      return 'connected';
    case READY_STATE.connecting:
      return 'connecting';
    case READY_STATE.disconnecting:
      return 'disconnecting';
    case READY_STATE.disconnected:
      return 'disconnected';
    default:
      return 'unknown';
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === READY_STATE.connected;
}

export function getDatabaseError(): string | null {
  return lastConnectionError;
}
