import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Principal } from './principal';

export interface AuthorizationRequest {
  principal: Principal;
  /** Roles from `@Roles(...)`; empty when the route declares none. */
  requiredRoles: readonly string[];
  request: Request;
  /** `ControllerName.methodName`, for policies keyed by route. */
  handler: string;
}

/**
 * Route-level authorization, checked by the auth guard after the token is verified.
 * Replace it to add project-wide rules (for example tenant membership):
 * `{ provide: AuthorizationPolicy, useClass: MyPolicy }` in AppModule.
 *
 * Resource-level checks ("may this user read order 42?") belong in services.
 */
export abstract class AuthorizationPolicy {
  abstract authorize(request: AuthorizationRequest): boolean | Promise<boolean>;
}

/** Default: allowed when the route needs no roles or the caller has at least one of them. */
@Injectable()
export class RolesAuthorizationPolicy extends AuthorizationPolicy {
  override authorize({ principal, requiredRoles }: AuthorizationRequest): boolean {
    return (
      requiredRoles.length === 0 || requiredRoles.some((role) => principal.roles.includes(role))
    );
  }
}
