import { BadRequestException, HttpException, PayloadTooLargeException } from '@nestjs/common';
import type { DomainError } from '../errors/domain-error';

type ErrorMapper = (error: unknown) => DomainError | HttpException | null;

/** Infrastructure errors that have a meaningful HTTP answer. The first match wins. */
const mappers: readonly ErrorMapper[] = [mapBodyParserError];

/** Returns the mapped error, or the original value if no mapper matched. */
export function mapKnownError(error: unknown): unknown {
  if (error instanceof HttpException) return error;
  for (const mapper of mappers) {
    const mapped = mapper(error);
    if (mapped) return mapped;
  }
  return error;
}

/** Errors raised by Express body parsing before Nest sees the request. */
function mapBodyParserError(error: unknown): HttpException | null {
  if (!(error instanceof Error) || !('type' in error)) return null;
  if (error.type === 'entity.too.large') return new PayloadTooLargeException();
  if (error.type === 'entity.parse.failed') {
    return new BadRequestException('The request body is not valid JSON.');
  }
  return null;
}
