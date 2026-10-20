import type { PostureLabel } from '../../shared/domain';

/**
 * Deterministic, posture-specific coaching.
 *
 * This is the single source of truth for the wording of a coaching card. Gemini
 * may personalise it, but it is never the only source of advice: when the key is
 * missing, the call times out, the quota is exhausted or the answer is unusable,
 * the backend still returns exactly these templates.
 *
 * The templates answer the four questions the coach is built around:
 * what is happening (the label), what to do now (`immediateAction`), why it
 * matters (`futureImpact`) and how urgent it is (`priority`). The `reason`
 * field is always derived from the aggregated telemetry of the window, never
 * invented.
 *
 * The wording deliberately avoids medical claims: no promise of injury
 * prevention, pain relief or any other clinical outcome.
 */

export type CoachingPriority = 'low' | 'medium' | 'high';

export interface CoachingAdvice {
  title: string;
  immediateAction: string;
  futureImpact: string;
  priority: CoachingPriority;
  /** One short sentence grounded in the telemetry that produced this advice. */
  reason: string;
}

/** Data-quality vocabulary, mirrored from the live recommendation service. */
export type CoachingDataQuality = 'none' | 'limited' | 'recent' | 'established';

/**
 * Everything the coach is allowed to reason about.
 *
 * Every field comes from aggregated telemetry inside the analysed window: no
 * field is ever synthesised to make the advice sound more specific than the
 * measurements allow.
 */
export interface CoachingContext {
  /**
   * The posture the advice is written for: the latest classified posture of the
   * window. `null` means the window could not name a posture at all.
   */
  posture: PostureLabel | null;
  /** Seconds the incorrect-posture run still in progress has lasted. */
  persistentIncorrectSeconds: number;
  /** Continuous incorrect-posture runs counted in the window. */
  incorrectPostureEvents: number;
  /** Classification changes between consecutive measurements. */
  postureChanges: number;
  /** Measurements inside the window. */
  sampleCount: number;
  /** How dense the window is, which drives the caution of the wording. */
  dataQuality: CoachingDataQuality;
  /** Share of monitored time spent in good posture (0-100). */
  goodPosturePercentage: number;
  /** Measurements carrying the most frequent label of the window. */
  dominantCount: number;
}

export const COACHING_THRESHOLDS = {
  /** Above this, an incorrect posture counts as persistent rather than brief. */
  persistentIncorrectSeconds: 30,
  /** Above this, an incorrect posture counts as repeatedly detected. */
  repeatedIncorrectEvents: 3,
} as const;

const PRIORITY_RANK: Record<CoachingPriority, number> = { low: 0, medium: 1, high: 2 };

/**
 * Escalate-only comparison. The deterministic assessment is a floor: a lower
 * assessment (for example a `low` returned by the model for a posture that has
 * clearly persisted) can never silently downplay a real signal.
 */
export function maxPriority(a: CoachingPriority, b: CoachingPriority): CoachingPriority {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

/** Fixed wording per posture. Priority and reason are computed for the window. */
type CoachingTemplate = Pick<CoachingAdvice, 'title' | 'immediateAction' | 'futureImpact'>;

export const COACHING_BY_POSTURE: Record<PostureLabel, CoachingTemplate> = {
  GOOD_POSTURE: {
    title: "You're building a good habit",
    immediateAction:
      'Your posture looks good. Keep your back comfortably aligned, relax your shoulders, and continue moving naturally.',
    futureImpact:
      'Consistent, comfortable posture habits may support better long-term movement habits. Your future self may thank you for the care you take today.',
  },
  SLOUCHING: {
    title: 'Give your back a gentle reset',
    immediateAction:
      'Sit or stand a little taller, relax your shoulders, and gently bring your torso back into a comfortable neutral position.',
    futureImpact:
      'Repeatedly practising small corrections can help you build greater awareness of your posture over time.',
  },
  LEAN_LEFT: {
    title: 'Bring your posture back to center',
    immediateAction:
      'Gently center your torso. Check whether your chair, desk, phone, or the way you are sitting is making you lean to one side.',
    futureImpact:
      'Regularly noticing and correcting repeated leaning may help you build more balanced posture habits.',
  },
  LEAN_RIGHT: {
    title: 'Find your center again',
    immediateAction:
      'Gently bring your torso back to a comfortable centered position. Check whether your desk setup or the way you are holding your phone is encouraging you to lean right.',
    futureImpact:
      'Consistent awareness of repeated leaning can help reinforce more balanced everyday habits.',
  },
  HEAD_FORWARD: {
    title: 'Bring your head back into alignment',
    immediateAction:
      'Gently bring your head back over your shoulders and position your screen at a comfortable viewing height.',
    futureImpact:
      'Small, consistent adjustments may help you develop more comfortable screen-use habits.',
  },
  UNKNOWN: {
    title: "Let's get a clearer reading",
    immediateAction:
      'Adjust the wearable so the sensor is positioned correctly, then return to a comfortable position.',
    futureImpact:
      'More reliable readings can help the app give you more relevant posture feedback.',
  },
};

const POSTURE_PHRASES: Record<PostureLabel, string> = {
  GOOD_POSTURE: 'good neutral posture',
  SLOUCHING: 'forward slouching',
  LEAN_LEFT: 'leaning to the left',
  LEAN_RIGHT: 'leaning to the right',
  HEAD_FORWARD: 'a forward head position',
  UNKNOWN: 'an unclassified position',
};

/** Human-readable phrase for a posture label ("forward slouching"). */
export function describePosture(label: PostureLabel | null | undefined): string {
  if (!label) {
    return 'no classified posture';
  }
  return POSTURE_PHRASES[label] ?? 'an unclassified position';
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) {
    return `${total} s`;
  }
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest > 0 ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/**
 * Is the incorrect posture persistent or repeatedly detected? These two signals
 * decide whether slouching and leaning deserve a high priority instead of a
 * routine reminder.
 */
function isPersistentOrRepeated(context: CoachingContext): boolean {
  return (
    context.persistentIncorrectSeconds >= COACHING_THRESHOLDS.persistentIncorrectSeconds ||
    context.incorrectPostureEvents >= COACHING_THRESHOLDS.repeatedIncorrectEvents
  );
}

/** The priority the telemetry itself justifies, before any model input. */
export function priorityFor(label: PostureLabel, context: CoachingContext): CoachingPriority {
  switch (label) {
    case 'GOOD_POSTURE':
    case 'UNKNOWN':
      return 'low';
    case 'SLOUCHING':
    case 'LEAN_LEFT':
    case 'LEAN_RIGHT':
    case 'HEAD_FORWARD':
      return isPersistentOrRepeated(context) ? 'high' : 'medium';
    default:
      return 'low';
  }
}

/**
 * One short sentence tied to real measurements. The caveat for a sparse window
 * is folded in rather than added as a second paragraph, so the card stays short.
 */
function buildReason(label: PostureLabel, context: CoachingContext): string {
  const parts: string[] = [];

  switch (label) {
    case 'GOOD_POSTURE':
      parts.push(
        context.incorrectPostureEvents > 0
          ? `You are in good posture now, but ${plural(
              context.incorrectPostureEvents,
              'incorrect-posture run',
            )} also appeared in this window`
          : `All ${plural(context.sampleCount, 'measurement')} in this window read as good posture`,
      );
      break;
    case 'SLOUCHING':
      parts.push(
        context.persistentIncorrectSeconds > 0
          ? `Slouching has been held for ${formatSeconds(context.persistentIncorrectSeconds)}`
          : `Slouching was the most frequent label in this window`,
      );
      if (context.incorrectPostureEvents > 1) {
        parts.push(`${plural(context.incorrectPostureEvents, 'incorrect-posture run')} were counted`);
      }
      break;
    case 'LEAN_LEFT':
    case 'LEAN_RIGHT': {
      const side = label === 'LEAN_LEFT' ? 'left' : 'right';
      parts.push(
        `Leaning ${side} appeared in ${context.dominantCount} of ${plural(
          context.sampleCount,
          'measurement',
        )}`,
      );
      if (context.persistentIncorrectSeconds > 0) {
        parts.push(`and has been held for ${formatSeconds(context.persistentIncorrectSeconds)}`);
      }
      break;
    }
    case 'HEAD_FORWARD':
      parts.push(
        `A forward head position appeared in ${context.dominantCount} of ${plural(
          context.sampleCount,
          'measurement',
        )}`,
      );
      if (context.persistentIncorrectSeconds > 0) {
        parts.push(`and has been held for ${formatSeconds(context.persistentIncorrectSeconds)}`);
      }
      break;
    case 'UNKNOWN':
    default:
      parts.push(
        `None of the ${plural(context.sampleCount, 'measurement')} in this window could be classified`,
      );
      break;
  }

  if (context.dataQuality === 'limited') {
    parts.push('only a few readings arrived, so treat this as a rough impression');
  }

  return `${parts.join('; ')}.`;
}

/**
 * Coaching template for the posture named by the context, personalised with the
 * rest of the window context. Falls back to the UNKNOWN template when no
 * posture can be named.
 */
export function coachingAdviceFor(context: CoachingContext): CoachingAdvice {
  const requested = context.posture;
  const resolved: PostureLabel = requested && COACHING_BY_POSTURE[requested] ? requested : 'UNKNOWN';
  const template = COACHING_BY_POSTURE[resolved];

  return {
    ...template,
    priority: priorityFor(resolved, context),
    reason: buildReason(resolved, context),
  };
}
