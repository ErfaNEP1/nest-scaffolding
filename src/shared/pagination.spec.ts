import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, toCursorPage } from './pagination';

describe('cursor pagination', () => {
  it('round-trips a cursor', () => {
    const position = { sortValue: '2026-01-01T00:00:00.000Z', id: 'abc' };
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it('rejects malformed cursors', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('{"a":1}').toString('base64url'))).toBeNull();
  });

  it('sets nextCursor only when more rows exist', () => {
    const rows = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const position = (row: { id: string }) => ({ sortValue: row.id, id: row.id });
    const page = toCursorPage(rows, 2, position);
    expect(page.items).toHaveLength(2);
    expect(decodeCursor(page.nextCursor ?? '')).toEqual({ sortValue: '2', id: '2' });
    expect(toCursorPage(rows, 3, position).nextCursor).toBeNull();
  });
});
