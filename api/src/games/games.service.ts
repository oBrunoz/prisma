import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { diaDoJogo, SO_COM_CONTA, TENTATIVAS } from './games.constants.js';
import {
  conteudo,
  DesafioDoJogo,
  imagensLiberadas,
  Jogada,
  JogadaInvalida,
  normalizarJogada,
  placar,
  posicaoNaDistribuicao,
  resposta,
  RespostaDoDesafio,
  Situacao,
  situacaoDaJogada,
} from './games.regras.js';
import { palavraAceita } from './palavras.js';

export type SituacaoDaPartida = Situacao;

export interface PartidaView {
  id: string;
  kind: GameKind;
  number: number;
  day: string;
  attempts: number;
  // so as imagens ja liberadas; a resposta so sai no fim
  images: string[];
  guesses: number[];
  words: string[];
  hints: string[];
  status: SituacaoDaPartida;
  score: number | null;
  // o que o jogo de texto ou de escolha mostra agora (pistas abertas, letras, filmes)
  content: unknown;
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
  // acertos por tentativa (1 a 7) e, na ultima posicao, as derrotas; duelo e linha: partidas por numero de acertos (0 a 7)
  distribution: number[];
}

type DesafioComMidia = GameChallenge & { media: Media | null };

const VAZIA: Jogada = { guesses: [], words: [], hints: [] };
const iguaisAte = <T>(a: T[], b: T[]) => a.every((v, i) => b[i] === v);
const comecaCom = (a: Jogada, b: Jogada) =>
  iguaisAte(b.guesses, a.guesses) &&
  iguaisAte(b.words, a.words) &&
  iguaisAte(b.hints, a.hints);
const tamanho = (j: Jogada) =>
  j.guesses.length + j.words.length + j.hints.length;

const paraRegras = (d: DesafioComMidia): DesafioDoJogo => ({
  kind: d.kind,
  images: d.images,
  data: d.data,
  media: d.media,
});

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
    const jogadas = new Map(
      salvas.map((p) => [
        p.challengeId,
        { guesses: p.guesses, words: p.words, hints: p.hints },
      ]),
    );

    return {
      day,
      challenges: desafios.map((d) =>
        this.montar(d, jogadas.get(d.id) ?? VAZIA),
      ),
    };
  }

  async jogar(
    challengeId: string,
    bruta: Partial<Jogada>,
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
    // 403, nao 401: o front leria 401 como sessao vencida
    if (!userId && SO_COM_CONTA.includes(desafio.kind)) {
      throw new ForbiddenException('Entre na sua conta para jogar esse jogo');
    }

    const jogada = this.normalizar(desafio, bruta);

    // desafio de outro dia so mostra o resultado, sem contar para a sequencia
    if (!userId || this.diaDe(desafio) !== hoje) {
      return this.montar(desafio, jogada);
    }

    const salva = await this.prisma.gamePlay.findUnique({
      where: { userId_challengeId: { userId, challengeId } },
    });
    const base: Jogada = salva
      ? { guesses: salva.guesses, words: salva.words, hints: salva.hints }
      : VAZIA;
    if (salva?.result) return this.montar(desafio, base);

    // outro aparelho ja andou mais: vale o que esta salvo
    if (tamanho(jogada) <= tamanho(base) && comecaCom(base, jogada)) {
      return this.montar(desafio, base);
    }
    if (!comecaCom(jogada, base)) {
      throw new ConflictException('Essa partida já tem outros palpites salvos');
    }

    const situacao = situacaoDaJogada(paraRegras(desafio), jogada);
    const result = situacao === 'PLAYING' ? null : situacao;
    await this.prisma.gamePlay.upsert({
      where: { userId_challengeId: { userId, challengeId } },
      create: { userId, challengeId, ...jogada, result },
      update: { ...jogada, result },
    });

    return this.montar(desafio, jogada);
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

    return { challenge: this.montar(desafio, VAZIA), repeated: !inedito };
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
          words: true,
          hints: true,
          result: true,
          challenge: {
            select: { kind: true, number: true, data: true, images: true },
          },
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
        const desafio: DesafioDoJogo = {
          kind,
          images: p.challenge.images,
          data: p.challenge.data,
          media: null,
        };
        const jogada = { guesses: p.guesses, words: p.words, hints: p.hints };
        distribution[
          posicaoNaDistribuicao(desafio, jogada, p.result === 'WON')
        ]++;
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

  private normalizar(desafio: DesafioComMidia, bruta: Partial<Jogada>): Jogada {
    try {
      return normalizarJogada(paraRegras(desafio), bruta, palavraAceita);
    } catch (e) {
      if (e instanceof JogadaInvalida) throw new BadRequestException(e.message);
      throw e;
    }
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

  private montar(desafio: DesafioComMidia, jogada: Jogada): PartidaView {
    const regras = paraRegras(desafio);
    const status = situacaoDaJogada(regras, jogada);
    const fim = status !== 'PLAYING';

    return {
      id: desafio.id,
      kind: desafio.kind,
      number: desafio.number,
      day: this.diaDe(desafio),
      attempts: TENTATIVAS,
      images: imagensLiberadas(regras, jogada, fim),
      guesses: jogada.guesses,
      words: jogada.words,
      hints: jogada.hints,
      status,
      score: placar(regras, jogada),
      content: conteudo(regras, jogada, fim),
      answer: resposta(regras, fim),
    };
  }
}
