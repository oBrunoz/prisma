import { Module } from '@nestjs/common';
import { TmdbModule } from '../tmdb/tmdb.module.js';
import { PlataformasService } from './plataformas.service.js';
import { VitrineController } from './vitrine.controller.js';
import { VitrineService } from './vitrine.service.js';

@Module({
  imports: [TmdbModule],
  controllers: [VitrineController],
  providers: [VitrineService, PlataformasService],
})
export class VitrineModule {}
