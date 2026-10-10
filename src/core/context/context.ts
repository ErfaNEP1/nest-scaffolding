import { ClsServiceManager, type ClsStore } from 'nestjs-cls';

/** Values carried through a request or a job with AsyncLocalStorage. */
export interface ContextValues {
  requestId?: string;
  userId?: string;
  jobId?: string;
  queue?: string;
}

const CONTEXT_KEYS = ['requestId', 'userId', 'jobId', 'queue'] as const;

export type AppClsStore = ClsStore & ContextValues;

/**
 * Context values of the current request or job. Returns an empty object outside a context.
 * Safe to call from anywhere, including the logger mixin.
 */
export function currentContext(): ContextValues {
  const cls = ClsServiceManager.getClsService<AppClsStore>();
  if (!cls.isActive()) return {};
  const values: ContextValues = {};
  const requestId = cls.get('requestId');
  const userId = cls.get('userId');
  const jobId = cls.get('jobId');
  const queue = cls.get('queue');
  if (requestId) values.requestId = requestId;
  if (userId) values.userId = userId;
  if (jobId) values.jobId = jobId;
  if (queue) values.queue = queue;
  return values;
}

/** Sets a value in the current context. Does nothing outside a context. */
export function setContextValue(key: keyof ContextValues, value: string): void {
  const cls = ClsServiceManager.getClsService<AppClsStore>();
  if (cls.isActive()) cls.set(key, value);
}

/** Runs `fn` in a fresh context holding `values` (used for jobs and other non-HTTP work). */
export function runInContext<T>(values: ContextValues, fn: () => T): T {
  const cls = ClsServiceManager.getClsService<AppClsStore>();
  return cls.run({ ifNested: 'override' }, () => {
    for (const key of CONTEXT_KEYS) {
      const value = values[key];
      if (value !== undefined) cls.set(key, value);
    }
    return fn();
  });
}
