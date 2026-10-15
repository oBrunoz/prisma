import { BadRequestException, Injectable } from '@nestjs/common';
import { GameKind } from '../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TmdbService } from '../tmdb/tmdb.service.js';
import { TENTATIVAS } from './games.constants.js';

// o arquivo da curadoria: frames com as sete imagens na ordem; poster com a imagem opcional
export interface DesafiosDoArquivo {
  frames?: { dia: string; tmdbId: number; imagens: string[] }[];
  poster?: { dia: string; tmdbId: number; imagem?: string }[];
}

export interface DesafioImportado {
  kind: GameKind;
  day: string;
  number: number;
  title: string;
}

interface ImagensDaTmdb {
  posters: {
    file_path: string;
    iso_639_1: string | null;
    vote_average: number;
    vote_count: number;
  }[];
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const CAMINHO = /^\/[\w-]+\.(jpg|png)$/;

@Injectable()
export class ImportacaoDeDesafiosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly tmdb: TmdbService,
  ) {}

  async importar(arquivo: DesafiosDoArquivo): Promise<DesafioImportado[]> {
    const itens: {
      kind: GameKind;
      dia: string;
      tmdbId: number;
      images: string[];
    }[] = [];

    for (const f of arquivo.frames ?? []) {
      this.validarDia(f.dia);
      if (
        f.imagens.length !== TENTATIVAS ||
        !f.imagens.every((c) => CAMINHO.test(c))
      ) {
        throw new BadRequestException(
          `Frames de ${f.dia}: são ${TENTATIVAS} caminhos da TMDB`,
        );
      }
      itens.push({
        kind: 'FRAMES',
        dia: f.dia,
        tmdbId: f.tmdbId,
        images: f.imagens,
      });
    }

    for (const p of arquivo.poster ?? []) {
      this.validarDia(p.dia);
      const imagem = p.imagem ?? (await this.posterSemTexto(p.tmdbId));
      if (!imagem || !CAMINHO.test(imagem)) {
        throw new BadRequestException(
          `Pôster de ${p.dia}: sem imagem sem texto na TMDB`,
        );
      }
      itens.push({
        kind: 'POSTER',
        dia: p.dia,
        tmdbId: p.tmdbId,
        images: [imagem],
      });
    }

    // numero provisorio abaixo de todos os que existem; a renumeracao acerta pela ordem dos dias
    const menor = await this.prisma.gameChallenge.aggregate({
      _min: { number: true },
    });
    let provisorio = Math.min(0, menor._min.number ?? 0);

    for (const item of itens) {
      const media = await this.media.resolve(item.tmdbId, 'MOVIE');
      const day = new Date(item.dia);
      provisorio--;
      await this.prisma.gameChallenge.upsert({
        where: { kind_day: { kind: item.kind, day } },
        create: {
          kind: item.kind,
          day,
          number: provisorio,
          mediaId: media.id,
          images: item.images,
        },
        update: { mediaId: media.id, images: item.images },
      });
    }

    const kinds = [...new Set(itens.map((i) => i.kind))];
    for (const kind of kinds) await this.renumerar(kind);

    const salvos = await this.prisma.gameChallenge.findMany({
      where: { OR: itens.map((i) => ({ kind: i.kind, day: new Date(i.dia) })) },
      include: { media: { select: { title: true } } },
      orderBy: [{ kind: 'asc' }, { day: 'asc' }],
    });
    return salvos.map((d) => ({
      kind: d.kind,
      day: d.day.toISOString().slice(0, 10),
      number: d.number,
      title: d.media.title,
    }));
  }

  // o pôster sem texto mais votado; com texto, o título entregaria a resposta
  private async posterSemTexto(tmdbId: number): Promise<string | null> {
    const dados = await this.tmdb.get<ImagensDaTmdb>(
      `/movie/${tmdbId}/images`,
      {
        include_image_language: 'null',
      },
    );
    const semTexto = dados.posters
      .filter((p) => p.iso_639_1 === null)
      .sort(
        (a, b) =>
          b.vote_average - a.vote_average || b.vote_count - a.vote_count,
      );
    return semTexto[0]?.file_path ?? null;
  }

  // Nº 1 e o primeiro dia do jogo; em duas passadas para nao bater no unique
  private async renumerar(kind: GameKind): Promise<void> {
    const todos = await this.prisma.gameChallenge.findMany({
      where: { kind },
      orderBy: { day: 'asc' },
      select: { id: true },
    });
    await this.prisma.$transaction([
      ...todos.map((d, i) =>
        this.prisma.gameChallenge.update({
          where: { id: d.id },
          data: { number: -(i + 1) },
        }),
      ),
      ...todos.map((d, i) =>
        this.prisma.gameChallenge.update({
          where: { id: d.id },
          data: { number: i + 1 },
        }),
      ),
    ]);
  }

  private validarDia(dia: string): void {
    if (!DIA.test(dia)) throw new BadRequestException(`Dia inválido: ${dia}`);
  }
}
