import { describe, expect, it } from 'vitest';
import { isUuidV7, newId } from './ids';

describe('newId', () => {
  it('creates sortable UUIDv7 values', () => {
    const first = newId();
    const second = newId();
    expect(isUuidV7(first)).toBe(true);
    expect(first < second).toBe(true);
  });
});
