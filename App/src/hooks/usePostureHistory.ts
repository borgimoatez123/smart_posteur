import { listHistory } from '../api/historyApi';
import type { HistoryQuery, HistoryRecord } from '../api/types';
import { usePaginatedList, type PaginatedListState } from './usePaginatedList';

/**
 * Paginated telemetry history from `GET /api/v1/history`.
 * Filters are plain primitives so they can be used as effect dependencies.
 */
export function usePostureHistory(
  filters: HistoryQuery = {},
): PaginatedListState<HistoryRecord> {
  const { posture, alert, sessionId, from, to, sort, deviceId, limit } = filters;

  return usePaginatedList<HistoryRecord>(
    (page, signal) =>
      listHistory({ page, limit, posture, alert, sessionId, from, to, sort, deviceId }, signal),
    { deps: [posture, alert, sessionId, from, to, sort, deviceId, limit] },
  );
}
