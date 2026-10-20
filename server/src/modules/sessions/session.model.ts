import { Schema, model, type InferSchemaType } from 'mongoose';

const sessionStatisticsSchema = new Schema(
  {
    measurements: { type: Number, default: 0, min: 0 },
    incorrectPostureEvents: { type: Number, default: 0, min: 0 },
    goodDurationSeconds: { type: Number, default: 0, min: 0 },
    badDurationSeconds: { type: Number, default: 0, min: 0 },
    monitoredDurationSeconds: { type: Number, default: 0, min: 0 },
    goodPosturePercentage: { type: Number, default: 0, min: 0, max: 100 },
    averageAngle: { type: Number, default: null },
  },
  { _id: false },
);

const sessionSchema = new Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    startedAt: { type: Date, required: true },
    /** `null` while the session is still active. */
    endedAt: { type: Date, default: null },
    statistics: { type: sessionStatisticsSchema, default: () => ({}) },
    notes: { type: String, trim: true, maxlength: 2000, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

sessionSchema.index({ deviceId: 1, startedAt: -1 });
sessionSchema.index({ endedAt: 1 });
// A device can only have one active session at a time.
sessionSchema.index({ deviceId: 1, endedAt: 1 });

export type SessionAttributes = InferSchemaType<typeof sessionSchema>;
export const Session = model('Session', sessionSchema);
