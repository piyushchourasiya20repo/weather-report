import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import { APP_CONSTANTS } from '../constants';
import { env } from './env';

export const bootstrapLogger = pino({
  name: APP_CONSTANTS.NAME,
  level: env.LOG_LEVEL ?? APP_CONSTANTS.DEFAULT_LOG_LEVEL,
});

export function createRequestId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const incomingId = request.headers[APP_CONSTANTS.REQUEST_ID_HEADER];
  const traceId =
    typeof incomingId === 'string' && APP_CONSTANTS.REQUEST_ID_PATTERN.test(incomingId)
      ? incomingId
      : randomUUID();

  response.setHeader(APP_CONSTANTS.REQUEST_ID_HEADER, traceId);
  return traceId;
}