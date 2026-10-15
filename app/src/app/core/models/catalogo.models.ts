export type TipoMidia = 'movie' | 'tv';

export interface Midia {
  id: string;
  tmdbId: number;
  type: 'MOVIE' | 'TV';
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
}

export interface ItemWatchlist {
  id: string;
  addedAt: string;
  media: Midia;
}

export interface AutorResumo {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

export interface AvaliacaoUsuario {
  id: string;
  rating: number | null;
  content: string | null;
  liked: boolean;
  watchedAt: string | null;
  createdAt: string;
  media?: Midia;
  user?: AutorResumo;
}

// o corpo carrega a ficha inteira: o backend substitui, e tudo vazio apaga
export interface EnvioAvaliacao {
  tmdbId: number;
  mediaType: TipoMidia;
  rating?: number;
  content?: string;
  liked?: boolean;
  watched?: boolean;
}

export interface EstatisticasMidia {
  total: number;
  notaMedia: number | null;
  curtidas: number;
  distribuicao: number[];
}
