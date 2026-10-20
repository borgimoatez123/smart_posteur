import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from '../api/client';
import type { Paginated, PaginationMeta } from '../api/types';

export interface PaginatedListState<T> {
  items: T[];
  meta: PaginationMeta | null;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  lastUpdatedAt: number | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export interface UsePaginatedListOptions {
  enabled?: boolean;
  deps?: readonly unknown[];
}

/**
 * Page based list loader.
 *
 * `refresh()` replaces the list with page 1, `loadMore()` appends the next page.
 * Requests never overlap: a new request aborts the previous one and stale
 * responses are discarded through an epoch counter.
 */
export function usePaginatedList<T>(
  fetcher: (page: number, signal: AbortSignal) => Promise<Paginated<T>>,
  options: UsePaginatedListOptions = {},
): PaginatedListState<T> {
  const { enabled = true, deps = [] } = options;

  const [state, setState] = useState<{
    items: T[];
    meta: PaginationMeta | null;
    loading: boolean;
    refreshing: boolean;
    loadingMore: boolean;
    error: ApiError | null;
    lastUpdatedAt: number | null;
  }>({
    items: [],
    meta: null,
    loading: enabled,
    refreshing: false,
    loadingMore: false,
    error: null,
    lastUpdatedAt: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const epochRef = useRef(0);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);

  const load = useCallback(async (page: number, mode: 'initial' | 'refresh' | 'more'): Promise<void> => {
    if (!enabled) return;

    const epoch = ++epochRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((previous) => ({
      ...previous,
      loading: mode === 'initial' && previous.items.length === 0,
      refreshing: mode === 'refresh',
      loadingMore: mode === 'more',
    }));

    try {
      const result = await fetcherRef.current(page, controller.signal);
      if (!mountedRef.current || epoch !== epochRef.current) return;

      pageRef.current = page;
      hasMoreRef.current = result.meta.hasNextPage;

      setState((previous) => ({
        items: mode === 'more' ? [...previous.items, ...result.items] : result.items,
        meta: result.meta,
        loading: false,
        refreshing: false,
        loadingMore: false,
        error: null,
        lastUpdatedAt: Date.now(),
      }));
    } catch (error) {
      if (!mountedRef.current || epoch !== epochRef.current) return;
      const apiError = toApiError(error);
      if (apiError.code === 'CANCELLED') return;
      setState((previous) => ({
        ...previous,
        loading: false,
        refreshing: false,
        loadingMore: false,
        error: apiError,
      }));
    }
  }, [enabled]);

  const refresh = useCallback(async () => {
    await load(1, 'refresh');
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current) return;
    await load(pageRef.current + 1, 'more');
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      epochRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    pageRef.current = 1;
    hasMoreRef.current = false;
    setState((previous) => ({ ...previous, items: [], meta: null, loading: true, error: null }));
    void load(1, 'initial');
    return () => {
      epochRef.current += 1;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load, ...deps]);

  return {
    ...state,
    hasMore: hasMoreRef.current,
    refresh,
    loadMore,
  };
}
