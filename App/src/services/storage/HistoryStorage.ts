import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PostureSession, PostureEpisode, PostureClass } from '../../types/posture';

const HISTORY_PREFIX = 'smartposture:history:';

function dateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey(date: string): string {
  return `${HISTORY_PREFIX}${date}`;
}

/**
 * Append a posture episode to today's session and persist it.
 * If no session exists for today, one is created.
 */
export async function appendEpisode(
  episode: PostureEpisode,
  date = new Date(),
): Promise<void> {
  const key = dateKey(date);
  try {
    const session = await loadSession(key);
    session.episodes.push(episode);
    // If the episode's posture is poor and it's a new alert, increment alert count.
    if (isPoorPosture(episode.posture)) {
      session.alertCount += 1;
    }
    await saveSession(key, session);
  } catch (err) {
    console.warn('[HistoryStorage] Failed to append episode:', err);
  }
}

export async function loadSession(date: string): Promise<PostureSession> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(date));
    if (!raw) return { date, episodes: [], alertCount: 0 };
    return JSON.parse(raw) as PostureSession;
  } catch (err) {
    console.warn('[HistoryStorage] Failed to load session:', err);
    return { date, episodes: [], alertCount: 0 };
  }
}

export async function saveSession(date: string, session: PostureSession): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(date), JSON.stringify(session));
  } catch (err) {
    console.warn('[HistoryStorage] Failed to save session:', err);
    throw err;
  }
}

/** Load sessions for the last `days` days. */
export async function loadRecentSessions(days: number): Promise<PostureSession[]> {
  const sessions: PostureSession[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = dateKey(d);
    const session = await loadSession(key);
    sessions.push(session);
  }
  return sessions;
}

/** Load sessions for the current week (last 7 days). */
export async function loadWeeklySessions(): Promise<PostureSession[]> {
  return loadRecentSessions(7);
}

/** Clear all persisted history. */
export async function clearHistory(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const historyKeys = keys.filter((k) => k.startsWith(HISTORY_PREFIX));
    if (historyKeys.length > 0) {
      await AsyncStorage.multiRemove(historyKeys);
    }
  } catch (err) {
    console.warn('[HistoryStorage] Failed to clear history:', err);
    throw err;
  }
}

function isPoorPosture(posture: PostureClass): boolean {
  return (
    posture === 'SLOUCHING' ||
    posture === 'LEAN_LEFT' ||
    posture === 'LEAN_RIGHT' ||
    posture === 'HEAD_FORWARD'
  );
}
