export type TipoJogo =
  | 'FRAMES'
  | 'POSTER'
  | 'FICHA'
  | 'PERSONAGENS'
  | 'LETREIRO'
  | 'LEGENDA'
  | 'ASSINATURA'
  | 'CARREIRA'
  | 'DUELO'
  | 'LINHA';
export type SituacaoPartida = 'PLAYING' | 'WON' | 'LOST';

// como se joga: adivinhar o filme ou a pessoa pela busca, ou cada um com a sua mecânica
export type Mecanica = 'filme' | 'pessoa' | 'legenda' | 'duelo' | 'linha' | 'carreira';

export const TENTATIVAS = 7;
export const MAX_DICAS = 3;
// palpite que só passa a vez
export const PULO = 0;

export interface RespostaDesafio {
  type: 'MOVIE' | 'PERSON';
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
}

/* ---------- o que cada jogo mostra (content da API) ---------- */

export interface FilmeDoJogo {
  tmdbId: number;
  title: string;
  year: number;
  posterPath: string | null;
}

export type DicaVista =
  | { tipo: 'letra'; valor: string; posicao?: number }
  | { tipo: 'pista'; rotulo: string; valor: string };

export interface ConteudoComDicas {
  dicas: DicaVista[];
  podeDica: boolean;
  pistasRestantes: number;
  letrasRestantes: number;
}

export interface ConteudoFicha {
  pistas: { rotulo: string; valor: string | null }[];
}
export interface ConteudoPersonagens {
  personagens: { posicao: string; nome: string | null; ator: string | null }[];
}
export interface ConteudoAssinatura {
  filmes: { title: string | null; posterPath: string | null; year: number }[];
}
export interface ConteudoLetreiro extends ConteudoComDicas {
  // cada caractere do título; letra apagada vem vazia. nivel: tentativa em que acendeu, 7 = dica
  letras: { c: string; nivel: number | null }[];
}
export type CorDaLetra = 'certo' | 'lugar' | 'ausente';
export interface ConteudoLegenda extends ConteudoComDicas {
  tamanho: number;
  linhas: { letras: string[]; cores: CorDaLetra[] }[];
}
export interface FilmeDoDuelo extends FilmeDoJogo {
  // só depois da escolha
  nota: number | null;
}
export interface ConteudoDuelo {
  total: number;
  duelos: { a: FilmeDoDuelo; b: FilmeDoDuelo; escolhido: number | null; acertou: boolean | null }[];
}
export interface ConteudoLinha {
  total: number;
  linha: (FilmeDoJogo & { ok: boolean | null })[];
  resultados: boolean[];
  atual: { tmdbId: number; title: string; posterPath: string | null } | null;
}
export interface ConteudoCarreira {
  pessoa: { name: string; profilePath: string | null };
  ordem: { tmdbId: number; title: string; posterPath: string | null; year: number | null; travado: boolean }[];
  conferidas: boolean[][];
  gabarito: FilmeDoJogo[] | null;
}

// o desafio do dia do jeito que a API devolve: só o que já foi liberado
export interface Partida {
  id: string;
  kind: TipoJogo;
  number: number;
  day: string;
  attempts: number;
  images: string[];
  guesses: number[];
  words: string[];
  hints: string[];
  status: SituacaoPartida;
  // duelo e linha: quantos acertos
  score: number | null;
  content: unknown;
  answer: RespostaDesafio | null;
}

// o que vai para a API: a partida inteira, sempre
export interface Jogada {
  guesses: number[];
  words: string[];
  hints: string[];
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
  // acertos por tentativa (1 a 7) e, na última posição, as derrotas; duelo e linha, partidas por número de acertos (0 a 7)
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
  mecanica: Mecanica;
  // o complemento do título da página: "Ficha: adivinhe o filme pela ficha técnica"
  seo: string;
  // duelo e linha: o resultado é quantos acertou, não em que tentativa
  porPlacar?: boolean;
  // deslogado vê o card mas não joga; a API recusa a jogada (SO_COM_CONTA)
  soComConta?: boolean;
  acerto: (n: number) => string;
  comoJogar: { lead: string; itens: string[] };
}

const DICAS = 'Travou? <b>Dica</b> acende uma letra ou mostra uma pista (ano, direção, elenco). São até três e aparecem no resultado.';

export const JOGOS: InfoJogo[] = [
  {
    tipo: 'FRAMES',
    slug: 'frames',
    nome: 'Frames',
    mecanica: 'filme',
    seo: 'adivinhe o filme por sete cenas',
    regra: 'Sete cenas de um filme. Cada erro projeta mais uma.',
    acerto: (n) => `Acertou no ${n}º frame`,
    comoJogar: {
      lead: 'Adivinhe o filme do dia pelas cenas.',
      itens: [
        'A primeira cena é a mais difícil. Cada erro, ou pulo, <b>projeta mais uma</b>, até a sétima.',
        'Toque nas miniaturas para rever as cenas que já apareceram.',
        'Digite o nome do filme e escolha na lista.',
        '<b>Sete tentativas</b>. Pular conta como tentativa.',
      ],
    },
  },
  {
    tipo: 'POSTER',
    slug: 'poster',
    soComConta: true,
    nome: 'Pôster',
    mecanica: 'filme',
    seo: 'adivinhe o filme pelo pôster em listras',
    regra: 'O pôster vem em listras, nas cores da marca. Cada erro afina as faixas.',
    acerto: (n) => `Acertou na ${n}ª tentativa`,
    comoJogar: {
      lead: 'Adivinhe o filme pelo pôster, desenhado em listras.',
      itens: [
        'O pôster começa em faixas grossas, nas sete cores da marca.',
        'Cada erro, ou pulo, <b>afina as faixas e devolve a cor real</b>.',
        'Digite o nome do filme e escolha na lista.',
        '<b>Sete tentativas</b>. Pular conta como tentativa.',
      ],
    },
  },
  {
    tipo: 'FICHA',
    slug: 'ficha',
    nome: 'Ficha',
    mecanica: 'filme',
    seo: 'adivinhe o filme pela ficha técnica',
    regra: 'A ficha técnica de um filme, linha por linha. Cada erro destapa mais uma.',
    acerto: (n) => `Acertou na ${n}ª linha`,
    comoJogar: {
      lead: 'Adivinhe o filme pela ficha técnica.',
      itens: [
        'A ficha começa com uma linha só: ano e duração.',
        'Cada erro, ou pulo, <b>destapa a próxima linha</b>, da pista mais vaga à mais óbvia.',
        'Digite o nome do filme e escolha na lista.',
        '<b>Sete tentativas</b>. Pular conta como tentativa.',
      ],
    },
  },
  {
    tipo: 'PERSONAGENS',
    slug: 'personagens',
    nome: 'Personagens',
    mecanica: 'filme',
    seo: 'adivinhe o filme pelos personagens',
    regra: 'Sete personagens dos créditos, do fim da lista até o protagonista. Qual é o filme?',
    acerto: (n) => `Acertou no ${n}º personagem`,
    comoJogar: {
      lead: 'Adivinhe o filme pelos personagens dos créditos.',
      itens: [
        'Os personagens aparecem <b>do fim da lista de créditos até o protagonista</b>, um a cada tentativa.',
        'A posição nos créditos aparece desde o começo.',
        'Digite o nome do filme e escolha na lista.',
        '<b>Sete tentativas</b>. Pular conta como tentativa.',
      ],
    },
  },
  {
    tipo: 'LETREIRO',
    slug: 'letreiro',
    soComConta: true,
    nome: 'Letreiro',
    mecanica: 'filme',
    seo: 'adivinhe o filme pelo letreiro',
    regra: 'O título num letreiro de cinema, com as letras apagadas. Cada erro acende mais algumas.',
    acerto: (n) => `Acertou na ${n}ª tentativa`,
    comoJogar: {
      lead: 'Adivinhe o filme pelo título no letreiro, com as letras apagadas.',
      itens: [
        'No começo você só vê quantas palavras e letras o título tem.',
        'Cada erro, ou pulo, <b>acende mais algumas letras</b>. O fio embaixo diz em que tentativa ela acendeu.',
        'Digite o nome do filme e escolha na lista. <b>Sete tentativas</b>.',
        DICAS,
      ],
    },
  },
  {
    tipo: 'LEGENDA',
    slug: 'legenda',
    soComConta: true,
    nome: 'Legenda',
    mecanica: 'legenda',
    seo: 'descubra o título letra por letra',
    regra: 'Um título de filme de uma palavra, letra por letra. As cores dizem o que está certo.',
    acerto: (n) => `Acertou na ${n}ª palavra`,
    comoJogar: {
      lead: 'Descubra o título de um filme que tem uma palavra só.',
      itens: [
        'Digite qualquer palavra com <b>o mesmo número de letras</b> e aperte Enter.',
        'Ciano: a letra está no lugar certo. Laranja: está na palavra, em outro lugar. Escura: não está.',
        'Acento e cedilha não contam: ã vale a, ç vale c. <b>Sete tentativas</b>.',
        DICAS,
      ],
    },
  },
  {
    tipo: 'ASSINATURA',
    slug: 'assinatura',
    nome: 'Assinatura',
    mecanica: 'pessoa',
    seo: 'adivinhe quem dirigiu pela filmografia',
    regra: 'Sete filmes de uma carreira, do menos ao mais conhecido. Quem dirigiu?',
    acerto: (n) => `Acertou no ${n}º filme`,
    comoJogar: {
      lead: 'Adivinhe quem dirigiu estes filmes.',
      itens: [
        'A carreira aparece <b>do filme menos conhecido ao mais famoso</b>, um a cada tentativa.',
        'Os anos de todos os filmes aparecem desde o começo.',
        'Digite o nome do diretor ou da diretora e escolha na lista.',
        '<b>Sete tentativas</b>. Pular conta como tentativa.',
      ],
    },
  },
  {
    tipo: 'CARREIRA',
    slug: 'carreira',
    soComConta: true,
    nome: 'Carreira',
    mecanica: 'carreira',
    seo: 'ponha a filmografia em ordem',
    regra: 'Sete filmes de um diretor, fora de ordem. Ponha do primeiro ao mais recente.',
    acerto: (n) => `Em ordem na ${n}ª conferida`,
    comoJogar: {
      lead: 'Ponha a carreira em ordem, do primeiro filme ao mais recente.',
      itens: [
        'Use as setas para subir e descer cada filme.',
        'Quando achar que está certo, toque em <b>Conferir</b>. Cada conferida gasta um fio; são sete.',
        'O que já está no lugar <b>trava e mostra o ano</b>. O resto continua solto.',
        'Acerta quando os sete estiverem no lugar.',
      ],
    },
  },
  {
    tipo: 'DUELO',
    slug: 'duelo',
    nome: 'Duelo',
    mecanica: 'duelo',
    seo: 'qual filme tem a nota maior',
    regra: 'Sete duelos de pôster. Escolha o que tem a nota maior.',
    porPlacar: true,
    acerto: (n) => `${n} de 7 duelos`,
    comoJogar: {
      lead: 'Sete duelos de pôster. Escolha o filme com a nota maior.',
      itens: [
        'Toque no pôster que você acha mais bem avaliado na <b>TMDB</b>.',
        'A nota dos dois aparece depois da escolha. Não dá para voltar.',
        'Acertou, o fio do duelo acende. Errou, ele apaga.',
        'Os duelos ficam mais apertados até o sétimo. Acertar quatro já conta na sequência.',
      ],
    },
  },
  {
    tipo: 'LINHA',
    slug: 'linha-do-tempo',
    soComConta: true,
    nome: 'Linha do tempo',
    mecanica: 'linha',
    seo: 'encaixe os filmes na linha do tempo',
    regra: 'Sete filmes, um por vez. Encaixe cada um no lugar certo da linha.',
    porPlacar: true,
    acerto: (n) => `${n} de 7 no lugar`,
    comoJogar: {
      lead: 'Encaixe cada filme no lugar certo da linha do tempo.',
      itens: [
        'A linha começa com um filme e o ano dele.',
        'Os outros sete chegam <b>um por vez</b>. Toque na vaga onde ele entra e em <b>Encaixar</b>.',
        'Errou, o filme vai para o lugar certo com o ponto coral, e você segue.',
        'Acertar quatro já conta na sequência.',
      ],
    },
  },
];

export const jogoPorSlug = (slug: string | null) => JOGOS.find((j) => j.slug === slug) ?? null;
export const jogoPorTipo = (tipo: TipoJogo) => JOGOS.find((j) => j.tipo === tipo)!;
export const soComConta = (tipo: TipoJogo) => !!jogoPorTipo(tipo).soComConta;

// quantas tentativas a partida já usou (a carreira conta conferidas)
export function tentativasUsadas(p: Partida): number {
  if (p.kind === 'LEGENDA') return p.words.length;
  if (p.kind === 'CARREIRA') return Math.ceil(p.guesses.length / 7);
  return p.guesses.length;
}
