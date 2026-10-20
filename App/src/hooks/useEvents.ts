import { listEvents } from '../api/eventsApi';
import type { EventQuery, EventView } from '../api/types';
import { usePaginatedList, type PaginatedListState } from './usePaginatedList';

/** Paginated stored events from `GET /api/v1/events`. */
export function useEvents(filters: EventQuery = {}): PaginatedListState<EventView> {
  const { type, severity, sessionId, from, to, sort, deviceId, limit } = filters;

  return usePaginatedList<EventView>(
    (page, signal) =>
      listEvents({ page, limit, type, severity, sessionId, from, to, sort, deviceId }, signal),
    { deps: [type, severity, sessionId, from, to, sort, deviceId, limit] },
  );
}
