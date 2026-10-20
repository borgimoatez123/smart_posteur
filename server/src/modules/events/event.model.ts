import { Schema, model, type InferSchemaType } from 'mongoose';
import { EVENT_SEVERITIES, EVENT_TYPES } from '../../shared/domain';

const eventSchema = new Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', default: null },
    type: { type: String, enum: EVENT_TYPES, required: true },
    severity: { type: String, enum: EVENT_SEVERITIES, required: true },
    timestamp: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    /**
     * Prevents duplicate alerts for an event that is still ongoing (the same
     * incorrect posture, the same continuous low battery, ...).
     */
    dedupeKey: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

eventSchema.index({ deviceId: 1, timestamp: -1 });
eventSchema.index({ type: 1, timestamp: -1 });
eventSchema.index({ severity: 1, timestamp: -1 });
eventSchema.index({ sessionId: 1, timestamp: 1 });

export type PostureEventAttributes = InferSchemaType<typeof eventSchema>;
export const PostureEvent = model('PostureEvent', eventSchema);
