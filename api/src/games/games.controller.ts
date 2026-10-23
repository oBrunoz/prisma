import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { JogadaDto } from './dto/jogada.dto.js';
import { SorteioDto } from './dto/sorteio.dto.js';
import { GamesService } from './games.service.js';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('today')
  @UseGuards(OptionalJwtAuthGuard)
  hoje(@CurrentUser() user: AccessTokenPayload | undefined) {
    return this.games.hoje(user?.sub);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  estatisticas(@CurrentUser() user: AccessTokenPayload) {
    return this.games.estatisticas(user.sub);
  }

  // desafio antigo ao acaso: e o que a conta destrava
  @Get('random')
  @UseGuards(JwtAuthGuard)
  sortear(
    @CurrentUser() user: AccessTokenPayload,
    @Query() { kind, exceto }: SorteioDto,
  ) {
    return this.games.sortear(user.sub, kind, exceto?.split(',') ?? []);
  }

  @Post(':id/play')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  jogar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() jogada: JogadaDto,
    @CurrentUser() user: AccessTokenPayload | undefined,
  ) {
    return this.games.jogar(id, jogada, user?.sub);
  }
}
