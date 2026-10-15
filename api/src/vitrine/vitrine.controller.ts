import { Controller, Get } from '@nestjs/common';
import { VitrineService } from './vitrine.service.js';

// secoes da home que juntam muitas consultas a TMDB: montadas aqui e guardadas
@Controller('vitrine')
export class VitrineController {
  constructor(private readonly vitrine: VitrineService) {}

  @Get('neste-dia')
  nesteDia() {
    return this.vitrine.nesteDia();
  }

  @Get('maratonas')
  maratonas() {
    return this.vitrine.maratonas();
  }
}
