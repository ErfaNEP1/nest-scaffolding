import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthorizationPolicy, RolesAuthorizationPolicy } from './authorization-policy';
import { TokenVerifier } from './token-verifier';

/** OIDC Bearer token authentication for every HTTP route (global guard). */
@Module({
  providers: [
    TokenVerifier,
    { provide: AuthorizationPolicy, useClass: RolesAuthorizationPolicy },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokenVerifier, AuthorizationPolicy],
})
export class AuthModule {}
