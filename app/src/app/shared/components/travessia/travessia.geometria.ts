// janela em coordenadas do Figma (viewBox 18 18 168 231), a mesma do app-logo
export const CAIXILHO = [
  'M18 53H120V63H29V212H119V224H18V53Z',
  'M29 61L114 67V69L29 63V61Z',
  'M29 213L113 206V208L29 216V213Z',
];

type Ponto = [number, number];

const QUADROS: [Ponto[], Ponto[]][] = [
  [[[116, 57], [186, 18], [186, 249], [116, 216]], [[123, 62], [179, 30], [179, 238], [123, 211]]],
  [[[125, 65], [176, 36], [176, 233], [125, 208]], [[127, 66], [174, 40], [174, 229], [127, 207]]],
];

function pontoDaFolha([x, y]: Ponto, abertura: number): Ponto {
  const f = (x - 116) / 70;
  const topo = 57 + (18 - 57) * f;
  const base = 216 + (249 - 216) * f;
  const v = (y - topo) / (base - topo);
  const fechado: Ponto = [116 - 87 * f, 57 + v * (216 - 57)];
  return [fechado[0] + (x - fechado[0]) * abertura, fechado[1] + (y - fechado[1]) * abertura];
}

const quadro = (pontos: Ponto[], abertura: number) =>
  'M' + pontos.map((p) => pontoDaFolha(p, abertura).map((n) => n.toFixed(2)).join(' ')).join('L') + 'Z';

export function folhaD(abertura: number): string[] {
  return QUADROS.map(([fora, dentro]) => quadro(fora, abertura) + quadro(dentro, abertura));
}

export interface Cena {
  largura: number;
  altura: number;
  curva: string;
  janela: { tx: number; ty: number; s: number };
}

export type VarianteTravessia = 'painel' | 'tela';

export const CENAS: Record<VarianteTravessia, Cena> = {
  painel: {
    largura: 600,
    altura: 700,
    curva: 'M -60 560 C 150 560, 220 260, 360 260 S 520 110, 700 90',
    janela: { tx: 150, ty: 120, s: 1.35 },
  },
  tela: {
    largura: 1200,
    altura: 700,
    curva: 'M -60 560 C 250 560, 380 260, 620 260 S 960 110, 1260 90',
    janela: { tx: 447, ty: 144.5, s: 1.5 },
  },
};

export function vaoDaJanela({ tx, ty, s }: Cena['janela']) {
  const x0 = tx + 29 * s;
  const x1 = tx + 116 * s;
  const y0 = ty + 63 * s;
  const y1 = ty + 212 * s;
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
