import type { FastifyError, FastifyInstance } from 'fastify';
import { STATUS_CODES } from 'node:http';

/**
 * Every API error has Fastify's shape: { statusCode, error, message }. The message is written for
 * the person using the app; a server error only says that it happened, and the log has the rest.
 */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export function apiError(statusCode: number, message: string): ApiError {
  return { statusCode, error: STATUS_CODES[statusCode] ?? 'Error', message };
}

/** An error to throw from a route; the error handler turns it into an ApiError. */
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    // An HttpError says what it means on purpose; any other server error is a surprise
    if (statusCode >= 500 && !(error instanceof HttpError)) {
      request.log.error({ err: error }, 'Request failed');
      return reply.code(statusCode).send(apiError(statusCode, 'Something went wrong on the server. Its log has the details.'));
    }
    return reply.code(statusCode).send(apiError(statusCode, error.message));
  });
}
