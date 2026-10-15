import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { MediaRefDto } from '../media/dto/media-ref.dto.js';
import { ListaDoUsuarioDto } from './dto/lista-do-usuario.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { UpsertReviewDto } from './dto/upsert-review.dto.js';
import { ReviewService } from './review.service.js';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get('me/:mediaType/:tmdbId')
  @UseGuards(JwtAuthGuard)
  minha(@CurrentUser() user: AccessTokenPayload, @Param() ref: MediaRefDto) {
    return this.reviews.minhaNoTitulo(user.sub, ref.tmdbId, ref.mediaType);
  }

  @Get('media/:mediaType/:tmdbId/stats')
  estatisticas(@Param() ref: MediaRefDto) {
    return this.reviews.estatisticasDaMidia(ref.tmdbId, ref.mediaType);
  }

  @Get('media/:mediaType/:tmdbId')
  listByMedia(@Param() ref: MediaRefDto, @Query() pagina: PaginationDto) {
    return this.reviews.listByMedia(ref.tmdbId, ref.mediaType, pagina);
  }

  @Get('user/:userId')
  listByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListaDoUsuarioDto,
  ) {
    return this.reviews.listByUser(userId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  upsert(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpsertReviewDto,
  ) {
    return this.reviews.upsert(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviews.update(user.sub, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.reviews.remove(user.sub, id);
  }
}
