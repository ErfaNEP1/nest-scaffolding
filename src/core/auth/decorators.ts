import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '../errors/domain-error';
import type { Principal } from './principal';

export const IS_PUBLIC = 'auth:isPublic';
export const REQUIRED_ROLES = 'auth:roles';

/** Opts a route or controller out of authentication. Always add a comment saying why. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** The caller needs at least one of these roles. */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES, roles);

export type RequestWithPrincipal = Request & { principal?: Principal };

/** The authenticated {@link Principal}. Only valid on authenticated routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context.switchToHttp().getRequest<RequestWithPrincipal>().principal;
    if (!principal) throw new UnauthorizedError();
    return principal;
  },
);
