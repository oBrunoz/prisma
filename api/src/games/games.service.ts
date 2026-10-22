import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  GameChallenge,
  Media,
  Prisma,
} from '../generated/prisma/client.js';
import { GameKind } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { diaDoJogo, TENTATIVAS } from './games.constants.js';

export type SituacaoDaPartida = 'PLAYING' | 'WON' | 'LOST';

export interface RespostaDoDesafio {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
}

export interface PartidaView {
  id: string;
  kind: GameKind;
  number: number;
  day: string;
  attempts: number;
  // so as imagens ja liberadas; a resposta so sai no fim
  images: string[];
  guesses: number[];
  status: SituacaoDaPartida;
  answer: RespostaDoDesafio | null;
}

export interface SorteioView {
  challenge: PartidaView;
  // a pessoa já tinha visto todos os desafios antigos desse jogo
  repeated: boolean;
}

export interface EstatisticasDoJogo {
  played: number;
  won: number;
  currentStreak: number;
  bestStreak: number;
  // acertos por tentativa (1 a 7) e, na ultima posicao, as derrotas
  distribution: number[];
}

type DesafioComMidia = GameChallenge & { media: Media };

const iguaisAte = (a: number[], b: number[]) => a.every((v, i) => b[i] === v);

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async hoje(userId?: string) {
    const day = diaDoJogo();
    const desafios = await this.prisma.gameChallenge.findMany({
      where: { day: new Date(day) },
      include: { media: true },
      orderBy: { kind: 'asc' },
    });

    const salvas = userId
      ? await this.prisma.gamePlay.findMany({
          where: { userId, challengeId: { in: desafios.map((d) => d.id) } },
        })
      : [];
    const palpites = new Map(salvas.map((p) => [p.challengeId, p.guesses]));

    return {
      day,
      challenges: desafios.map((d) => this.montar(d, palpites.get(d.id) ?? [])),
    };
  }

  // confere a lista inteira de palpites; quem esta logado tem a partida gravada
  async jogar(
    challengeId: string,
    guesses: number[],
    userId?: string,
  ): Promise<PartidaView> {
    const hoje = diaDoJogo();
    const desafio = await this.prisma.gameChallenge.findUnique({
      where: { id: challengeId },
      include: { media: true },
    });

    // desafio de amanha nao existe para quem joga
    if (!desafio || this.diaDe(desafio) > hoje) {
      throw new NotFoundException('Desafio não encontrado');
    }

    const resposta = desafio.media.tmdbId;
    const palpites = this.normalizar(guesses, resposta);

    // desafio de outro dia so mostra o resultado, sem contar para a sequencia
    if (!userId || this.diaDe(desafio) !== hoje) {
      return this.montar(desafio, palpites);
    }

    const salva = await this.prisma.gamePlay.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
    });
    if (salva?.result) return this.montar(desafio, salva.guesses);

    const base = salva?.guesses ?? [];
    // outro aparelho ja andou mais: vale o que esta salvo
    if (palpites.length <= base.length && iguaisAte(palpites, base)) {
      return this.montar(desafio, base);
    }
    if (!iguaisAte(base, palpites)) {
      throw new ConflictException('Essa partida já tem outros palpites salvos');
    }

    const situacao = this.situacao(palpites, resposta);
    const result = situacao === 'PLAYING' ? null : situacao;
    await this.prisma.gamePlay.upsert({
      where: { userId_challengeId: { userId, challengeId } },
      create: { userId, challengeId, guesses: palpites, result },
      update: { guesses: palpites, result },
    });

    return this.montar(desafio, palpites);
  }

  // fora do diario: um desafio de dia passado, que nao grava nem conta na sequencia
  async sortear(
    userId: string,
    kind: GameKind,
    exceto: string[],
  ): Promise<SorteioView> {
    // so dias passados: hoje e o diario, e amanha estragaria o desafio
    const antigos: Prisma.GameChallengeWhereInput = {
      kind,
      day: { lt: new Date(diaDoJogo()) },
    };
    const terminados = await this.prisma.gamePlay.findMany({
      where: { userId, result: { not: null }, challenge: { kind } },
      select: { challengeId: true },
    });
    const vistos = [...exceto, ...terminados.map((t) => t.challengeId)];

    // primeiro o que a pessoa nao viu; acabando, repete, menos o ultimo sorteado
    const inedito = await this.umAoAcaso({
      ...antigos,
      id: { notIn: vistos },
    });
    const desafio =
      inedito ??
      (await this.umAoAcaso({ ...antigos, id: { notIn: exceto.slice(-1) } })) ??
      (await this.umAoAcaso(antigos));
    if (!desafio) {
      throw new NotFoundException('Ainda não há desafios antigos desse jogo');
    }

    return { challenge: this.montar(desafio, []), repeated: !inedito };
  }

  async estatisticas(
    userId: string,
  ): Promise<Record<GameKind, EstatisticasDoJogo>> {
    const hoje = new Date(diaDoJogo());
    const [partidas, ultimos] = await Promise.all([
      this.prisma.gamePlay.findMany({
        where: { userId, result: { not: null } },
        select: {
          guesses: true,
          result: true,
          challenge: { select: { kind: true, number: true } },
        },
      }),
      Promise.all(
        Object.values(GameKind).map((kind) =>
          this.prisma.gameChallenge.findFirst({
            where: { kind, day: { lte: hoje } },
            orderBy: { number: 'desc' },
            select: { kind: true, number: true },
          }),
        ),
      ),
    ]);

    const saida = {} as Record<GameKind, EstatisticasDoJogo>;
    for (const kind of Object.values(GameKind)) {
      const doJogo = partidas.filter((p) => p.challenge.kind === kind);
      const venceu = new Map(
        doJogo.map((p) => [p.challenge.number, p.result === 'WON']),
      );

      const distribution = Array<number>(TENTATIVAS + 1).fill(0);
      for (const p of doJogo) {
        distribution[p.result === 'WON' ? p.guesses.length - 1 : TENTATIVAS]++;
      }

      // a sequencia conta ate hoje; se hoje ainda nao terminou, ate ontem
      const ultimo = ultimos.find((u) => u?.kind === kind)?.number ?? 0;
      let n = venceu.has(ultimo) ? ultimo : ultimo - 1;
      let currentStreak = 0;
      while (venceu.get(n)) {
        currentStreak++;
        n--;
      }

      let bestStreak = 0;
      let corrida = 0;
      let anterior = -1;
      for (const numero of [...venceu.keys()].sort((a, b) => a - b)) {
        corrida = venceu.get(numero)
          ? numero === anterior + 1
            ? corrida + 1
            : 1
          : 0;
        bestStreak = Math.max(bestStreak, corrida);
        anterior = numero;
      }

      saida[kind] = {
        played: doJogo.length,
        won: doJogo.filter((p) => p.result === 'WON').length,
        currentStreak,
        bestStreak,
        distribution,
      };
    }
    return saida;
  }

  // nada conta depois do acerto, e passar de sete nao muda o resultado
  private normalizar(guesses: number[], resposta: number): number[] {
    const acerto = guesses.indexOf(resposta);
    const ate = acerto >= 0 ? acerto + 1 : guesses.length;
    return guesses.slice(0, Math.min(ate, TENTATIVAS));
  }

  private situacao(guesses: number[], resposta: number): SituacaoDaPartida {
    if (guesses.includes(resposta)) return 'WON';
    return guesses.length >= TENTATIVAS ? 'LOST' : 'PLAYING';
  }

  private async umAoAcaso(
    where: Prisma.GameChallengeWhereInput,
  ): Promise<DesafioComMidia | null> {
    const total = await this.prisma.gameChallenge.count({ where });
    if (!total) return null;
    return this.prisma.gameChallenge.findFirst({
      where,
      include: { media: true },
      orderBy: { number: 'asc' },
      skip: Math.floor(Math.random() * total),
    });
  }

  private diaDe(desafio: GameChallenge): string {
    return desafio.day.toISOString().slice(0, 10);
  }

  private montar(desafio: DesafioComMidia, guesses: number[]): PartidaView {
    const status = this.situacao(guesses, desafio.media.tmdbId);
    const fim = status !== 'PLAYING';
    // no poster a imagem e uma so: quem esconde e o desenho em listras do front
    const liberadas =
      desafio.kind === 'POSTER'
        ? desafio.images.slice(0, 1)
        : desafio.images.slice(
            0,
            fim ? TENTATIVAS : Math.min(guesses.length + 1, TENTATIVAS),
          );

    return {
      id: desafio.id,
      kind: desafio.kind,
      number: desafio.number,
      day: this.diaDe(desafio),
      attempts: TENTATIVAS,
      images: liberadas,
      guesses,
      status,
      answer: fim
        ? {
            tmdbId: desafio.media.tmdbId,
            title: desafio.media.title,
            posterPath: desafio.media.posterPath,
            year: desafio.media.releaseDate?.getUTCFullYear() ?? null,
          }
        : null,
    };
  }
}
