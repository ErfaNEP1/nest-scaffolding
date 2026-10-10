import type { ValidationIssue } from '../errors/domain-error';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** RFC 9457 Problem Details body, extended with `code`, `requestId` and validation `errors`. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  requestId: string;
  retryable?: boolean;
  errors?: ValidationIssue[];
}

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export function statusTitle(status: number): string {
  return TITLES[status] ?? (status >= 500 ? 'Server Error' : 'Client Error');
}

/** Problem type URI for a code: `urn:problem-type:not-found` for `NOT_FOUND`. */
export function problemType(code: string): string {
  return `urn:problem-type:${code.toLowerCase().replaceAll('_', '-')}`;
}
