import type { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { sendSuccess } from '../../utils/api-response';
import { AppError } from '../../utils/http-error';
import * as eventService from './event.service';
import type { CreateEventBody, ListEventsQuery } from './event.validation';

export const getEvents: RequestHandler = asyncHandler(async (req, res) => {
  const result = await eventService.listEvents(req.query as unknown as ListEventsQuery);
  return sendSuccess(res, result);
});

export const getEventById: RequestHandler = asyncHandler(async (req, res) => {
  const event = await eventService.getEventById(req.params.id);
  if (!event) {
    throw AppError.notFound(`Event ${req.params.id} was not found`, undefined, 'EVENT_NOT_FOUND');
  }
  return sendSuccess(res, event);
});

export const postEvent: RequestHandler = asyncHandler(async (req, res) => {
  const result = await eventService.createEventFromBody(req.body as CreateEventBody);
  return sendSuccess(
    res,
    result,
    result.created ? 'Event stored' : 'Event already exists',
    result.created ? 201 : 200,
  );
});
