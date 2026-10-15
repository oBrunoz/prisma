import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { MediaType } from '../generated/prisma/enums.js';
import { TitulosDto } from './dto/titulos.dto.js';
import { MarksService, RefTitulo } from './marks.service.js';

@Controller('marks')
@UseGuards(JwtAuthGuard)
export class MarksController {
  constructor(private readonly marks: MarksService) {}

  @Get()
  doUsuario(@CurrentUser() user: AccessTokenPayload, @Query() { titles }: TitulosDto) {
    const titulos: RefTitulo[] = titles.split(',').map((t) => {
      const [tipo, id] = t.split('-');
      return { tmdbId: Number(id), type: tipo === 'movie' ? MediaType.MOVIE : MediaType.TV };
    });
    return this.marks.doUsuario(user.sub, titulos);
  }
}
