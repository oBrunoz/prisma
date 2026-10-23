import { ordemDoLetreiro, sorteador } from './construtores.js';
import {
  avaliarPalavra,
  conteudo,
  DadosCarreira,
  DadosDuelo,
  DadosLegenda,
  DadosLetreiro,
  DadosLinha,
  DesafioDoJogo,
  JogadaInvalida,
  normalizarJogada,
  placar,
  posicaoNaDistribuicao,
  resposta,
  situacaoDaJogada,
} from './games.regras.js';

const filme = (tmdbId: number, year: number) => ({
  tmdbId,
  title: `F${tmdbId}`,
  year,
  posterPath: null,
});
const media = {
  tmdbId: 9377,
  title: 'Curtindo a Vida Adoidado',
  posterPath: '/p.jpg',
  releaseDate: new Date('1986-06-11'),
};
const pistas = [
  { rotulo: 'Ano e gênero', valor: '1986 · Comédia' },
  { rotulo: 'Direção', valor: 'John Hughes' },
  { rotulo: 'Elenco', valor: 'Matthew Broderick' },
];

const letreiro: DesafioDoJogo = {
  kind: 'LETREIRO',
  images: [],
  media,
  data: {
    titulo: 'CURTINDO A VIDA ADOIDADO',
    ...ordemDoLetreiro('CURTINDO A VIDA ADOIDADO'),
    pistas,
  } satisfies DadosLetreiro,
};

const legenda: DesafioDoJogo = {
  kind: 'LEGENDA',
  images: [],
  media: { ...media, tmdbId: 578, title: 'Tubarão' },
  data: {
    palavra: 'tubarao',
    exibe: [...'TUBARÃO'],
    pistas,
  } satisfies DadosLegenda,
};

describe('regras dos jogos', () => {
  describe('jogos de adivinhar o filme', () => {
    it('corta o que vem depois do acerto e passa do sete', () => {
      const ficha: DesafioDoJogo = {
        kind: 'FICHA',
        images: [],
        media,
        data: { pistas: [] },
      };
      expect(
        normalizarJogada(ficha, { guesses: [1, 9377, 2] }).guesses,
      ).toEqual([1, 9377]);
      expect(
        normalizarJogada(ficha, { guesses: [1, 2, 3, 4, 5, 6, 7, 8] }).guesses,
      ).toHaveLength(7);
      expect(
        situacaoDaJogada(ficha, { guesses: [1, 9377], words: [], hints: [] }),
      ).toBe('WON');
    });

    it('na assinatura a resposta é a pessoa', () => {
      const d: DesafioDoJogo = {
        kind: 'ASSINATURA',
        images: [],
        media: null,
        data: {
          pessoa: { tmdbId: 21684, name: 'Bong Joon-ho', profilePath: null },
          filmes: [],
        },
      };
      const j = normalizarJogada(d, { guesses: [525, 21684] });
      expect(situacaoDaJogada(d, j)).toBe('WON');
      expect(resposta(d, true)).toMatchObject({
        type: 'PERSON',
        title: 'Bong Joon-ho',
      });
    });
  });

  describe('letreiro', () => {
    it('acende as consoantes raras primeiro e deixa um quinto apagado no fim', () => {
      const { ordem, abertas } = ordemDoLetreiro('CURTINDO A VIDA ADOIDADO');
      expect(ordem.slice(0, 2)).toEqual(['C', 'N']);
      expect(ordem.at(-1)).toMatch(/[AO]/);
      expect(abertas[0]).toBe(0);
      expect(abertas[6]).toBeLessThan(ordem.length);
    });

    it('resolve a dica de letra com a apagada que mais aparece (D, cinco vezes)', () => {
      const j = normalizarJogada(letreiro, {
        guesses: [1],
        hints: ['letra', 'pista'],
      });
      expect(j.hints[0]).toBe('letra:D');
      const c = conteudo(letreiro, j, false) as { dicas: { tipo: string }[] };
      expect(c.dicas.map((d) => d.tipo)).toEqual(['letra', 'pista']);
    });

    it('mantém a letra já resolvida e recusa a quarta dica', () => {
      expect(
        normalizarJogada(letreiro, { guesses: [], hints: ['letra:D'] }).hints,
      ).toEqual(['letra:D']);
      expect(
        normalizarJogada(letreiro, {
          hints: ['pista', 'pista', 'pista', 'pista'],
        }).hints,
      ).toHaveLength(3);
      expect(() => normalizarJogada(letreiro, { hints: ['letra:Z'] })).toThrow(
        JogadaInvalida,
      );
    });

    it('esconde as letras apagadas e mostra todas no fim', () => {
      const tela = conteudo(
        letreiro,
        { guesses: [], words: [], hints: [] },
        false,
      ) as { letras: { c: string }[] };
      expect(tela.letras.filter((l) => l.c && l.c !== ' ')).toHaveLength(0);
      const fim = conteudo(
        letreiro,
        { guesses: [1, 2, 3, 4, 5, 6, 7], words: [], hints: [] },
        true,
      ) as { letras: { c: string }[] };
      expect(fim.letras.map((l) => l.c).join('')).toBe(
        'CURTINDO A VIDA ADOIDADO',
      );
    });
  });

  describe('legenda', () => {
    it('pinta como o termo: letra repetida conta uma vez', () => {
      expect(avaliarPalavra('cabrito', 'tubarao')).toEqual([
        'ausente',
        'lugar',
        'certo',
        'lugar',
        'ausente',
        'lugar',
        'certo',
      ]);
      expect(avaliarPalavra('aaaaaaa', 'tubarao')).toEqual([
        'ausente',
        'ausente',
        'ausente',
        'certo',
        'ausente',
        'certo',
        'ausente',
      ]);
    });

    it('aceita palavra da lista ou o próprio título, sem acento', () => {
      const aceita = (p: string) => p === 'cabrito';
      const j = normalizarJogada(
        legenda,
        { words: ['Cabrito', 'TUBARÃO', 'cabrito'] },
        aceita,
      );
      expect(j.words).toEqual(['cabrito', 'tubarao']);
      expect(situacaoDaJogada(legenda, j)).toBe('WON');
      expect(() =>
        normalizarJogada(legenda, { words: ['xxxxxxx'] }, aceita),
      ).toThrow('não está na lista');
      expect(() =>
        normalizarJogada(legenda, { words: ['casa'] }, aceita),
      ).toThrow('7 letras');
    });

    it('a dica de letra mostra a primeira casa que ainda não se sabe', () => {
      const j = normalizarJogada(
        legenda,
        { words: ['tubaxxx'], hints: ['letra'] },
        () => true,
      );
      expect(j.hints).toEqual(['letra:4']);
      const c = conteudo(legenda, j, false) as {
        dicas: { valor: string; posicao: number }[];
      };
      expect(c.dicas[0]).toMatchObject({ valor: 'R', posicao: 4 });
    });

    it('a casa certa aparece com acento', () => {
      const c = conteudo(
        legenda,
        { guesses: [], words: ['tubarao'], hints: [] },
        true,
      ) as { linhas: { letras: string[] }[] };
      expect(c.linhas[0].letras.join('')).toBe('TUBARÃO');
    });
  });

  describe('duelo', () => {
    const duelo: DesafioDoJogo = {
      kind: 'DUELO',
      images: [],
      media: null,
      data: {
        duelos: Array.from({ length: 7 }, (_, i) => [
          { ...filme(i * 2 + 1, 2000), nota: 8 },
          { ...filme(i * 2 + 2, 2000), nota: 7 },
        ]),
      } satisfies DadosDuelo,
    };

    it('só aceita um dos dois do duelo', () => {
      expect(() => normalizarJogada(duelo, { guesses: [5] })).toThrow(
        JogadaInvalida,
      );
    });

    it('vence com a maioria e esconde a nota do duelo da vez', () => {
      const j = normalizarJogada(duelo, { guesses: [1, 3, 5, 7, 10, 12, 14] });
      expect(placar(duelo, j)).toBe(4);
      expect(situacaoDaJogada(duelo, j)).toBe('WON');
      expect(posicaoNaDistribuicao(duelo, j, true)).toBe(4);
      const meio = conteudo(
        duelo,
        { guesses: [1], words: [], hints: [] },
        false,
      ) as {
        duelos: { a: { nota: number | null } }[];
      };
      expect(meio.duelos).toHaveLength(2);
      expect(meio.duelos[0].a.nota).toBe(8);
      expect(meio.duelos[1].a.nota).toBeNull();
    });
  });

  describe('linha do tempo', () => {
    const linha: DesafioDoJogo = {
      kind: 'LINHA',
      images: [],
      media: null,
      data: {
        ancora: filme(1, 1997),
        cartas: [
          filme(2, 1999),
          filme(3, 1972),
          filme(4, 2019),
          filme(5, 1993),
          filme(6, 2002),
          filme(7, 1975),
          filme(8, 2014),
        ],
      } satisfies DadosLinha,
    };

    it('a carta errada vai para o lugar certo', () => {
      // Matrix depois de Titanic (certo); Chefão depois de tudo (errado)
      const j = normalizarJogada(linha, { guesses: [1, 2] });
      const c = conteudo(linha, j, false) as {
        linha: { tmdbId: number; ok: boolean | null }[];
        atual: { tmdbId: number };
      };
      expect(c.linha.map((f) => f.tmdbId)).toEqual([3, 1, 2]);
      expect(c.linha[0].ok).toBe(false);
      expect(c.atual.tmdbId).toBe(4);
    });

    it('recusa vaga fora da linha', () => {
      expect(() => normalizarJogada(linha, { guesses: [2] })).toThrow(
        JogadaInvalida,
      );
    });
  });

  describe('carreira', () => {
    const certos = [
      filme(10, 2000),
      filme(20, 2002),
      filme(30, 2006),
      filme(40, 2010),
      filme(50, 2014),
      filme(60, 2017),
      filme(70, 2020),
    ];
    const carreira: DesafioDoJogo = {
      kind: 'CARREIRA',
      images: [],
      media: null,
      data: {
        pessoa: { tmdbId: 525, name: 'Christopher Nolan', profilePath: null },
        filmes: certos,
        inicial: [50, 10, 70, 30, 60, 20, 40],
      } satisfies DadosCarreira,
    };

    it('trava o que está no lugar e não deixa sair', () => {
      const primeira = [10, 50, 70, 30, 60, 20, 40];
      const j = normalizarJogada(carreira, { guesses: primeira });
      const c = conteudo(carreira, j, false) as {
        ordem: { tmdbId: number; travado: boolean; year: number | null }[];
      };
      expect(c.ordem.filter((f) => f.travado).map((f) => f.tmdbId)).toEqual([
        10,
      ]);
      expect(c.ordem[0].year).toBe(2000);
      expect(c.ordem[1].year).toBeNull();
      expect(() =>
        normalizarJogada(carreira, {
          guesses: [...primeira, 50, 10, 70, 30, 60, 20, 40],
        }),
      ).toThrow('travado');
    });

    it('vence quando a ordem fecha e para de contar ali', () => {
      const ordem = certos.map((f) => f.tmdbId);
      const j = normalizarJogada(carreira, {
        guesses: [10, 50, 70, 30, 60, 20, 40, ...ordem, ...ordem],
      });
      expect(j.guesses).toHaveLength(14);
      expect(situacaoDaJogada(carreira, j)).toBe('WON');
      expect(posicaoNaDistribuicao(carreira, j, true)).toBe(1);
    });

    it('recusa ordem incompleta', () => {
      expect(() =>
        normalizarJogada(carreira, { guesses: [10, 20, 30] }),
      ).toThrow(JogadaInvalida);
    });
  });

  it('o sorteio do dia é sempre o mesmo', () => {
    const a = sorteador('2026-10-24').embaralhar([1, 2, 3, 4, 5, 6, 7]);
    const b = sorteador('2026-10-24').embaralhar([1, 2, 3, 4, 5, 6, 7]);
    expect(a).toEqual(b);
  });
});
