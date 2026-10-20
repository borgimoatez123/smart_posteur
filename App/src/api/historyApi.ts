import { LIST_PAGE_SIZE } from '../config/appConfig';
import { apiRequest } from './client';
import { endpoints } from './endpoints';
import type { HistoryQuery, HistoryRecord, Paginated } from './types';

/** `GET /api/v1/history` — paginated, filterable telemetry history. */
export function listHistory(
  query: HistoryQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<HistoryRecord>> {
  const { page = 1, limit = LIST_PAGE_SIZE, ...filters } = query;
  return apiRequest<Paginated<HistoryRecord>>(endpoints.history, {
    query: { page, limit, ...filters },
    signal,
  });
}

/** `GET /api/v1/history/:id` */
export function getHistoryRecord(id: string, signal?: AbortSignal): Promise<HistoryRecord> {
  return apiRequest<HistoryRecord>(endpoints.historyRecord(id), { signal });
}
