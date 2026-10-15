import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountModule } from './account/account.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { LIMITE_GERAL } from './common/rate-limit.js';
import { validate } from './config/env.validation.js';
import { FollowModule } from './follow/follow.module.js';
import { GamesModule } from './games/games.module.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReviewModule } from './review/review.module.js';
import { TmdbModule } from './tmdb/tmdb.module.js';
import { UserModule } from './user/user.module.js';
import { WatchlistModule } from './watchlist/watchlist.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([LIMITE_GERAL]),
    PrismaModule,
    HealthModule,
    UserModule,
    AuthModule,
    AccountModule,
    TmdbModule,
    MediaModule,
    WatchlistModule,
    ReviewModule,
    FollowModule,
    GamesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
