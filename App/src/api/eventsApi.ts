import { LIST_PAGE_SIZE } from '../config/appConfig';
import { apiRequest } from './client';
import { endpoints } from './endpoints';
import type { EventQuery, EventView, Paginated } from './types';

/**
 * `GET /api/v1/events`
 *
 * Events are produced by the backend / ESP32 integration. The mobile app only
 * reads them (`POST /events` is deliberately not exposed: there is no genuine
 * client-side event to record).
 */
export function listEvents(
  query: EventQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<EventView>> {
  const { page = 1, limit = LIST_PAGE_SIZE, ...filters } = query;
  return apiRequest<Paginated<EventView>>(endpoints.events, {
    query: { page, limit, ...filters },
    signal,
  });
}

/** `GET /api/v1/events/:id` */
export function getEvent(id: string, signal?: AbortSignal): Promise<EventView> {
  return apiRequest<EventView>(endpoints.event(id), { signal });
}
