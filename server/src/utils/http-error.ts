/**
 * Application error with an HTTP status code and a stable machine-readable code.
 * Only errors created through this class are treated as "expected" by the error
 * middleware; everything else is reported as an unexpected server error.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(
    statusCode: number,
    message: string,
    options: { code?: string; details?: unknown; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = options.code ?? defaultCodeForStatus(statusCode);
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown, code = 'BAD_REQUEST'): AppError {
    return new AppError(400, message, { code, details });
  }

  static forbidden(message: string, details?: unknown, code = 'FORBIDDEN'): AppError {
    return new AppError(403, message, { code, details });
  }

  static notFound(message: string, details?: unknown, code = 'NOT_FOUND'): AppError {
    return new AppError(404, message, { code, details });
  }

  static conflict(message: string, details?: unknown, code = 'CONFLICT'): AppError {
    return new AppError(409, message, { code, details });
  }

  static payloadTooLarge(message = 'Request payload is too large'): AppError {
    return new AppError(413, message, { code: 'PAYLOAD_TOO_LARGE' });
  }

  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(429, message, { code: 'TOO_MANY_REQUESTS' });
  }

  static badGateway(message: string, details?: unknown): AppError {
    return new AppError(502, message, { code: 'BAD_GATEWAY', details, expose: true });
  }

  static serviceUnavailable(message: string, details?: unknown, code = 'SERVICE_UNAVAILABLE'): AppError {
    return new AppError(503, message, { code, details, expose: true });
  }

  static gatewayTimeout(message = 'Upstream service timed out'): AppError {
    return new AppError(504, message, { code: 'GATEWAY_TIMEOUT', expose: true });
  }

  static internal(message = 'Unexpected server error', details?: unknown): AppError {
    return new AppError(500, message, { code: 'INTERNAL_ERROR', details, expose: false });
  }
}

function defaultCodeForStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 502:
      return 'BAD_GATEWAY';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    case 504:
      return 'GATEWAY_TIMEOUT';
    default:
      return statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
