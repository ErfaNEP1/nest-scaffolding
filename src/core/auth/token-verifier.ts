import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, errors as joseErrors, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { ConfigService } from '../../config';
import { DomainError, UnauthorizedError } from '../errors/domain-error';
import { type Principal, readRoles } from './principal';

/**
 * Verifies OIDC access tokens (JWT) against the issuer's JWKS: signature, issuer, audience,
 * expiry and allowed algorithms. Works with any OIDC provider; nothing is Keycloak-specific.
 */
@Injectable()
export class TokenVerifier {
  private keys: Promise<JWTVerifyGetKey> | undefined;

  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<Principal> {
    const auth = this.config.get('auth');
    const keys = await this.jwks();
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: auth.issuerUrl,
        audience: auth.audience,
        algorithms: auth.algorithms,
        clockTolerance: auth.clockToleranceSec,
        requiredClaims: ['sub', 'exp'],
      });
      return {
        subject: payload.sub ?? '',
        roles: readRoles(payload, auth.rolesClaimPath),
        claims: payload,
      };
    } catch (error) {
      throw toAuthError(error);
    }
  }

  /** JWKS from OIDC_JWKS_URL or, if unset, from the issuer's discovery document. Cached. */
  private jwks(): Promise<JWTVerifyGetKey> {
    this.keys ??= this.resolveJwksUrl()
      .then((url) => createRemoteJWKSet(url, { timeoutDuration: 5_000, cooldownDuration: 30_000 }))
      .catch((error: unknown) => {
        this.keys = undefined;
        throw toAuthError(error);
      });
    return this.keys;
  }

  private async resolveJwksUrl(): Promise<URL> {
    const auth = this.config.get('auth');
    if (auth.jwksUrl) return new URL(auth.jwksUrl);
    const discoveryUrl = `${auth.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`OIDC discovery failed with status ${response.status}`);
    const document: unknown = await response.json();
    const jwksUri: unknown =
      document && typeof document === 'object' ? Reflect.get(document, 'jwks_uri') : undefined;
    if (typeof jwksUri !== 'string') throw new Error('OIDC discovery document has no jwks_uri');
    return new URL(jwksUri);
  }
}

/** Token problems → 401. Identity provider unreachable → 503 (retryable). */
function toAuthError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  if (error instanceof joseErrors.JWTExpired) {
    return new UnauthorizedError('TOKEN_EXPIRED', 'The access token has expired.');
  }
  if (error instanceof joseErrors.JWKSTimeout || !(error instanceof joseErrors.JOSEError)) {
    return new DomainError(
      'AUTH_UNAVAILABLE',
      'The identity provider could not be reached. Retry later.',
      503,
      { cause: error, retryable: true },
    );
  }
  return new UnauthorizedError('INVALID_TOKEN', 'The access token is not valid.');
}
