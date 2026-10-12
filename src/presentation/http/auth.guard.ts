import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { StoreUser } from '../../domain/models';

export const Access = (access: 'public' | 'customer' | 'admin') =>
  SetMetadata('store-access', access);
export type StoreRequest = Request & { storeUser: StoreUser };
export function readToken(request: Request) {
  return request.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('step_session='))
    ?.slice('step_session='.length);
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<StoreRequest>();
    const access =
      this.reflector.getAllAndOverride<string>('store-access', [
        context.getHandler(),
        context.getClass(),
      ]) || 'admin';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin) {
        const trusted =
          process.env.STORE_ORIGIN ||
          `${request.protocol}://${request.headers.host}`;
        if (origin !== trusted)
          throw new ForbiddenException('Источник запроса не разрешён.');
      }
    }
    if (access === 'public') return true;
    const user = await this.store.session(readToken(request));
    if (!user) throw new UnauthorizedException('Войдите в аккаунт.');
    if (access === 'admin' && user.role !== 'admin')
      throw new ForbiddenException('Доступ только для администратора.');
    request.storeUser = user;
    return true;
  }
}
