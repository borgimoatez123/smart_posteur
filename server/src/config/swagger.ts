import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        details: { type: 'object', nullable: true },
      },
    },
  },
} as const;

const successEnvelope = (data: unknown, description = 'Success') =>
  ({
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data,
          },
        },
      },
    },
  }) as const;

const validationError = {
  description: 'Validation failed',
  content: { 'application/json': { schema: errorResponse } },
} as const;

const postureLabel = {
  type: 'string',
  enum: ['GOOD_POSTURE', 'SLOUCHING', 'LEAN_LEFT', 'LEAN_RIGHT', 'HEAD_FORWARD', 'UNKNOWN'],
} as const;

const limits = { pageParam: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } } };

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SmartPosture Backend API',
    version: '1.0.0',
    description: [
      'Backend for SmartPosture: an ESP32 + MPU6050 wearable that classifies sitting posture locally and vibrates on incorrect posture.',
      '',
      '**Authentication is intentionally disabled for this prototype.** An unauthenticated HTTP server is only appropriate on a controlled local Wi-Fi network - never expose it to the public Internet.',
    ].join('\n'),
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Server host machine' },
    { url: 'http://10.0.2.2:3000', description: 'Host machine as seen from a standard Android emulator' },
    { url: 'http://<computer-lan-ip>:3000', description: 'Host machine from a physical phone or the ESP32' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Telemetry' },
    { name: 'Devices' },
    { name: 'Dashboard' },
    { name: 'History' },
    { name: 'Sessions' },
    { name: 'Events' },
    { name: 'AI' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service and database health',
        responses: {
          200: {
            description: 'Health report (status is `degraded` when MongoDB is unavailable)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'] },
                    database: { type: 'string', enum: ['connected', 'connecting', 'disconnected', 'disconnecting', 'unknown'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    databaseError: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/telemetry': {
      post: {
        tags: ['Telemetry'],
        summary: 'Ingest one telemetry sample from the ESP32',
        description:
          'Validated with Zod. Returns 201 when a new record is stored and 200 when the exact same occurrence is retried (idempotent via a unique dedupeKey).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceId', 'posture'],
                properties: {
                  deviceId: { type: 'string', example: 'smartposture-esp32-01' },
                  timestamp: { type: 'string', format: 'date-time', nullable: true },
                  sensors: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      ax: { type: 'number', nullable: true, example: 0.12 },
                      ay: { type: 'number', nullable: true, example: -0.08 },
                      az: { type: 'number', nullable: true, example: 9.75 },
                      gx: { type: 'number', nullable: true, example: 0.3 },
                      gy: { type: 'number', nullable: true, example: -0.5 },
                      gz: { type: 'number', nullable: true, example: 0.1 },
                    },
                  },
                  posture: {
                    type: 'object',
                    required: ['label', 'angle'],
                    properties: {
                      label: postureLabel,
                      angle: { type: 'number', minimum: -180, maximum: 180, example: 18.5 },
                      confidence: { type: 'number', minimum: 0, maximum: 1, nullable: true, example: 0.92 },
                      badDurationSeconds: { type: 'number', nullable: true, example: 4 },
                    },
                  },
                  alert: { type: 'boolean', example: true },
                  battery: { type: 'integer', minimum: 0, maximum: 100, nullable: true, example: 78 },
                  samplingHz: { type: 'number', nullable: true, example: 10 },
                },
              },
            },
          },
        },
        responses: {
          201: successEnvelope(
            {
              type: 'object',
              properties: {
                id: { type: 'string' },
                duplicate: { type: 'boolean' },
                sessionId: { type: 'string', nullable: true },
                events: { type: 'array', items: { type: 'string' } },
              },
            },
            'Telemetry stored',
          ),
          200: successEnvelope({ type: 'object' }, 'Duplicate telemetry ignored'),
          400: validationError,
        },
      },
    },
    '/api/v1/devices': {
      get: { tags: ['Devices'], summary: 'List known devices with their computed status', responses: { 200: successEnvelope({ type: 'object' }) } },
    },
    '/api/v1/devices/{deviceId}': {
      get: {
        tags: ['Devices'],
        summary: 'Get one device',
        parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }), 404: { description: 'Unknown device' } },
      },
    },
    '/api/v1/devices/{deviceId}/status': {
      get: {
        tags: ['Devices'],
        summary: 'Online/offline status, latest posture and battery',
        parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }), 404: { description: 'Unknown device' } },
      },
    },
    '/api/v1/devices/{deviceId}/heartbeat': {
      post: {
        tags: ['Devices'],
        summary: 'Register a heartbeat (ESP32, every 15s by default)',
        parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  battery: { type: 'integer', minimum: 0, maximum: 100, nullable: true },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: { 200: successEnvelope({ type: 'object' }), 400: validationError },
      },
    },
    '/api/v1/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Current posture plus the daily summary in one response',
        parameters: [{ name: 'deviceId', in: 'query', schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }) },
      },
    },
    '/api/v1/dashboard/current': {
      get: {
        tags: ['Dashboard'],
        summary: 'Latest posture, angle, confidence, battery and device status',
        parameters: [{ name: 'deviceId', in: 'query', schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }) },
      },
    },
    '/api/v1/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Aggregated statistics and trends for day, week or month',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' } },
          { name: 'deviceId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: successEnvelope({ type: 'object' }), 400: validationError },
      },
    },
    '/api/v1/history': {
      get: {
        tags: ['History'],
        summary: 'Paginated telemetry history',
        parameters: [
          limits.pageParam,
          { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 200, default: 20 } },
          { name: 'deviceId', in: 'query', schema: { type: 'string' } },
          { name: 'posture', in: 'query', schema: postureLabel },
          { name: 'alert', in: 'query', schema: { type: 'boolean' } },
          { name: 'sessionId', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: { 200: successEnvelope({ type: 'object' }), 400: validationError },
      },
    },
    '/api/v1/history/{id}': {
      get: {
        tags: ['History'],
        summary: 'One telemetry record',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }), 404: { description: 'Not found' } },
      },
    },
    '/api/v1/sessions': {
      get: {
        tags: ['Sessions'],
        summary: 'Paginated sessions',
        parameters: [
          limits.pageParam,
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'deviceId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'ended'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: { 200: successEnvelope({ type: 'object' }) },
      },
      post: {
        tags: ['Sessions'],
        summary: 'Start a monitoring session (returns the existing active session when there is one)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceId'],
                properties: {
                  deviceId: { type: 'string' },
                  startedAt: { type: 'string', format: 'date-time' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: { 201: successEnvelope({ type: 'object' }, 'Session started'), 200: successEnvelope({ type: 'object' }, 'Existing active session'), 400: validationError },
      },
    },
    '/api/v1/sessions/{id}': {
      get: {
        tags: ['Sessions'],
        summary: 'One session (live statistics while it is active)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }), 404: { description: 'Not found' } },
      },
    },
    '/api/v1/sessions/{id}/end': {
      patch: {
        tags: ['Sessions'],
        summary: 'End a session and store its final statistics',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  endedAt: { type: 'string', format: 'date-time' },
                  notes: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: { 200: successEnvelope({ type: 'object' }), 400: validationError, 404: { description: 'Not found' } },
      },
    },
    '/api/v1/events': {
      get: {
        tags: ['Events'],
        summary: 'Paginated posture events',
        parameters: [
          limits.pageParam,
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'deviceId', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['POSTURE_INCORRECT', 'VIBRATION_ALERT', 'DEVICE_DISCONNECTED', 'DEVICE_RECONNECTED', 'LOW_BATTERY', 'SENSOR_ERROR'] } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['info', 'warning', 'critical'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: successEnvelope({ type: 'object' }) },
      },
      post: {
        tags: ['Events'],
        summary: 'Store an event manually (duplicate dedupeKey is not stored twice)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deviceId', 'type'],
                properties: {
                  deviceId: { type: 'string' },
                  type: { type: 'string', enum: ['POSTURE_INCORRECT', 'VIBRATION_ALERT', 'DEVICE_DISCONNECTED', 'DEVICE_RECONNECTED', 'LOW_BATTERY', 'SENSOR_ERROR'] },
                  severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
                  timestamp: { type: 'string', format: 'date-time' },
                  sessionId: { type: 'string' },
                  metadata: { type: 'object' },
                  dedupeKey: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: successEnvelope({ type: 'object' }, 'Event stored'), 200: successEnvelope({ type: 'object' }, 'Event already exists'), 400: validationError },
      },
    },
    '/api/v1/events/{id}': {
      get: {
        tags: ['Events'],
        summary: 'One event',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: successEnvelope({ type: 'object' }), 404: { description: 'Not found' } },
      },
    },
    '/api/v1/ai/recommendations': {
      post: {
        tags: ['AI'],
        summary: 'Generate posture recommendations from aggregated statistics (optional feature)',
        description:
          'Requires GEMINI_API_KEY on the server. Returns 503 with code GEMINI_NOT_CONFIGURED when the key is absent and 400 with code NO_POSTURE_DATA when there is nothing to analyse. Identical statistics are served from cache.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  period: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' },
                  deviceId: { type: 'string' },
                  refresh: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          200: successEnvelope({ type: 'object' }),
          400: validationError,
          429: { description: 'AI rate limit reached', content: { 'application/json': { schema: errorResponse } } },
          502: { description: 'Gemini returned an unusable response', content: { 'application/json': { schema: errorResponse } } },
          503: { description: 'Gemini is not configured or unavailable', content: { 'application/json': { schema: errorResponse } } },
          504: { description: 'Gemini timed out', content: { 'application/json': { schema: errorResponse } } },
        },
      },
    },
    '/api/v1/ai/recommendations/live': {
      get: {
        tags: ['AI'],
        summary: 'Advice for the posture observed in the last few minutes',
        description:
          'Reads a short rolling window of real telemetry, determines the dominant recent posture and returns posture-specific coaching. Always answers 200: when Gemini is absent, slow, rate limited or returns unusable JSON the deterministic posture template is returned instead (`source: "fallback"`). Stale telemetry is reported with `stale: true` rather than presented as a live reading. Nothing is persisted.',
        parameters: [
          { name: 'deviceId', in: 'query', schema: { type: 'string', example: 'posture-belt-01' } },
          {
            name: 'windowMinutes',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 120, default: 10 },
          },
        ],
        responses: { 200: successEnvelope({ type: 'object' }), 400: validationError },
      },
    },
    '/api/v1/ai/recommendations/latest': {
      get: {
        tags: ['AI'],
        summary: 'Latest cached recommendation for a period',
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' } },
          { name: 'deviceId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: successEnvelope({ type: 'object' }), 404: { description: 'No recommendation stored yet' } },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: errorResponse,
    },
  },
} as const;

export function mountSwagger(app: Express): void {
  if (!env.SWAGGER_ENABLED) {
    return;
  }

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'SmartPosture API',
    }),
  );
}
