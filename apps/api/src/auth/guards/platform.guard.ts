import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth.types';
import { PLATFORM_ONLY_KEY } from '../decorators/platform-only.decorator';

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const platformOnly = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!platformOnly) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Debes iniciar sesión para continuar.');
    }

    if (request.user.scope !== 'platform') {
      throw new ForbiddenException(
        'Esta acción requiere acceso de plataforma.',
      );
    }

    return true;
  }
}
