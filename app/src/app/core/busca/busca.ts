import { Movie, Person, TvShow } from '../models/tmdb.models';

export interface Trecho {
  texto: string;
  destaque: boolean;
}

export interface TituloBusca {
  id: number;
  tipo: 'movies' | 'series';
  titulo: string;
  partes: Trecho[];
  ano: string;
  posterPath: string | null;
}

export interface PessoaBusca {
  id: number;
  nome: string;
  partes: Trecho[];
  fotoPath: string | null;
  oficio: string;
}

export const DEPARTAMENTOS: Record<string, string> = {
  Acting: 'Atuação',
  Directing: 'Direção',
  Writing: 'Roteiro',
  Production: 'Produção',
  Sound: 'Som',
  Camera: 'Fotografia',
  Editing: 'Montagem',
  Art: 'Direção de arte',
};

// "ana" acha "Anaïs": compara sem acento e sem caixa, mas devolve o texto original
export function trechos(texto: string, termo: string): Trecho[] {
  const alvo = semAcento(termo.trim());
  if (!alvo) return [{ texto, destaque: false }];

  const base = [...texto].map((c) => semAcento(c));
  const inicio = base.join('').indexOf(alvo);
  if (inicio < 0 || base.some((c) => c.length !== 1)) return [{ texto, destaque: false }];

  const letras = [...texto];
  const fim = inicio + alvo.length;
  return [
    { texto: letras.slice(0, inicio).join(''), destaque: false },
    { texto: letras.slice(inicio, fim).join(''), destaque: true },
    { texto: letras.slice(fim).join(''), destaque: false },
  ].filter((t) => t.texto);
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function filmeParaTitulo(filme: Movie, termo: string): TituloBusca {
  return {
    id: filme.id,
    tipo: 'movies',
    titulo: filme.title,
    partes: trechos(filme.title, termo),
    ano: filme.release_date?.slice(0, 4) ?? '',
    posterPath: filme.poster_path,
  };
}

export function serieParaTitulo(serie: TvShow, termo: string): TituloBusca {
  return {
    id: serie.id,
    tipo: 'series',
    titulo: serie.name,
    partes: trechos(serie.name, termo),
    ano: serie.first_air_date?.slice(0, 4) ?? '',
    posterPath: serie.poster_path,
  };
}

export function pessoaParaBusca(pessoa: Person, termo: string): PessoaBusca {
  return {
    id: pessoa.id,
    nome: pessoa.name,
    partes: trechos(pessoa.name, termo),
    fotoPath: pessoa.profile_path,
    oficio: DEPARTAMENTOS[pessoa.known_for_department] ?? pessoa.known_for_department ?? '',
  };
}
