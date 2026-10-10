import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, type JWK, type JWTPayload, SignJWT } from 'jose';
import { TEST_ENV } from './test-config';

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

export interface TokenOptions {
  subject?: string;
  roles?: string[];
  audience?: string;
  issuer?: string;
  expiresIn?: string | number;
  claims?: JWTPayload;
}

/**
 * A fake OIDC issuer for tests: signs JWTs with a local RS256 key and serves the matching
 * JWKS on localhost. Point the app at it with `issuer.env()`.
 */
export class TestIssuer {
  private constructor(
    private readonly server: Server,
    private readonly privateKey: PrivateKey,
    readonly jwksUrl: string,
  ) {}

  static async start(): Promise<TestIssuer> {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return new TestIssuer(server, privateKey, `http://127.0.0.1:${port}/certs`);
  }

  /** Env overrides that make the app trust this issuer. */
  env(): Record<string, string> {
    return { OIDC_JWKS_URL: this.jwksUrl };
  }

  async token(options: TokenOptions = {}): Promise<string> {
    return new SignJWT({ realm_access: { roles: options.roles ?? [] }, ...options.claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(options.subject ?? 'user-1')
      .setIssuer(options.issuer ?? TEST_ENV.OIDC_ISSUER_URL ?? '')
      .setAudience(options.audience ?? TEST_ENV.OIDC_AUDIENCE ?? '')
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(this.privateKey);
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
