import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, toApiError } from '../api/client';

export interface ResourceState<T> {
  /** Last successfully loaded value, or null before the first success. */
  data: T | null;
  /** Last failure. Data is preserved (stale) when set. */
  error: ApiError | null;
  /** True during the very first load (no data yet). */
  loading: boolean;
  /** True during a user triggered / background refresh while data exists. */
  refreshing: boolean;
  /** Epoch ms of the last successful load. */
  lastUpdatedAt: number | null;
  /** Manual retry / refresh. */
  reload: () => Promise<void>;
}

export interface UseResourceOptions {
  /** When false, no request is issued and the resource stays idle. */
  enabled?: boolean;
  /** Poll interval in ms. Omit to disable polling. */
  pollMs?: number;
  /** Values that reset and refetch the resource when they change. */
  deps?: readonly unknown[];
}

/**
 * Loads an async resource with:
 *  - a single in-flight request (overlapping polls are impossible because the
 *    next tick is only scheduled after the current request settles)
 *  - request cancellation on unmount / dependency change
 *  - stale-response protection via an epoch counter
 *  - a refresh when the app returns to the foreground
 */
export function useResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseResourceOptions = {},
): ResourceState<T> {
  const { enabled = true, pollMs, deps = [] } = options;

  const [state, setState] = useState<{
    data: T | null;
    error: ApiError | null;
    loading: boolean;
    refreshing: boolean;
    lastUpdatedAt: number | null;
  }>({
    data: null,
    error: null,
    loading: enabled,
    refreshing: false,
    lastUpdatedAt: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const epochRef = useRef(0);

  const run = useCallback(async (mode: 'initial' | 'silent' | 'manual'): Promise<void> => {
    if (!enabledRef.current) return;

    const epoch = ++epochRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (mode !== 'silent') {
      setState((previous) => ({
        ...previous,
        loading: mode === 'initial' && previous.data === null,
        refreshing: mode === 'manual',
      }));
    }

    try {
      const data = await fetcherRef.current(controller.signal);
      if (!mountedRef.current || epoch !== epochRef.current) return;
      setState({
        data,
        error: null,
        loading: false,
        refreshing: false,
        lastUpdatedAt: Date.now(),
      });
    } catch (error) {
      if (!mountedRef.current || epoch !== epochRef.current) return;
      const apiError = toApiError(error);
      if (apiError.code === 'CANCELLED') return;
      // Keep any previously loaded data so the UI can show stale values.
      setState((previous) => ({
        ...previous,
        error: apiError,
        loading: false,
        refreshing: false,
      }));
    }
  }, []);

  const reload = useCallback(async () => {
    await run('manual');
  }, [run]);

  // Mount lifecycle: cancel in-flight work when the screen unmounts.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      epochRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  // Primary load / refetch when dependencies change.
  useEffect(() => {
    if (!enabled) {
      setState((previous) => ({ ...previous, loading: false, refreshing: false }));
      return;
    }
    void run('initial');
    return () => {
      // Invalidate the pending response when deps change or on unmount.
      epochRef.current += 1;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  // Polling: schedule the next tick only after the previous one settles.
  useEffect(() => {
    if (!enabled || !pollMs) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      await run('silent');
      if (cancelled) return;
      timer = setTimeout(() => {
        void tick();
      }, pollMs);
    };

    timer = setTimeout(() => {
      void tick();
    }, pollMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollMs, run, ...deps]);

  // Refresh when the app returns to the foreground.
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run('silent');
    });
    return () => subscription.remove();
  }, [enabled, run]);

  return { ...state, reload };
}
