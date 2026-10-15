import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { FollowService } from './follow.service.js';

@Controller('follow')
export class FollowController {
  constructor(private readonly follows: FollowService) {}

  @Get(':userId/followers')
  @UseGuards(OptionalJwtAuthGuard)
  followers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagina: PaginationDto,
    @CurrentUser() user?: AccessTokenPayload,
  ) {
    return this.follows.followers(userId, pagina, user?.sub);
  }

  @Get(':userId/following')
  @UseGuards(OptionalJwtAuthGuard)
  following(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagina: PaginationDto,
    @CurrentUser() user?: AccessTokenPayload,
  ) {
    return this.follows.following(userId, pagina, user?.sub);
  }

  @Get(':userId/counts')
  counts(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.follows.counts(userId);
  }

  @Get(':userId/status')
  @UseGuards(JwtAuthGuard)
  async status(
    @CurrentUser() user: AccessTokenPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return { seguindo: await this.follows.isFollowing(user.sub, userId) };
  }

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  follow(
    @CurrentUser() user: AccessTokenPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.follows.follow(user.sub, userId);
  }

  @Delete(':userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollow(
    @CurrentUser() user: AccessTokenPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.follows.unfollow(user.sub, userId);
  }
}
