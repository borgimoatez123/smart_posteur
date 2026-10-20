import { Schema, model, type InferSchemaType } from 'mongoose';
import { POSTURE_LABELS } from '../../shared/domain';
import { env } from '../../config/env';

const sensorsSchema = new Schema(
  {
    ax: { type: Number, default: null },
    ay: { type: Number, default: null },
    az: { type: Number, default: null },
    gx: { type: Number, default: null },
    gy: { type: Number, default: null },
    gz: { type: Number, default: null },
  },
  { _id: false },
);

const postureSchema = new Schema(
  {
    label: { type: String, enum: POSTURE_LABELS, required: true },
    angle: { type: Number, required: true, min: -180, max: 180 },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    badDurationSeconds: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const telemetrySchema = new Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    /** Device clock. Falls back to the server clock when the device omits it. */
    timestamp: { type: Date, required: true },
    sensors: { type: sensorsSchema, default: null },
    posture: { type: postureSchema, required: true },
    alert: { type: Boolean, default: false },
    battery: { type: Number, default: null, min: 0, max: 100 },
    /** True when the payload carried a `sensors` object with no usable values. */
    sensorError: { type: Boolean, default: false },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', default: null },
    samplingHz: { type: Number, default: null, min: 0 },
    /**
     * Idempotency guard: deviceId + resolved timestamp + posture + alert flag.
     * A transport retry with the same payload can never create a second record.
     */
    dedupeKey: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

telemetrySchema.index({ deviceId: 1, timestamp: -1 });
telemetrySchema.index({ deviceId: 1, 'posture.label': 1, timestamp: -1 });
telemetrySchema.index({ sessionId: 1, timestamp: 1 });
telemetrySchema.index({ timestamp: -1 });

if (env.TELEMETRY_RETENTION_DAYS > 0) {
  // MongoDB TTL index: expired documents are removed by the TTL monitor.
  telemetrySchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: env.TELEMETRY_RETENTION_DAYS * 24 * 60 * 60, name: 'telemetry_retention_ttl' },
  );
}

export type TelemetryAttributes = InferSchemaType<typeof telemetrySchema>;
export const Telemetry = model('Telemetry', telemetrySchema);
