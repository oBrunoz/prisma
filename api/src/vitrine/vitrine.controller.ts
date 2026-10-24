import { Controller, Get, Query } from '@nestjs/common';
import { TitulosDto } from '../marks/dto/titulos.dto.js';
import { PlataformasService } from './plataformas.service.js';
import { VitrineService } from './vitrine.service.js';

@Controller('vitrine')
export class VitrineController {
  constructor(
    private readonly vitrine: VitrineService,
    private readonly plataformas: PlataformasService,
  ) {}

  @Get('neste-dia')
  nesteDia() {
    return this.vitrine.nesteDia();
  }

  @Get('maratonas')
  maratonas() {
    return this.vitrine.maratonas();
  }

  // "movie-550,tv-1399", o mesmo formato do /marks: uma fileira de cards por pedido
  @Get('plataformas')
  ondeAssistir(@Query() { titles }: TitulosDto) {
    return this.plataformas.de(
      titles.split(',').map((t) => {
        const [type, id] = t.split('-');
        return { type: type === 'movie' ? 'movie' : 'tv', tmdbId: Number(id) };
      }),
    );
  }
}
