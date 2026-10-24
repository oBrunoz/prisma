import type { GameKind } from '../generated/prisma/enums.js';
import { TENTATIVAS } from './games.constants.js';

export type Situacao = 'PLAYING' | 'WON' | 'LOST';

export const MAX_DICAS = 3;
// duelo e linha do tempo não têm erro que encerra: vence quem acerta a maioria
export const ACERTOS_PARA_VENCER = 4;
// carreira: cada conferida manda a ordem inteira
export const FILMES_DA_CARREIRA = 7;

export interface Jogada {
  guesses: number[];
  words: string[];
  hints: string[];
}

export interface Pista {
  rotulo: string;
  valor: string;
}

export interface FilmeDoJogo {
  tmdbId: number;
  title: string;
  year: number;
  posterPath: string | null;
}

export interface FilmeComNota extends FilmeDoJogo {
  nota: number;
}

export interface PessoaDoJogo {
  tmdbId: number;
  name: string;
  profilePath: string | null;
}

export interface DadosFicha {
  pistas: Pista[];
}
export interface DadosPersonagens {
  personagens: { posicao: string; nome: string; ator: string }[];
}
export interface DadosLetreiro {
  titulo: string;
  // letras na ordem em que acendem; abertas[n] = quantas estão acesas depois de n erros
  ordem: string[];
  abertas: number[];
  pistas: Pista[];
}
export interface DadosLegenda {
  // sem acento, minúscula; exibe é o título com acento, letra por casa
  palavra: string;
  exibe: string[];
  pistas: Pista[];
}
export interface DadosAssinatura {
  pessoa: PessoaDoJogo;
  // do menos ao mais conhecido
  filmes: FilmeDoJogo[];
}
export interface DadosCarreira {
  pessoa: PessoaDoJogo;
  // na ordem certa; inicial é a ordem em que aparecem
  filmes: FilmeDoJogo[];
  inicial: number[];
}
export interface DadosDuelo {
  duelos: [FilmeComNota, FilmeComNota][];
}
export interface DadosLinha {
  ancora: FilmeDoJogo;
  cartas: FilmeDoJogo[];
}

export interface FilmeDaResposta {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: Date | null;
}

export interface DesafioDoJogo {
  kind: GameKind;
  images: string[];
  data: unknown;
  media: FilmeDaResposta | null;
}

export interface RespostaDoDesafio {
  type: 'MOVIE' | 'PERSON';
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
}

export class JogadaInvalida extends Error {}

const TITULO: GameKind[] = [
  'FRAMES',
  'POSTER',
  'FICHA',
  'PERSONAGENS',
  'LETREIRO',
  'ASSINATURA',
];
export const adivinhaPorId = (kind: GameKind) => TITULO.includes(kind);
const comDicas = (kind: GameKind) => kind === 'LETREIRO' || kind === 'LEGENDA';

const dados = <T>(d: DesafioDoJogo) => d.data as T;

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const letraDe = (c: string) => semAcento(c).toUpperCase();
const ehLetra = (c: string) => /^[A-Z0-9]$/.test(letraDe(c));

function respostaPorId(d: DesafioDoJogo): number {
  if (d.kind === 'ASSINATURA') return dados<DadosAssinatura>(d).pessoa.tmdbId;
  if (!d.media) throw new Error(`Desafio de ${d.kind} sem filme`);
  return d.media.tmdbId;
}

export type Cor = 'certo' | 'lugar' | 'ausente';

// verde primeiro; o que sobrou da palavra vira laranja (letra repetida conta uma vez)
export function avaliarPalavra(tentativa: string, alvo: string): Cor[] {
  const cores: Cor[] = Array(alvo.length).fill('ausente');
  const resto: Record<string, number> = {};
  for (let i = 0; i < alvo.length; i++) {
    if (tentativa[i] === alvo[i]) cores[i] = 'certo';
    else resto[alvo[i]] = (resto[alvo[i]] ?? 0) + 1;
  }
  for (let i = 0; i < alvo.length; i++) {
    if (cores[i] !== 'certo' && resto[tentativa[i]] > 0) {
      cores[i] = 'lugar';
      resto[tentativa[i]]--;
    }
  }
  return cores;
}

export const normalizarPalavra = (s: string) =>
  semAcento(s).toLowerCase().trim();

export interface CartaNaLinha extends FilmeDoJogo {
  // null na âncora
  ok: boolean | null;
}

// cada vaga escolhida encaixa a carta; errada, ela vai para o lugar certo
export function simularLinha(d: DadosLinha, vagas: number[]) {
  const linha: CartaNaLinha[] = [{ ...d.ancora, ok: null }];
  const resultados: boolean[] = [];
  vagas.forEach((vaga, i) => {
    const carta = d.cartas[i];
    const antes = linha[vaga - 1];
    const depois = linha[vaga];
    const ok =
      (!antes || antes.year <= carta.year) &&
      (!depois || carta.year <= depois.year);
    const pos = ok ? vaga : linha.filter((f) => f.year < carta.year).length;
    linha.splice(pos, 0, { ...carta, ok });
    resultados.push(ok);
  });
  return { linha, resultados };
}

function pedacos(guesses: number[]): number[][] {
  const lista: number[][] = [];
  for (let i = 0; i < guesses.length; i += FILMES_DA_CARREIRA) {
    lista.push(guesses.slice(i, i + FILMES_DA_CARREIRA));
  }
  return lista;
}

export function conferidasDaCarreira(
  d: DadosCarreira,
  guesses: number[],
): boolean[][] {
  return pedacos(guesses).map((ordem) =>
    ordem.map((id, i) => d.filmes[i].tmdbId === id),
  );
}

const maiorDoDuelo = ([a, b]: [FilmeComNota, FilmeComNota]) =>
  a.nota >= b.nota ? a.tmdbId : b.tmdbId;

function acertosDoDuelo(d: DadosDuelo, guesses: number[]): boolean[] {
  return guesses.map((id, i) => maiorDoDuelo(d.duelos[i]) === id);
}

// letreiro: a letra apagada que mais aparece; empate, a que acenderia por último
function proximaLetraDoLetreiro(
  d: DadosLetreiro,
  erros: number,
  dadas: string[],
): string | null {
  const acesas = new Set([
    ...d.ordem.slice(0, d.abertas[Math.min(erros, d.abertas.length - 1)]),
    ...dadas,
  ]);
  const conta: Record<string, number> = {};
  for (const c of d.titulo) {
    const l = letraDe(c);
    if (ehLetra(c) && !acesas.has(l)) conta[l] = (conta[l] ?? 0) + 1;
  }
  const apagadas = Object.keys(conta).sort(
    (a, b) => conta[b] - conta[a] || d.ordem.indexOf(b) - d.ordem.indexOf(a),
  );
  return apagadas[0] ?? null;
}

function proximaCasaDaLegenda(
  d: DadosLegenda,
  palavras: string[],
  dadas: number[],
): number | null {
  const sabidas = new Set(dadas);
  for (const p of palavras) {
    avaliarPalavra(p, d.palavra).forEach(
      (c, i) => c === 'certo' && sabidas.add(i),
    );
  }
  for (let i = 0; i < d.palavra.length; i++) if (!sabidas.has(i)) return i;
  return null;
}

// "letra" chega sem valor e é resolvida aqui, com o que a pessoa já sabe; volta resolvida e é reenviada assim
function resolverDicas(d: DesafioDoJogo, jogada: Jogada): string[] {
  if (!comDicas(d.kind)) return [];
  const pistas =
    d.kind === 'LETREIRO'
      ? dados<DadosLetreiro>(d).pistas
      : dados<DadosLegenda>(d).pistas;
  const saida: string[] = [];
  for (const dica of jogada.hints.slice(0, MAX_DICAS)) {
    if (dica === 'pista') {
      if (saida.filter((x) => x === 'pista').length >= pistas.length)
        throw new JogadaInvalida('Acabaram as pistas');
      saida.push('pista');
      continue;
    }
    const valor = dica.startsWith('letra:')
      ? dica.slice(6)
      : dica === 'letra'
        ? null
        : undefined;
    if (valor === undefined) throw new JogadaInvalida('Dica inválida');
    if (d.kind === 'LETREIRO') {
      const l = dados<DadosLetreiro>(d);
      const dadas = saida
        .filter((x) => x.startsWith('letra:'))
        .map((x) => x.slice(6));
      const letra =
        valor ?? proximaLetraDoLetreiro(l, jogada.guesses.length, dadas);
      if (!letra || !l.ordem.includes(letra))
        throw new JogadaInvalida('Não há letra para acender');
      saida.push(`letra:${letra}`);
    } else {
      const l = dados<DadosLegenda>(d);
      const dadas = saida
        .filter((x) => x.startsWith('letra:'))
        .map((x) => Number(x.slice(6)));
      const casa =
        valor !== null
          ? Number(valor)
          : proximaCasaDaLegenda(l, jogada.words, dadas);
      if (
        casa === null ||
        !Number.isInteger(casa) ||
        casa < 0 ||
        casa >= l.palavra.length
      ) {
        throw new JogadaInvalida('Não há letra para mostrar');
      }
      saida.push(`letra:${casa}`);
    }
  }
  return saida;
}

// corta o que vem depois do fim e recusa o que não cabe no desafio
export function normalizarJogada(
  d: DesafioDoJogo,
  bruta: Partial<Jogada>,
  aceita: (palavra: string) => boolean = () => true,
): Jogada {
  const jogada: Jogada = {
    guesses: bruta.guesses ?? [],
    words: bruta.words ?? [],
    hints: bruta.hints ?? [],
  };

  if (adivinhaPorId(d.kind)) {
    const resposta = respostaPorId(d);
    const acerto = jogada.guesses.indexOf(resposta);
    const ate = acerto >= 0 ? acerto + 1 : jogada.guesses.length;
    const guesses = jogada.guesses.slice(0, Math.min(ate, TENTATIVAS));
    return {
      guesses,
      words: [],
      hints: resolverDicas(d, { ...jogada, guesses }),
    };
  }

  if (d.kind === 'LEGENDA') {
    const l = dados<DadosLegenda>(d);
    const palavras = jogada.words.map(normalizarPalavra);
    for (const p of palavras) {
      if (p.length !== l.palavra.length || !/^[a-z]+$/.test(p)) {
        throw new JogadaInvalida(`A palavra tem ${l.palavra.length} letras`);
      }
      if (p !== l.palavra && !aceita(p))
        throw new JogadaInvalida('Essa palavra não está na lista');
    }
    const acerto = palavras.indexOf(l.palavra);
    const words = palavras.slice(
      0,
      Math.min(acerto >= 0 ? acerto + 1 : palavras.length, TENTATIVAS),
    );
    return {
      guesses: [],
      words,
      hints: resolverDicas(d, { ...jogada, words }),
    };
  }

  if (d.kind === 'DUELO') {
    const duelos = dados<DadosDuelo>(d).duelos;
    const guesses = jogada.guesses.slice(0, duelos.length);
    guesses.forEach((id, i) => {
      if (!duelos[i].some((f) => f.tmdbId === id))
        throw new JogadaInvalida('Escolha fora do duelo');
    });
    return { guesses, words: [], hints: [] };
  }

  if (d.kind === 'LINHA') {
    const cartas = dados<DadosLinha>(d).cartas;
    const guesses = jogada.guesses.slice(0, cartas.length);
    guesses.forEach((vaga, i) => {
      // com a âncora, a linha tem i + 1 cartas e i + 2 vagas
      if (!Number.isInteger(vaga) || vaga < 0 || vaga > i + 1)
        throw new JogadaInvalida('Vaga fora da linha');
    });
    return { guesses, words: [], hints: [] };
  }

  const c = dados<DadosCarreira>(d);
  if (jogada.guesses.length % FILMES_DA_CARREIRA)
    throw new JogadaInvalida('Cada conferida manda a ordem inteira');
  const todos = [...c.filmes.map((f) => f.tmdbId)].sort((a, b) => a - b).join();
  const travados = new Set<number>();
  const ordens: number[][] = [];
  for (const ordem of pedacos(jogada.guesses).slice(0, TENTATIVAS)) {
    if ([...ordem].sort((a, b) => a - b).join() !== todos)
      throw new JogadaInvalida('A ordem precisa ter os sete filmes');
    for (const pos of travados) {
      if (ordem[pos] !== c.filmes[pos].tmdbId)
        throw new JogadaInvalida('Filme travado saiu do lugar');
    }
    ordens.push(ordem);
    const certos = ordem.map((id, i) => c.filmes[i].tmdbId === id);
    certos.forEach((ok, i) => ok && travados.add(i));
    if (certos.every(Boolean)) break;
  }
  return { guesses: ordens.flat(), words: [], hints: [] };
}

export function situacaoDaJogada(d: DesafioDoJogo, j: Jogada): Situacao {
  if (adivinhaPorId(d.kind)) {
    if (j.guesses.includes(respostaPorId(d))) return 'WON';
    return j.guesses.length >= TENTATIVAS ? 'LOST' : 'PLAYING';
  }
  if (d.kind === 'LEGENDA') {
    if (j.words.includes(dados<DadosLegenda>(d).palavra)) return 'WON';
    return j.words.length >= TENTATIVAS ? 'LOST' : 'PLAYING';
  }
  if (d.kind === 'DUELO' || d.kind === 'LINHA') {
    const total =
      d.kind === 'DUELO'
        ? dados<DadosDuelo>(d).duelos.length
        : dados<DadosLinha>(d).cartas.length;
    if (j.guesses.length < total) return 'PLAYING';
    return (placar(d, j) ?? 0) >= ACERTOS_PARA_VENCER ? 'WON' : 'LOST';
  }
  const conferidas = conferidasDaCarreira(dados<DadosCarreira>(d), j.guesses);
  if (conferidas.at(-1)?.every(Boolean)) return 'WON';
  return conferidas.length >= TENTATIVAS ? 'LOST' : 'PLAYING';
}

export function placar(d: DesafioDoJogo, j: Jogada): number | null {
  if (d.kind === 'DUELO')
    return acertosDoDuelo(dados<DadosDuelo>(d), j.guesses).filter(Boolean)
      .length;
  if (d.kind === 'LINHA')
    return simularLinha(dados<DadosLinha>(d), j.guesses).resultados.filter(
      Boolean,
    ).length;
  return null;
}

// quantas tentativas a jogada já usou (a carreira conta conferidas)
export function tentativasUsadas(d: DesafioDoJogo, j: Jogada): number {
  if (d.kind === 'LEGENDA') return j.words.length;
  if (d.kind === 'CARREIRA')
    return Math.ceil(j.guesses.length / FILMES_DA_CARREIRA);
  return j.guesses.length;
}

// a barra das estatísticas: em que tentativa acertou (7 = não acertou); duelo e linha, quantos acertos
export function posicaoNaDistribuicao(
  d: DesafioDoJogo,
  j: Jogada,
  venceu: boolean,
): number {
  const p = placar(d, j);
  if (p !== null) return p;
  return venceu ? tentativasUsadas(d, j) - 1 : TENTATIVAS;
}

export function imagensLiberadas(
  d: DesafioDoJogo,
  j: Jogada,
  fim: boolean,
): string[] {
  if (d.kind === 'POSTER') return d.images.slice(0, 1);
  if (d.kind !== 'FRAMES') return [];
  return d.images.slice(
    0,
    fim ? TENTATIVAS : Math.min(j.guesses.length + 1, TENTATIVAS),
  );
}

type DicaVista =
  | { tipo: 'letra'; valor: string; posicao?: number }
  | { tipo: 'pista'; rotulo: string; valor: string };

function dicasVistas(
  pistas: Pista[],
  hints: string[],
  letra: (v: string) => DicaVista,
): DicaVista[] {
  let k = 0;
  return hints.map((h) =>
    h === 'pista' ? { tipo: 'pista', ...pistas[k++] } : letra(h.slice(6)),
  );
}

export function conteudo(d: DesafioDoJogo, j: Jogada, fim: boolean): unknown {
  const abertas = fim ? TENTATIVAS : Math.min(j.guesses.length + 1, TENTATIVAS);

  switch (d.kind) {
    case 'FICHA':
      return {
        pistas: dados<DadosFicha>(d).pistas.map((p, i) => ({
          rotulo: p.rotulo,
          valor: i < abertas ? p.valor : null,
        })),
      };

    case 'PERSONAGENS':
      return {
        personagens: dados<DadosPersonagens>(d).personagens.map((p, i) => ({
          posicao: p.posicao,
          nome: i < abertas ? p.nome : null,
          ator: fim ? p.ator : null,
        })),
      };

    case 'ASSINATURA':
      return {
        filmes: dados<DadosAssinatura>(d).filmes.map((f, i) => ({
          title: i < abertas ? f.title : null,
          posterPath: i < abertas ? f.posterPath : null,
          year: f.year,
        })),
      };

    case 'LETREIRO': {
      const l = dados<DadosLetreiro>(d);
      const erros = Math.min(j.guesses.length, l.abertas.length - 1);
      // em que tentativa cada letra acendeu; 7 = por dica
      const nivel: Record<string, number> = {};
      for (let n = 0; n <= erros; n++) {
        for (const letra of l.ordem.slice(0, l.abertas[n])) nivel[letra] ??= n;
      }
      for (const h of j.hints)
        if (h.startsWith('letra:')) nivel[h.slice(6)] ??= TENTATIVAS;
      return {
        letras: [...l.titulo].map((c) => {
          if (!ehLetra(c)) return { c, nivel: null };
          const n = nivel[letraDe(c)];
          return n === undefined
            ? { c: fim ? c : '', nivel: null }
            : { c, nivel: n };
        }),
        dicas: dicasVistas(l.pistas, j.hints, (v) => ({
          tipo: 'letra',
          valor: v,
        })),
        podeDica: !fim && j.hints.length < MAX_DICAS,
        pistasRestantes:
          l.pistas.length - j.hints.filter((h) => h === 'pista').length,
        letrasRestantes: proximaLetraDoLetreiro(
          l,
          j.guesses.length,
          j.hints.filter((h) => h.startsWith('letra:')).map((h) => h.slice(6)),
        )
          ? 1
          : 0,
      };
    }

    case 'LEGENDA': {
      const l = dados<DadosLegenda>(d);
      const dadas = j.hints
        .filter((h) => h.startsWith('letra:'))
        .map((h) => Number(h.slice(6)));
      return {
        tamanho: l.palavra.length,
        linhas: j.words.map((p) => {
          const cores = avaliarPalavra(p, l.palavra);
          return {
            letras: [...p].map((c, i) =>
              cores[i] === 'certo' ? l.exibe[i] : c.toUpperCase(),
            ),
            cores,
          };
        }),
        dicas: dicasVistas(l.pistas, j.hints, (v) => ({
          tipo: 'letra',
          valor: l.exibe[Number(v)],
          posicao: Number(v),
        })),
        podeDica: !fim && j.hints.length < MAX_DICAS,
        pistasRestantes:
          l.pistas.length - j.hints.filter((h) => h === 'pista').length,
        letrasRestantes:
          proximaCasaDaLegenda(l, j.words, dadas) === null ? 0 : 1,
      };
    }

    case 'DUELO': {
      const duelos = dados<DadosDuelo>(d).duelos;
      const acertos = acertosDoDuelo(dados<DadosDuelo>(d), j.guesses);
      // os já escolhidos com nota; o da vez sem; os seguintes nem aparecem
      const vistos = duelos.slice(
        0,
        Math.min(j.guesses.length + 1, duelos.length),
      );
      return {
        total: duelos.length,
        duelos: vistos.map((par, i) => {
          const escolhido = j.guesses[i] ?? null;
          const filme = (f: FilmeComNota) => ({
            ...f,
            nota: escolhido !== null ? f.nota : null,
          });
          return {
            a: filme(par[0]),
            b: filme(par[1]),
            escolhido,
            acertou: escolhido !== null ? acertos[i] : null,
          };
        }),
      };
    }

    case 'LINHA': {
      const l = dados<DadosLinha>(d);
      const { linha, resultados } = simularLinha(l, j.guesses);
      const proxima = l.cartas[j.guesses.length];
      return {
        total: l.cartas.length,
        linha,
        resultados,
        atual:
          proxima && !fim
            ? {
                tmdbId: proxima.tmdbId,
                title: proxima.title,
                posterPath: proxima.posterPath,
              }
            : null,
      };
    }

    case 'CARREIRA': {
      const c = dados<DadosCarreira>(d);
      const conferidas = conferidasDaCarreira(c, j.guesses);
      const ultima = pedacos(j.guesses).at(-1) ?? c.inicial;
      const travados = new Set<number>();
      conferidas.forEach((ok) =>
        ok.forEach((v, i) => v && travados.add(c.filmes[i].tmdbId)),
      );
      const porId = new Map(c.filmes.map((f) => [f.tmdbId, f]));
      return {
        pessoa: { name: c.pessoa.name, profilePath: c.pessoa.profilePath },
        ordem: ultima.map((id) => {
          const f = porId.get(id)!;
          const travado = travados.has(id);
          return {
            tmdbId: id,
            title: f.title,
            posterPath: f.posterPath,
            year: travado || fim ? f.year : null,
            travado,
          };
        }),
        conferidas,
        gabarito: fim ? c.filmes : null,
      };
    }

    default:
      return null;
  }
}

export function resposta(
  d: DesafioDoJogo,
  fim: boolean,
): RespostaDoDesafio | null {
  if (!fim) return null;
  if (d.kind === 'ASSINATURA' || d.kind === 'CARREIRA') {
    const p = (d.data as { pessoa: PessoaDoJogo }).pessoa;
    return {
      type: 'PERSON',
      tmdbId: p.tmdbId,
      title: p.name,
      posterPath: p.profilePath,
      year: null,
    };
  }
  if (!d.media) return null;
  return {
    type: 'MOVIE',
    tmdbId: d.media.tmdbId,
    title: d.media.title,
    posterPath: d.media.posterPath,
    year: d.media.releaseDate?.getUTCFullYear() ?? null,
  };
}
