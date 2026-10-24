import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants.js';
import type { TokenPair } from './token.service.js';

export function gravarRefreshCookie(
  res: Response,
  tokens: TokenPair,
  config: ConfigService,
): void {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: config.getOrThrow<string>('NODE_ENV') === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
  });
}
