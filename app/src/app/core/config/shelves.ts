export interface ShelfConfig {
  id: string;
  title: string;
  params: Record<string, string | number>;
}

const currentYear = new Date().getFullYear();

const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const daysAgo = (days: number): string => daysFromNow(-days);

export const MOVIE_SHELVES: ShelfConfig[] = [
  {
    id: 'bilheteria',
    title: 'Campeões de bilheteria',
    params: { sort_by: 'revenue.desc', 'vote_count.gte': 150 },
  },
  {
    id: 'aclamados',
    title: 'Aclamados pela crítica',
    params: { sort_by: 'vote_average.desc', 'vote_count.gte': 2000 },
  },
  {
    id: 'lancamentos',
    title: `Lançamentos de ${currentYear}`,
    params: {
      'primary_release_date.gte': `${currentYear}-01-01`,
      sort_by: 'popularity.desc',
      'vote_count.gte': 50,
    },
  },
  {
    id: 'netflix',
    title: 'Disponível na Netflix',
    params: {
      with_watch_providers: 8,
      watch_region: 'BR',
      sort_by: 'popularity.desc',
      'vote_count.gte': 150,
    },
  },
  {
    id: 'anos90',
    title: 'Clássicos dos anos 90',
    params: {
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
      sort_by: 'vote_count.desc',
    },
  },
  {
    id: 'joias',
    title: 'Joias escondidas',
    params: {
      'vote_average.gte': 7.2,
      'vote_count.gte': 300,
      'vote_count.lte': 3000,
      sort_by: 'vote_average.desc',
    },
  },
];

export const TV_SHELVES: ShelfConfig[] = [
  {
    id: 'aclamadas',
    title: 'Aclamadas pela crítica',
    params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 },
  },
  {
    id: 'no-ar',
    title: 'No ar agora',
    params: {
      'air_date.gte': daysAgo(30),
      sort_by: 'popularity.desc',
      'vote_count.gte': 100,
    },
  },
  {
    id: 'netflix',
    title: 'Disponível na Netflix',
    params: {
      with_watch_providers: 8,
      watch_region: 'BR',
      sort_by: 'popularity.desc',
      'vote_count.gte': 100,
    },
  },
  {
    id: 'classicas',
    title: 'Clássicas para maratonar',
    params: { 'first_air_date.lte': '2009-12-31', sort_by: 'vote_count.desc' },
  },
];

export interface HomeShelfConfig extends ShelfConfig {
  type: 'movie' | 'tv';
}

// estreia em sala: tipo 2 (limitada) e 3 (circuito), com data e região do Brasil
const ESTREIA_EM_SALA = { with_release_type: '2|3', region: 'BR' };

export const HOME_SHELVES: HomeShelfConfig[] = [
  {
    id: 'nos-cinemas',
    type: 'movie',
    title: 'Nos cinemas',
    params: {
      ...ESTREIA_EM_SALA,
      'primary_release_date.gte': daysAgo(45),
      'primary_release_date.lte': daysFromNow(0),
      sort_by: 'popularity.desc',
      // lançamento recente ainda tem pouca gente votando
      'vote_count.gte': 0,
    },
  },
  {
    id: 'em-breve',
    type: 'movie',
    title: 'Em breve nos cinemas',
    params: {
      ...ESTREIA_EM_SALA,
      'primary_release_date.gte': daysFromNow(1),
      'primary_release_date.lte': daysFromNow(120),
      sort_by: 'popularity.desc',
      'vote_count.gte': 0,
    },
  },
  {
    id: 'episodios-da-semana',
    type: 'tv',
    title: 'Com episódio novo esta semana',
    params: {
      'air_date.gte': daysAgo(7),
      'air_date.lte': daysFromNow(0),
      // sem talk show, jornalismo e reality: a fileira vinha cheia de programa diário
      without_genres: '10767,10763,10764',
      sort_by: 'popularity.desc',
      'vote_count.gte': 200,
    },
  },
];
