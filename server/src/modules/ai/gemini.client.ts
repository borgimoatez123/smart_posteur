import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../utils/http-error';
import { formatZodIssues } from '../../middleware/validate.middleware';
import { logger } from '../../utils/logger';

export const DISCLAIMER =
  'These suggestions are general ergonomics and posture-habit tips. They are not a medical diagnosis, treatment or professional advice.';

const recommendationItemSchema = z.object({
  title: z.string().trim().min(3).max(160),
  detail: z.string().trim().min(10).max(1000),
  priority: z.enum(['low', 'medium', 'high']),
});

export const geminiRecommendationSchema = z.object({
  summary: z.string().trim().min(10).max(2000),
  recommendations: z.array(recommendationItemSchema).min(1).max(10),
});

export type GeminiRecommendation = z.infer<typeof geminiRecommendationSchema>;

/**
 * One-shot coaching for the *current* posture, from a short rolling window.
 *
 * This is the exact structure requested from the provider: a short title, the
 * action to take now, the reason it matters later, the urgency and one sentence
 * tying it back to the telemetry that triggered it.
 */
export const liveAdviceSchema = z.object({
  title: z.string().trim().min(3).max(120),
  immediateAction: z.string().trim().min(10).max(600),
  futureImpact: z.string().trim().min(10).max(400),
  priority: z.enum(['low', 'medium', 'high']),
  reason: z.string().trim().min(5).max(300),
});

export type LiveAdvice = z.infer<typeof liveAdviceSchema>;

/** Sentence/word budget of the coaching card, enforced after the schema. */
export const LIVE_ADVICE_WORD_LIMITS = {
  title: 12,
  immediateAction: 45,
  futureImpact: 45,
  reason: 40,
} as const;

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Rejects advice that is structurally valid but unusable as a coaching card
 * (a paragraph instead of a title, an essay instead of an action). The caller
 * then serves the deterministic posture template instead, so a verbose model
 * answer can never leak a wall of text into the mobile card.
 */
export function isLiveAdviceUsable(advice: LiveAdvice): boolean {
  return (
    wordCount(advice.title) <= LIVE_ADVICE_WORD_LIMITS.title &&
    wordCount(advice.immediateAction) <= LIVE_ADVICE_WORD_LIMITS.immediateAction &&
    wordCount(advice.futureImpact) <= LIVE_ADVICE_WORD_LIMITS.futureImpact &&
    wordCount(advice.reason) <= LIVE_ADVICE_WORD_LIMITS.reason
  );
}

export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

const STATISTICS_SYSTEM_INSTRUCTION = [
  'You are an ergonomics assistant for a wearable posture monitor (ESP32 + MPU6050).',
  'You only ever receive AGGREGATED posture statistics: never a raw sensor stream and never personal data.',
  'Return 2 to 5 concise, practical recommendations based on the observed posture patterns.',
  'Reference the actual numbers (for example the share of time spent in incorrect posture).',
  'Never diagnose or treat a medical condition. Never mention medication or therapy.',
  'If the data is sparse, say so explicitly instead of inventing patterns.',
  'Answer in English, in a neutral and supportive tone.',
].join(' ');

const LIVE_SYSTEM_INSTRUCTION = [
  'You are a posture coach for a wearable posture monitor (ESP32 + MPU6050).',
  'You receive a compact aggregated summary of the LAST FEW MINUTES of one person: the current posture, the posture distribution, the average angle, how long the incorrect posture has been running and how dense the window is.',
  'Answer the four questions: what is happening now, what to do immediately, why it matters later, and how urgent it is.',
  'Return ONE piece of coaching for the current posture. Never restate the statistics and never repeat percentages or counts that are already shown elsewhere in the app.',
  'Personalise the action from the telemetry you were given: a posture that has persisted or been detected repeatedly deserves a more urgent tone than a brief one-off reading.',
  'Keep "title" under 12 words. Keep "immediateAction" under 35 words. Keep "futureImpact" to one sentence. Keep "reason" to one sentence that names the actual measurements it relies on.',
  'Never invent measurements, durations or trends that are not present in the summary. If the window is limited or sparse, say so instead of claiming a pattern.',
  'If the current posture is unknown or unclassified, ask the person to reposition the sensor; never claim that movement was verified and never treat an unknown reading as good or bad posture.',
  'Never tell the person to hold a rigid posture for long periods, and never claim the sensor can diagnose a condition or predict a medical outcome. Use cautious wording ("may help").',
  'Answer in English, in a neutral and supportive tone.',
].join(' ');

const RECOMMENDATIONS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'detail', 'priority'],
      },
    },
  },
  required: ['summary', 'recommendations'],
} as const;

const LIVE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    immediateAction: { type: 'string' },
    futureImpact: { type: 'string' },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string' },
  },
  required: ['title', 'immediateAction', 'futureImpact', 'priority', 'reason'],
} as const;

export interface GeminiCallResult<T> {
  model: string;
  result: T;
}

interface GeminiCallOptions<T> {
  systemInstruction: string;
  prompt: string;
  /** JSON schema handed to the Interactions API as the response format. */
  responseSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
}

/**
 * Shared Interactions API call (SDK >= 2.0.0).
 *
 * The API key lives exclusively on the backend; it is never returned in an HTTP
 * response and never shipped to Flutter or the ESP32. Every failure mode (no
 * key, timeout, rate limit, malformed JSON, schema mismatch) is mapped to an
 * explicit AppError so callers can degrade gracefully instead of crashing.
 */
async function callGemini<T>(options: GeminiCallOptions<T>): Promise<GeminiCallResult<T>> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw AppError.serviceUnavailable(
      'GEMINI_API_KEY is not configured on the server; AI recommendations are disabled.',
      undefined,
      'GEMINI_NOT_CONFIGURED',
    );
  }

  const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: env.GEMINI_TIMEOUT_MS } });

  let rawText: string | undefined;
  try {
    const interaction = await client.interactions.create({
      model: env.GEMINI_MODEL,
      system_instruction: options.systemInstruction,
      input: options.prompt,
      // A JSON schema constrains the model to the exact shape validated below.
      response_format: options.responseSchema,
      generation_config: { temperature: 0.4 },
    });

    if (interaction.status !== 'completed') {
      throw AppError.badGateway('Gemini did not complete the interaction', {
        interactionStatus: interaction.status,
        interactionId: interaction.id,
      });
    }

    rawText = interaction.output_text;
  } catch (error) {
    throw mapGeminiError(error);
  }

  if (!rawText || rawText.trim().length === 0) {
    throw AppError.badGateway('Gemini returned an empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    logger.error({ err: error }, 'Gemini returned malformed JSON');
    throw AppError.badGateway('Gemini returned a malformed JSON payload');
  }

  const validated = options.schema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ issues: formatZodIssues(validated.error) }, 'Gemini response failed validation');
    throw AppError.badGateway('Gemini response did not match the expected structure', {
      issues: formatZodIssues(validated.error),
    });
  }

  return { model: env.GEMINI_MODEL, result: validated.data };
}

function buildPrompt(statistics: unknown): string {
  return ['Aggregated posture statistics to analyse:', '', JSON.stringify(statistics, null, 2)].join('\n');
}

/** Day/week/month recommendations from aggregated statistics. */
export async function requestRecommendations(
  statistics: unknown,
): Promise<GeminiCallResult<GeminiRecommendation>> {
  return callGemini({
    systemInstruction: STATISTICS_SYSTEM_INSTRUCTION,
    prompt: buildPrompt(statistics),
    responseSchema: RECOMMENDATIONS_RESPONSE_SCHEMA,
    schema: geminiRecommendationSchema,
  });
}

/** Live advice for the posture observed in the last few minutes. */
export async function requestLiveAdvice(liveSummary: unknown): Promise<GeminiCallResult<LiveAdvice>> {
  return callGemini({
    systemInstruction: LIVE_SYSTEM_INSTRUCTION,
    prompt: ['Recent posture summary (last few minutes):', '', JSON.stringify(liveSummary, null, 2)].join(
      '\n',
    ),
    responseSchema: LIVE_RESPONSE_SCHEMA,
    schema: liveAdviceSchema,
  });
}

function mapGeminiError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const status = (error as { status?: number })?.status;

  if (/abort|timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(`${name} ${message}`)) {
    return AppError.gatewayTimeout(`Gemini did not answer within ${env.GEMINI_TIMEOUT_MS} ms`);
  }

  if (status === 429 || /429|rate limit|quota|resource_exhausted/i.test(message)) {
    return AppError.serviceUnavailable(
      'Gemini rate limit or quota reached, please retry later',
      { providerMessage: message },
      'GEMINI_RATE_LIMITED',
    );
  }

  if (status === 401 || status === 403 || /api key|permission denied|unauthenticated/i.test(message)) {
    return AppError.serviceUnavailable(
      'Gemini rejected the configured API key',
      { providerMessage: message },
      'GEMINI_UNAUTHORIZED',
    );
  }

  if (status === 404 || /not found|unsupported model/i.test(message)) {
    return AppError.badGateway('The configured Gemini model is unavailable', {
      providerMessage: message,
      model: env.GEMINI_MODEL,
    });
  }

  logger.error({ err: error }, 'Gemini request failed');
  return AppError.badGateway('Gemini request failed', { providerMessage: message });
}
