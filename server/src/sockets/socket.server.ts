import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { corsOrigins } from '../config/env';
import type { EventSeverity, PostureLabel, DeviceStatusValue } from '../shared/domain';
import { logger } from '../utils/logger';

export const SOCKET_EVENTS = {
  postureUpdate: 'posture:update',
  deviceStatus: 'device:status',
  postureAlert: 'posture:alert',
} as const;

export interface PostureUpdatePayload {
  deviceId: string;
  posture: PostureLabel;
  angle: number | null;
  confidence: number | null;
  alert: boolean;
  battery: number | null;
  timestamp: string;
}

export interface DeviceStatusPayload {
  deviceId: string;
  status: DeviceStatusValue;
  lastSeen: string | null;
  timestamp: string;
}

export interface PostureAlertPayload extends PostureUpdatePayload {
  severity: EventSeverity;
}

let socketServer: SocketServer | null = null;

/**
 * Socket.IO is an OPTIONAL live-update channel for Flutter. The REST API keeps
 * working when no client is connected, and telemetry ingestion never depends on
 * a successful broadcast.
 *
 * Authentication is intentionally disabled for this prototype: room names and
 * deviceIds must NOT be treated as a security boundary.
 */
export function initSocketServer(httpServer: HttpServer): SocketServer {
  socketServer = new SocketServer(httpServer, {
    path: '/socket.io',
    serveClient: false,
    cors: {
      origin: corsOrigins === '*' ? true : corsOrigins,
      methods: ['GET', 'POST'],
      credentials: false,
    },
  });

  socketServer.on('connection', (socket: Socket) => {
    logger.debug({ socketId: socket.id }, 'Socket.IO client connected');
    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket.IO client disconnected');
    });
  });

  return socketServer;
}

export function getSocketServer(): SocketServer | null {
  return socketServer;
}

export function emitPostureUpdate(payload: PostureUpdatePayload): void {
  socketServer?.emit(SOCKET_EVENTS.postureUpdate, payload);
}

export function emitDeviceStatus(payload: DeviceStatusPayload): void {
  socketServer?.emit(SOCKET_EVENTS.deviceStatus, payload);
}

export function emitPostureAlert(payload: PostureAlertPayload): void {
  socketServer?.emit(SOCKET_EVENTS.postureAlert, payload);
}

export async function closeSocketServer(): Promise<void> {
  if (!socketServer) {
    return;
  }
  const server = socketServer;
  socketServer = null;
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}
