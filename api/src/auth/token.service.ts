import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS } from './auth.constants.js';

export interface AccessTokenPayload {
  sub: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(userId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId } satisfies AccessTokenPayload,
      {
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: TokenService.hash(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  async rotate(refreshToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: TokenService.hash(refreshToken) },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    if (stored.revokedAt) {
      await this.revokeAllFor(stored.userId);
      throw new UnauthorizedException('Refresh token reutilizado');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issue(stored.userId);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: TokenService.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllFor(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // apaga em vez de revogar: token revogado que volta e lido como roubo e derrubaria a sessao nova
  async restart(userId: string): Promise<TokenPair> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return this.issue(userId);
  }

  countActive(userId: string): Promise<number> {
    return this.prisma.refreshToken.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  private static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
