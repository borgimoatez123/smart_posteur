import { LIST_PAGE_SIZE } from '../config/appConfig';
import { apiRequest } from './client';
import { endpoints } from './endpoints';
import type { CreateSessionBody, EndSessionBody, Paginated, SessionQuery, SessionView } from './types';

/** `GET /api/v1/sessions` */
export function listSessions(
  query: SessionQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<SessionView>> {
  const { page = 1, limit = LIST_PAGE_SIZE, ...filters } = query;
  return apiRequest<Paginated<SessionView>>(endpoints.sessions, {
    query: { page, limit, ...filters },
    signal,
  });
}

/**
 * `POST /api/v1/sessions`
 *
 * The backend returns the already-active session (with `200`) instead of
 * creating a duplicate; callers must surface the returned message.
 */
export function createSession(
  body: CreateSessionBody,
  signal?: AbortSignal,
): Promise<SessionView> {
  return apiRequest<SessionView>(endpoints.sessions, { method: 'POST', body, signal });
}

/** `GET /api/v1/sessions/:id` */
export function getSession(id: string, signal?: AbortSignal): Promise<SessionView> {
  return apiRequest<SessionView>(endpoints.session(id), { signal });
}

/** `PATCH /api/v1/sessions/:id/end` — idempotent. */
export function endSession(
  id: string,
  body: EndSessionBody = {},
  signal?: AbortSignal,
): Promise<SessionView> {
  return apiRequest<SessionView>(endpoints.sessionEnd(id), { method: 'PATCH', body, signal });
}
