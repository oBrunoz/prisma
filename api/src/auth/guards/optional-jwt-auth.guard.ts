import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccessTokenPayload } from '../token.service.js';

// rota publica que muda um detalhe para quem esta logado (ex.: "voce segue")
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();

    const authorization = request.headers.authorization;
    if (!authorization) return true;

    // token vencido vira 401, e nao visitante: assim o front renova e repete
    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    try {
      request.user = await this.jwt.verifyAsync<AccessTokenPayload>(
        authorization.split(' ')[1],
      );
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
