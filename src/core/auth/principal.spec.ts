import { describe, expect, it } from 'vitest';
import { readRoles } from './principal';

describe('readRoles', () => {
  it('reads an array at a dot path', () => {
    expect(readRoles({ realm_access: { roles: ['a', 'b', 3] } }, 'realm_access.roles')).toEqual([
      'a',
      'b',
    ]);
  });

  it('reads a space-separated string', () => {
    expect(readRoles({ scope: 'read write' }, 'scope')).toEqual(['read', 'write']);
  });

  it('returns [] for missing paths', () => {
    expect(readRoles({}, 'realm_access.roles')).toEqual([]);
  });
});
