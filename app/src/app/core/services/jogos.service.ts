import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DesafiosDoDia,
  EstatisticasJogo,
  JOGOS,
  Jogada,
  Partida,
  SorteioJogo,
  TENTATIVAS,
  TipoJogo,
  TituloPalpite,
  soComConta,
  tentativasUsadas,
} from '../models/jogos.models';
import { AuthService } from './auth.service';

// deslogado, a partida e o histórico ficam no aparelho; logado, na conta
const CHAVE_PARTIDAS = 'prisma.jogos.partidas';
const CHAVE_HISTORICO = 'prisma.jogos.historico';
const CHAVE_TITULOS = 'prisma.jogos.titulos';
const CHAVE_PESSOAS = 'prisma.jogos.pessoas';
const CHAVE_VISTOS = 'prisma.jogos.como-jogar';
const LIMITE_PARTIDAS = 20;
const LIMITE_TITULOS = 200;

// posicao: a barra das estatísticas (tentativa do acerto, 7 = errou; duelo e linha, os acertos)
type Registro = { venceu: boolean; tentativas: number; posicao?: number };
type Historico = Partial<Record<TipoJogo, Record<number, Registro>>>;

function ler<T>(chave: string, padrao: T): T {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? (JSON.parse(valor) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento a partida só não sobrevive ao recarregar
  }
}

// partidas antigas foram guardadas só com a lista de palpites
const comoJogada = (salva: number[] | Jogada | undefined): Jogada | null => {
  if (!salva) return null;
  if (Array.isArray(salva)) return { guesses: salva, words: [], hints: [] };
  return { guesses: salva.guesses ?? [], words: salva.words ?? [], hints: salva.hints ?? [] };
};
const temJogada = (j: Jogada | null): j is Jogada => !!j && j.guesses.length + j.words.length + j.hints.length > 0;

// a mesma conta da API: sequência por números seguidos, até hoje ou ontem
export function calcularEstatisticas(partidas: Record<number, Registro>, numeroDeHoje: number): EstatisticasJogo {
  const numeros = Object.keys(partidas).map(Number).sort((a, b) => a - b);
  const distribution = Array<number>(TENTATIVAS + 1).fill(0);
  for (const n of numeros) {
    const p = partidas[n];
    distribution[p.posicao ?? (p.venceu ? p.tentativas - 1 : TENTATIVAS)]++;
  }

  let n = partidas[numeroDeHoje] ? numeroDeHoje : numeroDeHoje - 1;
  let currentStreak = 0;
  while (partidas[n]?.venceu) {
    currentStreak++;
    n--;
  }

  let bestStreak = 0;
  let corrida = 0;
  let anterior = -1;
  for (const numero of numeros) {
    corrida = partidas[numero].venceu ? (numero === anterior + 1 ? corrida + 1 : 1) : 0;
    bestStreak = Math.max(bestStreak, corrida);
    anterior = numero;
  }

  return {
    played: numeros.length,
    won: numeros.filter((k) => partidas[k].venceu).length,
    currentStreak,
    bestStreak,
    distribution,
  };
}

@Injectable({ providedIn: 'root' })
export class JogosService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/games`;

  // deslogado, as jogadas guardadas no aparelho são conferidas de novo pela API
  hoje(): Observable<DesafiosDoDia> {
    return this.http.get<DesafiosDoDia>(`${this.base}/today`).pipe(
      switchMap((dia) => {
        if (this.auth.autenticado()) return of(dia);
        const locais = ler<Record<string, number[] | Jogada>>(CHAVE_PARTIDAS, {});
        // jogo só com conta não confere jogada de quem está deslogado
        const local = (c: Partida) => (soComConta(c.kind) ? null : comoJogada(locais[c.id]));
        if (!dia.challenges.some((c) => temJogada(local(c)))) return of(dia);
        return forkJoin(
          dia.challenges.map((c) => {
            const j = local(c);
            // jogada guardada que não serve mais (desafio trocado) volta ao começo
            return temJogada(j) ? this.conferir(c.id, j).pipe(catchError(() => of(c))) : of(c);
          }),
        ).pipe(map((challenges) => ({ ...dia, challenges })));
      }),
    );
  }

  // manda a jogada inteira; a API confere e libera o que pode
  jogar(partida: Partida, jogada: Jogada): Observable<Partida> {
    return this.conferir(partida.id, jogada).pipe(tap((p) => this.guardar(p)));
  }

  // desafio antigo ao acaso, só com conta; exceto vai do mais antigo ao mais recente
  sortear(tipo: TipoJogo, exceto: string[]): Observable<SorteioJogo> {
    const params: Record<string, string> = { kind: tipo };
    if (exceto.length) params['exceto'] = exceto.join(',');
    return this.http.get<SorteioJogo>(`${this.base}/random`, { params });
  }

  // a sorteada só é conferida: não vai para o aparelho nem para a sequência
  jogarSorteada(partida: Partida, jogada: Jogada): Observable<Partida> {
    return this.conferir(partida.id, jogada);
  }

  estatisticas(numerosDeHoje: Partial<Record<TipoJogo, number>>): Observable<Partial<Record<TipoJogo, EstatisticasJogo>>> {
    if (this.auth.autenticado()) {
      return this.http.get<Record<TipoJogo, EstatisticasJogo>>(`${this.base}/stats`);
    }
    const historico = ler<Historico>(CHAVE_HISTORICO, {});
    return of(
      Object.fromEntries(
        JOGOS.map((j) => [j.tipo, calcularEstatisticas(historico[j.tipo] ?? {}, numerosDeHoje[j.tipo] ?? 0)]),
      ),
    );
  }

  titulos(): Record<number, TituloPalpite> {
    return ler<Record<number, TituloPalpite>>(CHAVE_TITULOS, {});
  }

  // pessoas (Assinatura) em outra gaveta: o id da pessoa pode bater com o de um filme
  pessoas(): Record<number, TituloPalpite> {
    return ler<Record<number, TituloPalpite>>(CHAVE_PESSOAS, {});
  }

  lembrarTitulo(tmdbId: number, titulo: TituloPalpite, pessoa = false): void {
    const chave = pessoa ? CHAVE_PESSOAS : CHAVE_TITULOS;
    const todos = ler<Record<number, TituloPalpite>>(chave, {});
    delete todos[tmdbId];
    todos[tmdbId] = titulo;
    const chaves = Object.keys(todos);
    for (const velha of chaves.slice(0, Math.max(0, chaves.length - LIMITE_TITULOS))) delete todos[+velha];
    gravar(chave, todos);
  }

  // o como jogar abre sozinho só na primeira vez de cada jogo
  jaViuComoJogar(tipo: TipoJogo): boolean {
    return ler<TipoJogo[]>(CHAVE_VISTOS, []).includes(tipo);
  }

  marcarComoJogarVisto(tipo: TipoJogo): void {
    const vistos = ler<TipoJogo[]>(CHAVE_VISTOS, []);
    if (!vistos.includes(tipo)) gravar(CHAVE_VISTOS, [...vistos, tipo]);
  }

  private conferir(id: string, jogada: Jogada): Observable<Partida> {
    return this.http.post<Partida>(`${this.base}/${id}/play`, jogada);
  }

  private guardar(p: Partida): void {
    if (this.auth.autenticado()) return;

    const partidas = ler<Record<string, number[] | Jogada>>(CHAVE_PARTIDAS, {});
    delete partidas[p.id];
    partidas[p.id] = { guesses: p.guesses, words: p.words, hints: p.hints };
    const ids = Object.keys(partidas);
    for (const velho of ids.slice(0, Math.max(0, ids.length - LIMITE_PARTIDAS))) delete partidas[velho];
    gravar(CHAVE_PARTIDAS, partidas);

    if (p.status === 'PLAYING') return;
    const historico = ler<Historico>(CHAVE_HISTORICO, {});
    const venceu = p.status === 'WON';
    const tentativas = tentativasUsadas(p);
    const posicao = p.score ?? (venceu ? tentativas - 1 : TENTATIVAS);
    historico[p.kind] = { ...historico[p.kind], [p.number]: { venceu, tentativas, posicao } };
    gravar(CHAVE_HISTORICO, historico);
  }
}
