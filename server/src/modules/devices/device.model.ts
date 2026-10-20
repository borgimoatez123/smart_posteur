import { Schema, model, type InferSchemaType } from 'mongoose';
import { DEVICE_STATUSES, POSTURE_LABELS } from '../../shared/domain';

/**
 * Snapshot of the most recent telemetry, embedded in the device document so the
 * dashboard and status endpoints do not have to query the telemetry collection.
 */
const lastTelemetrySchema = new Schema(
  {
    posture: { type: String, enum: POSTURE_LABELS, default: null },
    angle: { type: Number, default: null },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    alert: { type: Boolean, default: false },
    battery: { type: Number, default: null, min: 0, max: 100 },
    sensorError: { type: Boolean, default: false },
    timestamp: { type: Date, default: null },
  },
  { _id: false },
);

const deviceSchema = new Schema(
  {
    deviceId: { type: String, required: true, trim: true, unique: true },
    name: { type: String, trim: true, maxlength: 120, default: null },
    status: { type: String, enum: DEVICE_STATUSES, default: 'unknown' },
    /** Last time the server actually heard from the device (server clock). */
    lastSeen: { type: Date, default: null },
    lastTelemetry: { type: lastTelemetrySchema, default: null },
    batteryLevel: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: true, versionKey: false },
);

// Used by the offline sweeper.
deviceSchema.index({ status: 1, lastSeen: 1 });

export type DeviceAttributes = InferSchemaType<typeof deviceSchema>;
export const Device = model('Device', deviceSchema);
