/** A page of results with an opaque cursor for the next page (`null` when there is none). */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPageRequest {
  limit: number;
  cursor?: string | undefined;
}

/** Keyset position: the sort value and id of the last item of the previous page. */
export interface CursorPosition {
  sortValue: string;
  id: string;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify([position.sortValue, position.id]), 'utf8').toString(
    'base64url',
  );
}

/** Returns `null` for a malformed cursor so callers can answer with a validation error. */
export function decodeCursor(cursor: string): CursorPosition | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(decoded) &&
      decoded.length === 2 &&
      typeof decoded[0] === 'string' &&
      typeof decoded[1] === 'string'
    ) {
      return { sortValue: decoded[0], id: decoded[1] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Builds a page from `limit + 1` fetched rows: the extra row only tells us whether a next page exists.
 */
export function toCursorPage<T>(
  rows: T[],
  limit: number,
  positionOf: (row: T) => CursorPosition,
): CursorPage<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const hasMore = rows.length > limit;
  return { items, nextCursor: hasMore && last ? encodeCursor(positionOf(last)) : null };
}
