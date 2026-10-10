import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { setContextValue } from '../context/context';
import { ForbiddenError, UnauthorizedError } from '../errors/domain-error';
import { AuthorizationPolicy } from './authorization-policy';
import { IS_PUBLIC, REQUIRED_ROLES, type RequestWithPrincipal } from './decorators';
import { TokenVerifier } from './token-verifier';

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/;

/**
 * Global guard, secure by default: every HTTP route needs a valid Bearer token unless it
 * is marked `@Public()`. Then `@Roles(...)` and the {@link AuthorizationPolicy} apply.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly policy: AuthorizationPolicy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const match = BEARER.exec(request.headers.authorization ?? '');
    if (!match?.[1]) {
      throw new UnauthorizedError('UNAUTHORIZED', 'A Bearer access token is required.');
    }

    const principal = await this.verifier.verify(match[1]);
    request.principal = principal;
    setContextValue('userId', principal.subject);

    const requiredRoles =
      this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_ROLES, targets) ?? [];
    const allowed = await this.policy.authorize({
      principal,
      requiredRoles,
      request,
      handler: `${context.getClass().name}.${context.getHandler().name}`,
    });
    if (!allowed) throw new ForbiddenError();
    return true;
  }
}
