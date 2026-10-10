import { type Attributes, SpanStatusCode, trace } from '@opentelemetry/api';

export const TRACER_NAME = 'app';

/**
 * Runs `fn` in a new span. The span records an exception and error status if `fn` throws.
 * Keep attribute values low in detail: ids are fine on spans, but never personal data.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T>,
): Promise<T> {
  return trace.getTracer(TRACER_NAME).startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error) span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

/** Trace and span id of the active span, if any. */
export function currentTraceIds(): { traceId?: string; spanId?: string } {
  const context = trace.getActiveSpan()?.spanContext();
  if (!context || !trace.isSpanContextValid(context)) return {};
  return { traceId: context.traceId, spanId: context.spanId };
}
