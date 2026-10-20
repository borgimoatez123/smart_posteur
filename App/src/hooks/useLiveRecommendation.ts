import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getLiveRecommendation } from '../api/recommendationsApi';
import type { LiveRecommendationView } from '../api/types';
import { DEVICE_ID, LIVE_AI_POLL_INTERVAL_MS, LIVE_AI_WINDOW_MINUTES } from '../config/appConfig';
import { useResource, type ResourceState } from './useResource';

/**
 * Live AI advice from `GET /ai/recommendations/live`.
 *
 * - fetched when the screen gains focus and refreshed at a conservative
 *   interval (the endpoint is rate limited and may call Gemini on a cache miss)
 * - polling stops while the screen is unfocused and on unmount
 * - `useResource` keeps a single in-flight request, so a slow answer can never
 *   be overlapped by the next poll tick
 *
 * A resolved promise only means the backend answered: callers must still read
 * `available`, `stale`, `dataQuality` and `source`.
 */
export function useLiveRecommendation(
  deviceId: string = DEVICE_ID,
  windowMinutes: number = LIVE_AI_WINDOW_MINUTES,
): ResourceState<LiveRecommendationView> {
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return useResource<LiveRecommendationView>(
    (signal) => getLiveRecommendation(deviceId, windowMinutes, signal),
    {
      enabled: focused,
      pollMs: LIVE_AI_POLL_INTERVAL_MS,
      deps: [deviceId, windowMinutes],
    },
  );
}
