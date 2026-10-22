import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DesafiosDoDia,
  EstatisticasJogo,
  Partida,
  SorteioJogo,
  TENTATIVAS,
  TipoJogo,
  TituloPalpite,
} from '../models/jogos.models';
import { AuthService } from './auth.service';

// deslogado, a partida e o histórico ficam no aparelho; logado, na conta
const CHAVE_PARTIDAS = 'prisma.jogos.partidas';
const CHAVE_HISTORICO = 'prisma.jogos.historico';
const CHAVE_TITULOS = 'prisma.jogos.titulos';
const LIMITE_PARTIDAS = 10;
const LIMITE_TITULOS = 200;

type Historico = Record<TipoJogo, Record<number, { venceu: boolean; tentativas: number }>>;

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

// a mesma conta da API: sequência por números seguidos, até hoje ou ontem
export function calcularEstatisticas(
  partidas: Record<number, { venceu: boolean; tentativas: number }>,
  numeroDeHoje: number,
): EstatisticasJogo {
  const numeros = Object.keys(partidas).map(Number).sort((a, b) => a - b);
  const distribution = Array<number>(TENTATIVAS + 1).fill(0);
  for (const n of numeros) {
    const p = partidas[n];
    distribution[p.venceu ? p.tentativas - 1 : TENTATIVAS]++;
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

  // deslogado, os palpites guardados no aparelho são conferidos de novo pela API
  hoje(): Observable<DesafiosDoDia> {
    return this.http.get<DesafiosDoDia>(`${this.base}/today`).pipe(
      switchMap((dia) => {
        if (this.auth.autenticado()) return of(dia);
        const locais = ler<Record<string, number[]>>(CHAVE_PARTIDAS, {});
        if (!dia.challenges.some((c) => locais[c.id]?.length)) return of(dia);
        return forkJoin(
          dia.challenges.map((c) => (locais[c.id]?.length ? this.conferir(c.id, locais[c.id]) : of(c))),
        ).pipe(map((challenges) => ({ ...dia, challenges })));
      }),
    );
  }

  // manda a lista inteira de palpites; a API confere e libera as imagens
  jogar(partida: Partida, palpites: number[]): Observable<Partida> {
    return this.conferir(partida.id, palpites).pipe(tap((p) => this.guardar(p)));
  }

  // desafio antigo ao acaso, só com conta; exceto vai do mais antigo ao mais recente
  sortear(tipo: TipoJogo, exceto: string[]): Observable<SorteioJogo> {
    const params: Record<string, string> = { kind: tipo };
    if (exceto.length) params['exceto'] = exceto.join(',');
    return this.http.get<SorteioJogo>(`${this.base}/random`, { params });
  }

  // a sorteada só é conferida: não vai para o aparelho nem para a sequência
  jogarSorteada(partida: Partida, palpites: number[]): Observable<Partida> {
    return this.conferir(partida.id, palpites);
  }

  estatisticas(numerosDeHoje: Partial<Record<TipoJogo, number>>): Observable<Record<TipoJogo, EstatisticasJogo>> {
    if (this.auth.autenticado()) {
      return this.http.get<Record<TipoJogo, EstatisticasJogo>>(`${this.base}/stats`);
    }
    const historico = ler<Historico>(CHAVE_HISTORICO, { FRAMES: {}, POSTER: {} });
    return of({
      FRAMES: calcularEstatisticas(historico.FRAMES ?? {}, numerosDeHoje.FRAMES ?? 0),
      POSTER: calcularEstatisticas(historico.POSTER ?? {}, numerosDeHoje.POSTER ?? 0),
    });
  }

  titulos(): Record<number, TituloPalpite> {
    return ler<Record<number, TituloPalpite>>(CHAVE_TITULOS, {});
  }

  lembrarTitulo(tmdbId: number, titulo: TituloPalpite): void {
    const todos = this.titulos();
    delete todos[tmdbId];
    todos[tmdbId] = titulo;
    const chaves = Object.keys(todos);
    for (const velha of chaves.slice(0, Math.max(0, chaves.length - LIMITE_TITULOS))) delete todos[+velha];
    gravar(CHAVE_TITULOS, todos);
  }

  private conferir(id: string, guesses: number[]): Observable<Partida> {
    return this.http.post<Partida>(`${this.base}/${id}/play`, { guesses });
  }

  private guardar(p: Partida): void {
    if (this.auth.autenticado()) return;

    const partidas = ler<Record<string, number[]>>(CHAVE_PARTIDAS, {});
    delete partidas[p.id];
    partidas[p.id] = p.guesses;
    const ids = Object.keys(partidas);
    for (const velho of ids.slice(0, Math.max(0, ids.length - LIMITE_PARTIDAS))) delete partidas[velho];
    gravar(CHAVE_PARTIDAS, partidas);

    if (p.status === 'PLAYING') return;
    const historico = ler<Historico>(CHAVE_HISTORICO, { FRAMES: {}, POSTER: {} });
    historico[p.kind] = { ...historico[p.kind], [p.number]: { venceu: p.status === 'WON', tentativas: p.guesses.length } };
    gravar(CHAVE_HISTORICO, historico);
  }
}
