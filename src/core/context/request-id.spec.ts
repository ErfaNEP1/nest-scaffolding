import { describe, expect, it } from 'vitest';
import { isUuidV7 } from '../../shared/ids';
import { resolveRequestId } from './request-id';

describe('resolveRequestId', () => {
  it('keeps a valid client value', () => {
    expect(resolveRequestId('abc-123-def.456')).toBe('abc-123-def.456');
    expect(resolveRequestId(['first-value-1', 'second'])).toBe('first-value-1');
  });

  it.each([undefined, '', 'short', 'has space in it', 'new\nline-injection', 'x'.repeat(129)])(
    'generates a new id for %j',
    (header) => {
      expect(isUuidV7(resolveRequestId(header))).toBe(true);
    },
  );
});
