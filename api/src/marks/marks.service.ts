import { Injectable } from '@nestjs/common';
import { MediaType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RefTitulo {
  tmdbId: number;
  type: MediaType;
}

export interface Marca {
  tmdbId: number;
  mediaType: MediaType;
  watched: boolean;
  liked: boolean;
  watchlist: boolean;
}

@Injectable()
export class MarksService {
  constructor(private readonly prisma: PrismaService) {}

  // o que o usuário marcou em cada título de uma fileira, numa consulta só;
  // título sem marca nenhuma fica de fora
  async doUsuario(userId: string, titulos: RefTitulo[]): Promise<Marca[]> {
    const midias = await this.prisma.media.findMany({
      where: { OR: titulos.map(({ tmdbId, type }) => ({ tmdbId, type })) },
      select: {
        tmdbId: true,
        type: true,
        reviews: { where: { userId }, select: { liked: true, watchedAt: true } },
        watchlistItems: { where: { userId }, select: { id: true } },
      },
    });

    return midias
      .map((m) => ({
        tmdbId: m.tmdbId,
        mediaType: m.type,
        watched: Boolean(m.reviews[0]?.watchedAt),
        liked: m.reviews[0]?.liked ?? false,
        watchlist: m.watchlistItems.length > 0,
      }))
      .filter((m) => m.watched || m.liked || m.watchlist);
  }
}
