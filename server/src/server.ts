import http from 'node:http';
import os from 'node:os';
import { createApp } from './app';
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseError,
  isDatabaseConnected,
} from './config/database';
import { env } from './config/env';
import { syncRecommendationIndexes } from './modules/ai/ai.model';
import { startDeviceStatusSweeper } from './modules/devices/device.sweeper';
import { closeSocketServer, initSocketServer } from './sockets/socket.server';
import { logger } from './utils/logger';

/** Hides the password of a MongoDB connection string before printing it. */
function maskMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):[^@/]+@/, '//$1:****@');
}

function collectReachableAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

/**
 * Prints a plain, easy-to-scan startup summary so the terminal immediately shows
 * whether the server is running and whether the database connection works.
 */
function printStartupStatus(): void {
  const databaseConnected = isDatabaseConnected();
  const addresses = collectReachableAddresses();

  const lines: string[] = [
    '',
    '============================================================',
    ' SmartPosture backend - startup status',
    '============================================================',
    ` Server       : RUNNING`,
    ` Environment  : ${env.NODE_ENV}`,
    ` Listening on : http://${env.HOST}:${env.PORT}`,
    ` Local API    : http://localhost:${env.PORT}/api/v1`,
    ` API docs     : http://localhost:${env.PORT}/docs`,
    ` Android emu  : http://10.0.2.2:${env.PORT}/api/v1`,
  ];

  for (const address of addresses) {
    lines.push(` Phone/ESP32  : http://${address}:${env.PORT}/api/v1`);
  }
  if (addresses.length === 0) {
    lines.push(' Phone/ESP32  : no external IPv4 interface detected');
  }

  lines.push(
    databaseConnected
      ? ' Database     : CONNECTED'
      : ' Database     : NOT CONNECTED - running in degraded mode',
  );
  lines.push(` Database URI : ${maskMongoUri(env.MONGODB_URI)}`);
  if (!databaseConnected) {
    const reason = getDatabaseError();
    lines.push(` Database err : ${reason ?? 'unknown connection error'}`);
    lines.push(' Hint         : start MongoDB, or check MONGODB_URI and network access');
  }
  lines.push('============================================================');
  lines.push('');

  console.log(lines.join('\n'));
}

function printStartupFailure(error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  const portInUse = reason.includes('EADDRINUSE');
  const lines: string[] = [
    '',
    '============================================================',
    ' SmartPosture backend - startup status',
    '============================================================',
    ' Server       : NOT RUNNING - startup failed',
    ` Listening on : http://${env.HOST}:${env.PORT}`,
    ` Reason       : ${reason}`,
  ];
  if (portInUse) {
    lines.push(` Hint         : port ${env.PORT} is already in use; stop the other process or change PORT`);
  }
  lines.push('============================================================');
  lines.push('');

  console.error(lines.join('\n'));
}

async function bootstrap(): Promise<void> {
  // A missing database must not prevent the HTTP server from starting:
  // /health reports `degraded` and telemetry returns an explicit error.
  try {
    await connectDatabase();
  } catch (error) {
    logger.error(
      { err: error, uri: maskMongoUri(env.MONGODB_URI) },
      'MongoDB is unavailable - starting in degraded mode (check MONGODB_URI)',
    );
  }

  // Index options cannot be changed in place: this drops the legacy 5-minute
  // cache TTL index and applies the (much longer) retention TTL, which is what
  // keeps `GET /ai/recommendations/latest` working after the cache window.
  if (isDatabaseConnected()) {
    try {
      await syncRecommendationIndexes();
    } catch (error) {
      logger.error({ err: error }, 'Could not synchronise the recommendation indexes');
    }
  }

  const app = createApp();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);
  const sweeper = startDeviceStatusSweeper();

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(env.PORT, env.HOST, () => resolve());
  });

  logger.info(
    { host: env.HOST, port: env.PORT, offlineTimeoutSeconds: env.DEVICE_OFFLINE_TIMEOUT_SECONDS },
    'SmartPosture backend listening',
  );
  printStartupStatus();

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    clearInterval(sweeper);

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

    await closeSocketServer();

    try {
      await disconnectDatabase();
    } catch (error) {
      logger.error({ err: error }, 'Error while closing the MongoDB connection');
    }

    console.log(`Server       : STOPPED (signal ${signal})`);
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap().catch((error: unknown) => {
  printStartupFailure(error);
  logger.fatal({ err: error }, 'Failed to start the SmartPosture backend');
  process.exitCode = 1;
});
