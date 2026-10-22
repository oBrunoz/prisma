export type TipoJogo = 'FRAMES' | 'POSTER';
export type SituacaoPartida = 'PLAYING' | 'WON' | 'LOST';

export const TENTATIVAS = 7;
// palpite que só passa a vez
export const PULO = 0;

export interface RespostaDesafio {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
}

// o desafio do dia do jeito que a API devolve: só as imagens já liberadas
export interface Partida {
  id: string;
  kind: TipoJogo;
  number: number;
  day: string;
  attempts: number;
  images: string[];
  guesses: number[];
  status: SituacaoPartida;
  answer: RespostaDesafio | null;
}

export interface DesafiosDoDia {
  day: string;
  challenges: Partida[];
}

// um desafio antigo sorteado, fora do diário
export interface SorteioJogo {
  challenge: Partida;
  // a pessoa já tinha visto todos os antigos desse jogo
  repeated: boolean;
}

export interface EstatisticasJogo {
  played: number;
  won: number;
  currentStreak: number;
  bestStreak: number;
  // acertos por tentativa (1 a 7) e, na última posição, as derrotas
  distribution: number[];
}

// título de um palpite, para a lista sobreviver ao recarregar
export interface TituloPalpite {
  title: string;
  year: number | null;
}

export interface InfoJogo {
  tipo: TipoJogo;
  slug: string;
  nome: string;
  regra: string;
  acerto: (tentativa: number) => string;
}

export const JOGOS: InfoJogo[] = [
  {
    tipo: 'FRAMES',
    slug: 'frames',
    nome: 'Frames',
    regra: 'Sete cenas de um filme. Cada erro projeta mais uma.',
    acerto: (n) => `Acertou no ${n}º frame`,
  },
  {
    tipo: 'POSTER',
    slug: 'poster',
    nome: 'Pôster',
    regra: 'O pôster vem em listras, nas cores da marca. Cada erro afina as faixas.',
    acerto: (n) => `Acertou na ${n}ª tentativa`,
  },
];

export const jogoPorSlug = (slug: string | null) => JOGOS.find((j) => j.slug === slug) ?? null;
export const jogoPorTipo = (tipo: TipoJogo) => JOGOS.find((j) => j.tipo === tipo)!;
