import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { GameKind } from '../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TmdbService } from '../tmdb/tmdb.service.js';
import {
  Buscar,
  DesafioImpossivel,
  montarAssinatura,
  montarCarreira,
  montarDuelo,
  montarFicha,
  montarLegenda,
  montarLetreiro,
  montarLinha,
  montarPersonagens,
} from './construtores.js';
import { TENTATIVAS } from './games.constants.js';
import type { Pista } from './games.regras.js';

// o arquivo da curadoria: só o essencial de cada dia; o resto o importador busca na TMDB
export interface DesafiosDoArquivo {
  frames?: { dia: string; tmdbId: number; imagens: string[] }[];
  poster?: { dia: string; tmdbId: number; imagem?: string }[];
  // pistas inteiras substituem as automáticas; palavrasChave (traduzidas) viram a quarta pista
  ficha?: {
    dia: string;
    tmdbId: number;
    pistas?: Pista[];
    palavrasChave?: string[];
  }[];
  // [posição nos créditos, personagem, quem fez], do fim da lista até o protagonista
  personagens?: {
    dia: string;
    tmdbId: number;
    personagens?: [string, string, string][];
  }[];
  letreiro?: { dia: string; tmdbId: number }[];
  // título de uma palavra, 5 a 8 letras
  legenda?: { dia: string; tmdbId: number }[];
  assinatura?: { dia: string; pessoa: number }[];
  carreira?: { dia: string; pessoa: number }[];
  // sem pares, sorteia pelo dia entre os mais votados e os mais bem avaliados
  duelo?: { dia: string; pares?: [number, number][] }[];
  // sem filmes, sorteia oito de anos diferentes; a âncora é a do meio
  linha?: { dia: string; ancora?: number; filmes?: number[] }[];
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

interface ItemDaImportacao {
  kind: GameKind;
  dia: string;
  // o filme da resposta, quando há um
  tmdbId: number | null;
  images: string[];
  data: Prisma.InputJsonValue | null;
  // para o relatório: o que entrou no dia
  rotulo: string;
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

  private readonly buscar: Buscar = (caminho, params) =>
    this.tmdb.get(caminho, params);

  async importar(arquivo: DesafiosDoArquivo): Promise<DesafioImportado[]> {
    const itens: ItemDaImportacao[] = [];
    const json = (d: object) => d as unknown as Prisma.InputJsonValue;

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
        data: null,
        rotulo: '',
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
        data: null,
        rotulo: '',
      });
    }

    // os jogos de texto e de escolha: o construtor busca na TMDB e recusa o que não serve
    const montar = async (
      kind: GameKind,
      dia: string,
      tmdbId: number | null,
      fazer: () => Promise<object>,
      rotulo = '',
    ) => {
      this.validarDia(dia);
      try {
        itens.push({
          kind,
          dia,
          tmdbId,
          images: [],
          data: json(await fazer()),
          rotulo,
        });
      } catch (e) {
        if (e instanceof DesafioImpossivel)
          throw new BadRequestException(`${kind} de ${dia}: ${e.message}`);
        throw e;
      }
    };

    for (const f of arquivo.ficha ?? []) {
      await montar('FICHA', f.dia, f.tmdbId, () =>
        montarFicha(this.buscar, f.tmdbId, f),
      );
    }
    for (const p of arquivo.personagens ?? []) {
      await montar('PERSONAGENS', p.dia, p.tmdbId, () =>
        montarPersonagens(this.buscar, p.tmdbId, p.personagens),
      );
    }
    for (const l of arquivo.letreiro ?? []) {
      await montar('LETREIRO', l.dia, l.tmdbId, () =>
        montarLetreiro(this.buscar, l.tmdbId),
      );
    }
    for (const l of arquivo.legenda ?? []) {
      await montar('LEGENDA', l.dia, l.tmdbId, () =>
        montarLegenda(this.buscar, l.tmdbId),
      );
    }
    for (const a of arquivo.assinatura ?? []) {
      const dados = await montarAssinatura(this.buscar, a.pessoa).catch(
        this.traduzir('ASSINATURA', a.dia),
      );
      await montar(
        'ASSINATURA',
        a.dia,
        null,
        async () => dados,
        dados.pessoa.name,
      );
    }
    for (const c of arquivo.carreira ?? []) {
      const dados = await montarCarreira(this.buscar, c.pessoa, c.dia).catch(
        this.traduzir('CARREIRA', c.dia),
      );
      await montar(
        'CARREIRA',
        c.dia,
        null,
        async () => dados,
        dados.pessoa.name,
      );
    }
    for (const d of arquivo.duelo ?? []) {
      await montar(
        'DUELO',
        d.dia,
        null,
        () => montarDuelo(this.buscar, d.dia, d.pares),
        'sete duelos',
      );
    }
    for (const l of arquivo.linha ?? []) {
      const curadoria =
        l.ancora && l.filmes
          ? { ancora: l.ancora, filmes: l.filmes }
          : undefined;
      await montar(
        'LINHA',
        l.dia,
        null,
        () => montarLinha(this.buscar, l.dia, curadoria),
        'oito filmes',
      );
    }

    // numero provisorio abaixo de todos os que existem; a renumeracao acerta pela ordem dos dias
    const menor = await this.prisma.gameChallenge.aggregate({
      _min: { number: true },
    });
    let provisorio = Math.min(0, menor._min.number ?? 0);

    for (const item of itens) {
      const mediaId = item.tmdbId
        ? (await this.media.resolve(item.tmdbId, 'MOVIE')).id
        : null;
      const day = new Date(item.dia);
      const data = item.data ?? undefined;
      provisorio--;
      await this.prisma.gameChallenge.upsert({
        where: { kind_day: { kind: item.kind, day } },
        create: {
          kind: item.kind,
          day,
          number: provisorio,
          mediaId,
          images: item.images,
          data,
        },
        update: { mediaId, images: item.images, data },
      });
    }

    const kinds = [...new Set(itens.map((i) => i.kind))];
    for (const kind of kinds) await this.renumerar(kind);

    const salvos = await this.prisma.gameChallenge.findMany({
      where: { OR: itens.map((i) => ({ kind: i.kind, day: new Date(i.dia) })) },
      include: { media: { select: { title: true } } },
      orderBy: [{ kind: 'asc' }, { day: 'asc' }],
    });
    const rotulos = new Map(itens.map((i) => [`${i.kind}${i.dia}`, i.rotulo]));
    return salvos.map((d) => {
      const day = d.day.toISOString().slice(0, 10);
      return {
        kind: d.kind,
        day,
        number: d.number,
        title: d.media?.title ?? rotulos.get(`${d.kind}${day}`) ?? '',
      };
    });
  }

  private traduzir(kind: GameKind, dia: string) {
    return (e: unknown): never => {
      if (e instanceof DesafioImpossivel)
        throw new BadRequestException(`${kind} de ${dia}: ${e.message}`);
      throw e;
    };
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
