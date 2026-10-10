import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { currentContext } from '../context/context';
import { REQUEST_ID_HEADER } from '../context/request-id';
import { DomainError, ValidationError } from '../errors/domain-error';
import { mapKnownError } from './error-mapping';
import {
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
  problemType,
  statusTitle,
} from './problem-details';

/**
 * The only place that turns errors into HTTP responses (RFC 9457 Problem Details).
 * Unknown errors become a generic 500: stack traces and SQL never reach the client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(ProblemDetailsFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const problem = this.toProblem(exception, req, res);
    this.log(exception, problem);

    if (res.headersSent) return;
    if (problem.status === 401) res.setHeader('www-authenticate', 'Bearer');
    res
      .status(problem.status)
      .setHeader('content-type', `${PROBLEM_CONTENT_TYPE}; charset=utf-8`)
      .send(JSON.stringify(problem));
  }

  private toProblem(exception: unknown, req: Request, res: Response): ProblemDetails {
    const requestId = currentContext().requestId ?? String(res.getHeader(REQUEST_ID_HEADER) ?? '');
    const base = { instance: req.originalUrl.split('?')[0] ?? '', requestId };
    const error = mapKnownError(exception);

    if (error instanceof DomainError) {
      return {
        ...base,
        type: problemType(error.code),
        title: statusTitle(error.status),
        status: error.status,
        detail: error.message,
        code: error.code,
        ...(error.retryable ? { retryable: true } : {}),
        ...(error instanceof ValidationError ? { errors: error.issues } : {}),
      };
    }

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const code = httpCode(status);
      return {
        ...base,
        type: problemType(code),
        title: statusTitle(status),
        status,
        detail: status >= 500 ? 'An unexpected error occurred.' : error.message,
        code,
      };
    }

    return {
      ...base,
      type: problemType('INTERNAL_ERROR'),
      title: statusTitle(500),
      status: 500,
      detail: 'An unexpected error occurred.',
      code: 'INTERNAL_ERROR',
    };
  }

  private log(exception: unknown, problem: ProblemDetails): void {
    const fields = { code: problem.code, status: problem.status };
    if (problem.status >= 500) {
      this.logger.error({ ...fields, err: exception }, 'request failed');
    } else if (problem.errors) {
      this.logger.info({ ...fields, errors: problem.errors }, 'request validation failed');
    } else {
      this.logger.warn({ ...fields, detail: problem.detail }, 'request rejected');
    }
  }
}

function httpCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'ROUTE_NOT_FOUND';
    case 405:
      return 'METHOD_NOT_ALLOWED';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
}
