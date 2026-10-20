import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { sendSuccess } from '../../utils/api-response';
import * as sessionService from './session.service';
import type { CreateSessionBody, EndSessionBody, ListSessionsQuery } from './session.validation';

export const getSessions: RequestHandler = asyncHandler(async (req, res) => {
  const result = await sessionService.listSessions(req.query as unknown as ListSessionsQuery);
  return sendSuccess(res, result);
});

export const postSession: RequestHandler = asyncHandler(async (req, res) => {
  const { session, created } = await sessionService.createSession(req.body as CreateSessionBody);
  return sendSuccess(
    res,
    session,
    created ? 'Session started' : 'Existing active session returned',
    created ? 201 : 200,
  );
});

export const getSessionById: RequestHandler = asyncHandler(async (req, res) => {
  const session = await sessionService.getSessionById(req.params.id);
  return sendSuccess(res, session);
});

export const patchSessionEnd: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as EndSessionBody;
  const { session, changed } = await sessionService.endSession(req.params.id, {
    endedAt: body.endedAt,
    notes: body.notes,
  });
  return sendSuccess(res, session, changed ? 'Session ended' : 'Session was already ended');
});
