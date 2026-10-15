import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaModule } from '../media/media.module.js';
import { TmdbModule } from '../tmdb/tmdb.module.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';
import { ImportacaoDeDesafiosService } from './importacao-de-desafios.service.js';

@Module({
  imports: [AuthModule, MediaModule, TmdbModule],
  controllers: [GamesController],
  providers: [GamesService, ImportacaoDeDesafiosService],
  exports: [ImportacaoDeDesafiosService],
})
export class GamesModule {}
