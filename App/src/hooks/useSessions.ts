import { listSessions } from '../api/sessionsApi';
import type { SessionQuery, SessionView } from '../api/types';
import { usePaginatedList, type PaginatedListState } from './usePaginatedList';

/** Paginated monitoring sessions from `GET /api/v1/sessions`. */
export function useSessions(
  filters: SessionQuery = {},
): PaginatedListState<SessionView> {
  const { status, from, to, sort, deviceId, limit } = filters;

  return usePaginatedList<SessionView>(
    (page, signal) => listSessions({ page, limit, status, from, to, sort, deviceId }, signal),
    { deps: [status, from, to, sort, deviceId, limit] },
  );
}
