import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { MediaType } from '../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { ListaDoUsuarioDto } from './dto/lista-do-usuario.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { UpsertReviewDto } from './dto/upsert-review.dto.js';

const AUTOR = {
  select: { id: true, username: true, name: true, avatarUrl: true },
};

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // o corpo traz a ficha inteira: desmarcar tudo apaga a linha em vez de deixa-la vazia
  async upsert(userId: string, dto: UpsertReviewDto) {
    const media = await this.media.resolve(dto.tmdbId, dto.mediaType);
    const where = { userId_mediaId: { userId, mediaId: media.id } };
    const anterior = await this.prisma.review.findUnique({ where });

    const texto = dto.content?.trim() || null;
    const vazia =
      dto.rating === undefined && !texto && !dto.liked && !dto.watched;

    if (vazia) {
      if (anterior) {
        await this.prisma.review.delete({ where });
      }
      return null;
    }

    const dados = {
      rating: dto.rating ?? null,
      content: texto,
      liked: dto.liked ?? false,
      // remarcar nao reescreve a data original de quando assistiu
      watchedAt: dto.watched ? (anterior?.watchedAt ?? new Date()) : null,
    };

    return this.prisma.review.upsert({
      where,
      create: { userId, mediaId: media.id, ...dados },
      update: dados,
      include: { media: true, user: AUTOR },
    });
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    await this.assertDono(userId, reviewId);

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.liked !== undefined && { liked: dto.liked }),
        ...(dto.watchedAt !== undefined && {
          watchedAt: new Date(dto.watchedAt),
        }),
      },
      include: { media: true, user: AUTOR },
    });
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    await this.assertDono(userId, reviewId);
    await this.prisma.review.delete({ where: { id: reviewId } });
  }

  minhaNoTitulo(userId: string, tmdbId: number, type: MediaType) {
    return this.prisma.review.findFirst({
      where: { userId, media: { tmdbId, type } },
      include: { media: true, user: AUTOR },
    });
  }

  listByMedia(tmdbId: number, type: MediaType, pagina: PaginationDto) {
    return this.prisma.review.findMany({
      where: { media: { tmdbId, type } },
      include: { user: AUTOR },
      orderBy: { createdAt: 'desc' },
      take: pagina.take,
      skip: pagina.skip,
    });
  }

  // busca o triplo e corta a repeticao: uma pessoa prolifica nao toma a fileira inteira
  async recentes(pagina: PaginationDto) {
    const lista = await this.prisma.review.findMany({
      where: { content: { not: null } },
      include: { media: true, user: AUTOR },
      orderBy: { createdAt: 'desc' },
      take: pagina.take * 3,
    });
    const vistos = new Set<string>();
    return lista
      .filter((r) => !vistos.has(r.userId) && vistos.add(r.userId))
      .slice(0, pagina.take);
  }

  // agregacao no banco: somar no cliente daria numero errado, a lista e paginada
  async estatisticasDaMidia(tmdbId: number, type: MediaType) {
    const vazio = {
      total: 0,
      notaMedia: null as number | null,
      curtidas: 0,
      distribuicao: Array<number>(10).fill(0),
    };

    const media = await this.prisma.media.findUnique({
      where: { tmdbId_type: { tmdbId, type } },
      select: { id: true },
    });
    if (!media) return vazio;

    const [porNota, curtidas, total] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { mediaId: media.id, rating: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.review.count({ where: { mediaId: media.id, liked: true } }),
      this.prisma.review.count({ where: { mediaId: media.id } }),
    ]);

    const distribuicao = Array<number>(10).fill(0);
    let soma = 0;
    let comNota = 0;

    for (const linha of porNota) {
      const nota = linha.rating;
      if (nota === null) continue;
      const quantidade = linha._count._all;
      distribuicao[nota - 1] = quantidade;
      soma += nota * quantidade;
      comNota += quantidade;
    }

    return {
      total,
      notaMedia: comNota > 0 ? soma / comNota : null,
      curtidas,
      distribuicao,
    };
  }

  listByUser(userId: string, query: ListaDoUsuarioDto) {
    const where =
      query.filtro === 'diario'
        ? { userId, watchedAt: { not: null } }
        : query.filtro === 'escritas'
          ? {
              userId,
              OR: [{ rating: { not: null } }, { content: { not: null } }],
            }
          : { userId };

    return this.prisma.review.findMany({
      where,
      include: { media: true },
      orderBy:
        query.filtro === 'diario'
          ? [{ watchedAt: 'desc' }, { createdAt: 'desc' }]
          : { createdAt: 'desc' },
      take: query.take,
      skip: query.skip,
    });
  }

  private async assertDono(userId: string, reviewId: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true },
    });

    if (!review) {
      throw new NotFoundException('Review não encontrada');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('Essa review não é sua');
    }
  }
}
