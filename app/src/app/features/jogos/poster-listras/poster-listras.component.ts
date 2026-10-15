import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { ESPECTRO } from '../../../core/models/espectro';

interface Nivel {
  // quantas faixas cabem na altura
  faixas: number;
  // quanto cada trecho da faixa se alonga
  alonga: number;
  // quanto a cor puxa para a tinta mais próxima da paleta
  tinta: number;
}

// uma por tentativa: as faixas afinam e a cor real volta; a última é o pôster nítido
const NIVEIS: (Nivel | null)[] = [
  { faixas: 22, alonga: 1.5, tinta: 0.6 },
  { faixas: 28, alonga: 1.4, tinta: 0.5 },
  { faixas: 36, alonga: 1.3, tinta: 0.4 },
  { faixas: 46, alonga: 1.2, tinta: 0.3 },
  { faixas: 60, alonga: 1.1, tinta: 0.2 },
  { faixas: 84, alonga: 1, tinta: 0.1 },
  null,
];
const NITIDO: Nivel = { faixas: 130, alonga: 1, tinta: 0 };

export const ROTULOS_DOS_NIVEIS = NIVEIS.map((n) => (n ? `${n.faixas} faixas` : 'nítido'));

// a mesma subida das faixas da logo espectral
const ANGULO = -0.21;
// o espectro e o #111 do corte
const TINTAS = [...ESPECTRO, '#111111'].map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));

const nivel = (i: number) => NIVEIS[i] ?? NITIDO;
const nitidez = (i: number) => (NIVEIS[i] ? 0 : 1);

// o pôster desenhado em listras inclinadas com as cores da marca; muda de nível sem salto
@Component({
  selector: 'app-poster-listras',
  standalone: true,
  templateUrl: './poster-listras.component.html',
  styleUrls: ['./poster-listras.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosterListrasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) src!: string;
  // 0 a 6, o mesmo índice da tentativa
  @Input() nivel = 0;
  // no card da escolha só cabe a parte de cima
  @Input() recorte: 'inteiro' | 'topo' = 'inteiro';

  @ViewChild('tela', { static: true }) private tela!: ElementRef<HTMLCanvasElement>;

  private readonly zona = inject(NgZone);
  private readonly imagem = new Image();
  private readonly amostra = document.createElement('canvas');
  private readonly miudo = document.createElement('canvas');
  private observador?: ResizeObserver;
  private atual = 0;
  private quadro = 0;
  private iniciado = false;

  ngAfterViewInit(): void {
    this.atual = this.nivel;
    this.imagem.crossOrigin = 'anonymous';
    this.imagem.onload = () => this.redesenhar();
    this.imagem.src = this.src;

    this.zona.runOutsideAngular(() => {
      this.observador = new ResizeObserver(() => this.redesenhar());
      this.observador.observe(this.tela.nativeElement);
    });
    this.iniciado = true;
  }

  ngOnChanges(): void {
    if (!this.iniciado) return;
    if (this.imagem.src !== this.src) {
      this.atual = this.nivel;
      this.imagem.src = this.src;
      return;
    }
    if (this.nivel !== this.atual) this.zona.runOutsideAngular(() => this.animarAte(this.nivel));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.quadro);
    this.observador?.disconnect();
  }

  private redesenhar(): void {
    if (!this.dimensionar()) return;
    this.pintar(nivel(this.atual), nitidez(this.atual));
  }

  private dimensionar(): boolean {
    const tela = this.tela.nativeElement;
    const { width, height } = tela.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (!w || !h) return false;
    if (tela.width !== w || tela.height !== h) {
      tela.width = w;
      tela.height = h;
    }
    return true;
  }

  private animarAte(alvo: number): void {
    cancelAnimationFrame(this.quadro);
    if (!this.imagem.complete || !this.dimensionar()) {
      this.atual = alvo;
      return;
    }
    const a = nivel(this.atual);
    const b = nivel(alvo);
    const na = nitidez(this.atual);
    const nb = nitidez(alvo);
    const inicio = performance.now();
    const duracao = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;

    const passo = (agora: number) => {
      const t = duracao ? Math.min(1, (agora - inicio) / duracao) : 1;
      const e = 1 - Math.pow(1 - t, 3);
      this.pintar(
        {
          faixas: a.faixas * Math.pow(b.faixas / a.faixas, e),
          alonga: a.alonga + (b.alonga - a.alonga) * e,
          tinta: a.tinta + (b.tinta - a.tinta) * e,
        },
        na + (nb - na) * e,
      );
      if (t < 1) this.quadro = requestAnimationFrame(passo);
      else this.atual = alvo;
    };
    this.quadro = requestAnimationFrame(passo);
  }

  // cada faixa é uma fileira inclinada de trechos com a cor média do pôster ali;
  // `nitido` (0 a 1) cobre com o pôster real
  private pintar(n: Nivel, nitido: number): void {
    const img = this.imagem;
    if (!img.complete || !img.naturalWidth) return;
    const tela = this.tela.nativeElement;
    const ctx = tela.getContext('2d');
    if (!ctx) return;

    const W = tela.width;
    const H = tela.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    // recorte do pôster com a proporção da tela; no topo, a partir de 8% da altura
    const sh = Math.min(ih, (iw * H) / W);
    const sw = (sh * W) / H;
    const sx = (iw - sw) / 2;
    const sy = this.recorte === 'topo' ? Math.min(ih - sh, ih * 0.08) : (ih - sh) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, W, H);

    if (nitido < 1) {
      const c = Math.abs(Math.cos(ANGULO));
      const s = Math.abs(Math.sin(ANGULO));
      const bw = W * c + H * s;
      const bh = W * s + H * c;
      const ch = H / n.faixas;
      const cw = ch * n.alonga;
      const gc = Math.ceil(bw / cw) + 1;
      const gr = Math.ceil(bh / ch) + 1;
      const S = 4;

      // pôster girado para o eixo das faixas, na escala da amostra
      const amostra = this.amostra;
      amostra.width = gc * S;
      amostra.height = gr * S;
      const a = amostra.getContext('2d')!;
      a.setTransform(S / cw, 0, 0, S / ch, amostra.width / 2, amostra.height / 2);
      a.rotate(-ANGULO);
      a.imageSmoothingEnabled = true;
      // ampliado por trás para os cantos não puxarem o fundo
      a.drawImage(img, sx, sy, sw, sh, -W * 0.9, -H * 0.9, W * 1.8, H * 1.8);
      a.drawImage(img, sx, sy, sw, sh, -W / 2, -H / 2, W, H);

      const miudo = this.miudo;
      miudo.width = gc;
      miudo.height = gr;
      const m = miudo.getContext('2d', { willReadFrequently: true })!;
      m.imageSmoothingEnabled = true;
      m.imageSmoothingQuality = 'high';
      m.drawImage(amostra, 0, 0, gc, gr);
      const dados = m.getImageData(0, 0, gc, gr);
      const d = dados.data;
      for (let k = 0; k < d.length; k += 4) {
        let melhor = TINTAS[0];
        let distancia = Infinity;
        for (const t of TINTAS) {
          const dr = d[k] - t[0];
          const dg = d[k + 1] - t[1];
          const db = d[k + 2] - t[2];
          const v = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
          if (v < distancia) {
            distancia = v;
            melhor = t;
          }
        }
        d[k] += (melhor[0] - d[k]) * n.tinta;
        d[k + 1] += (melhor[1] - d[k + 1]) * n.tinta;
        d[k + 2] += (melhor[2] - d[k + 2]) * n.tinta;
      }
      m.putImageData(dados, 0, 0);

      ctx.translate(W / 2, H / 2);
      ctx.rotate(ANGULO);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(miudo, (-gc * cw) / 2, (-gr * ch) / 2, gc * cw, gr * ch);
      // o corte #111 entre as faixas, como no stripes-backdrop
      if (ch > 7) {
        const lw = Math.max(1, ch * 0.07);
        for (let r = 0; r <= gr; r++) {
          ctx.fillRect((-gc * cw) / 2, (-gr * ch) / 2 + r * ch - lw / 2, gc * cw, lw);
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    if (nitido > 0) {
      ctx.globalAlpha = nitido;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    tela.classList.toggle('grao', nitido < 1);
  }
}
