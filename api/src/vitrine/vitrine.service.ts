import { Injectable } from '@nestjs/common';
import { diaDoJogo } from '../games/games.constants.js';
import { TmdbService } from '../tmdb/tmdb.service.js';

interface FilmeDescoberto {
  id: number;
  title: string;
  release_date: string;
  vote_count: number;
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
}

interface Colecao {
  id: number;
  name: string;
  backdrop_path: string | null;
  parts: FilmeDescoberto[];
}

export interface EstreiaDoDia {
  tmdbId: number;
  title: string;
  date: string;
  years: number;
  rating: number;
  posterPath: string | null;
  backdropPath: string | null;
}

export interface NesteDia {
  day: string;
  highlight: (EstreiaDoDia & { director: string | null }) | null;
  others: EstreiaDoDia[];
}

export interface Maratona {
  id: number;
  name: string;
  backdropPath: string | null;
  posters: string[];
  films: number;
  minutes: number;
  from: number;
  to: number;
  firstTmdbId: number;
}

// "Neste dia" olha estreias desde 1950; abaixo disso de votos o filme e pouco conhecido
const PRIMEIRO_ANO = 1950;
const MIN_VOTOS = 300;
const LOTE = 10;
const ESTREIAS = 5;

const COLECOES = [119, 1241, 264, 10, 2344, 10194, 263, 84, 131635, 8091, 87359, 2150];
const UM_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class VitrineService {
  private nesteDiaGuardado: { dia: string; dados: Promise<NesteDia> } | null = null;
  private maratonasGuardadas: { ate: number; dados: Promise<Maratona[]> } | null = null;

  constructor(private readonly tmdb: TmdbService) {}

  // montado uma vez por dia (meia-noite de Brasilia, como os jogos); a falha nao fica guardada
  nesteDia(): Promise<NesteDia> {
    const dia = diaDoJogo();
    if (this.nesteDiaGuardado?.dia !== dia) {
      const dados = this.montarNesteDia(dia);
      this.nesteDiaGuardado = { dia, dados };
      dados.catch(() => {
        if (this.nesteDiaGuardado?.dados === dados) this.nesteDiaGuardado = null;
      });
    }
    return this.nesteDiaGuardado.dados;
  }

  maratonas(): Promise<Maratona[]> {
    if (!this.maratonasGuardadas || this.maratonasGuardadas.ate < Date.now()) {
      const dados = this.montarMaratonas();
      this.maratonasGuardadas = { ate: Date.now() + UM_DIA, dados };
      dados.catch(() => {
        if (this.maratonasGuardadas?.dados === dados) this.maratonasGuardadas = null;
      });
    }
    return this.maratonasGuardadas.dados;
  }

  // o filme mais votado que estreou neste mesmo dia, ano a ano; os cinco maiores entram
  private async montarNesteDia(dia: string): Promise<NesteDia> {
    const [ano, mes, diaDoMes] = dia.split('-');
    const anos = Array.from({ length: Number(ano) - PRIMEIRO_ANO }, (_, i) => PRIMEIRO_ANO + i);
    const achados: FilmeDescoberto[] = [];

    for (let i = 0; i < anos.length; i += LOTE) {
      const respostas = await Promise.all(
        anos.slice(i, i + LOTE).map((a) => {
          const data = `${a}-${mes}-${diaDoMes}`;
          return this.tmdb
            .get<{ results: FilmeDescoberto[] }>('/discover/movie', {
              'primary_release_date.gte': data,
              'primary_release_date.lte': data,
              sort_by: 'vote_count.desc',
              include_adult: false,
            })
            // 29 de fevereiro em ano comum, ou uma falha isolada: o ano so fica de fora
            .catch(() => null);
        }),
      );
      for (const r of respostas) {
        const filme = r?.results?.[0];
        if (filme && filme.vote_count >= MIN_VOTOS) achados.push(filme);
      }
    }

    const [primeiro, ...resto] = achados.sort((a, b) => b.vote_count - a.vote_count).slice(0, ESTREIAS);
    if (!primeiro) return { day: dia, highlight: null, others: [] };

    const creditos = await this.tmdb
      .get<{ crew: { job: string; name: string }[] }>(`/movie/${primeiro.id}/credits`)
      .catch(() => null);

    return {
      day: dia,
      highlight: {
        ...estreia(primeiro, Number(ano)),
        director: creditos?.crew.find((c) => c.job === 'Director')?.name ?? null,
      },
      others: resto.map((f) => estreia(f, Number(ano))),
    };
  }

  // a duracao de cada filme nao vem na colecao: soma pelos detalhes, uma saga por vez
  private async montarMaratonas(): Promise<Maratona[]> {
    const hoje = new Date().toISOString().slice(0, 10);
    const maratonas: Maratona[] = [];

    for (const id of COLECOES) {
      const colecao = await this.tmdb.get<Colecao>(`/collection/${id}`).catch(() => null);
      const filmes = (colecao?.parts ?? [])
        .filter((f) => f.release_date && f.release_date <= hoje)
        .sort((a, b) => a.release_date.localeCompare(b.release_date));
      if (!colecao || filmes.length < 2) continue;

      const duracoes = await Promise.all(
        filmes.map((f) =>
          this.tmdb
            .get<{ runtime: number | null }>(`/movie/${f.id}`)
            .then((d) => d.runtime ?? 0)
            .catch(() => 0),
        ),
      );

      maratonas.push({
        id,
        name: colecao.name.replace(/^Coleção\s+/i, '').replace(/[\s:–-]*Coleção$/i, ''),
        backdropPath: colecao.backdrop_path,
        posters: filmes.map((f) => f.poster_path).filter((p): p is string => !!p),
        films: filmes.length,
        minutes: duracoes.reduce((s, m) => s + m, 0),
        from: Number(filmes[0].release_date.slice(0, 4)),
        to: Number(filmes[filmes.length - 1].release_date.slice(0, 4)),
        firstTmdbId: filmes[0].id,
      });
    }

    return maratonas;
  }
}

function estreia(f: FilmeDescoberto, anoAtual: number): EstreiaDoDia {
  return {
    tmdbId: f.id,
    title: f.title,
    date: f.release_date,
    years: anoAtual - Number(f.release_date.slice(0, 4)),
    rating: f.vote_average,
    posterPath: f.poster_path,
    backdropPath: f.backdrop_path,
  };
}
