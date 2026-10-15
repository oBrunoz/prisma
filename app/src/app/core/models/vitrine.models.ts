// seções da home montadas pela API (GET /vitrine/...)

export interface EstreiaDoDia {
  tmdbId: number;
  title: string;
  date: string;
  // quantos anos fez hoje
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
