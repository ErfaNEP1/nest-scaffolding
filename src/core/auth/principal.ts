import type { JWTPayload } from 'jose';

/** The authenticated caller, built from a verified access token. */
export interface Principal {
  /** `sub` claim: stable id of the user or client at the identity provider. */
  subject: string;
  /** Roles read from the configured claim path (`OIDC_ROLES_CLAIM_PATH`). */
  roles: string[];
  /** All verified claims, for project-specific checks. */
  claims: JWTPayload;
}

/** Reads a string array at a dot path such as `realm_access.roles`. Missing → []. */
export function readRoles(claims: JWTPayload, path: string): string[] {
  let value: unknown = claims;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || !(key in value)) return [];
    value = Reflect.get(value, key) as unknown;
  }
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return value.split(' ').filter((item) => item.length > 0);
  return [];
}
