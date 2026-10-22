import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { ESPECTRO } from '../../../core/models/espectro';
import { CAIXILHO, CENAS, VarianteTravessia, folhaD, vaoDaJanela } from './travessia.geometria';

// quanto a câmera se aproxima: o vão passa das bordas e a paisagem fica inteira
const APROXIMACAO = 12;

let seq = 0;
// a entrada completa só na primeira vez da sessão; depois a cena já abre do outro lado
const jaAtravessou = new Set<VarianteTravessia>();

// espera, a folha abrindo e a câmera atravessando, em ms; a abertura da página inteira é mais curta
const TEMPOS: Record<VarianteTravessia, [number, number, number]> = {
  painel: [300, 1000, 1600],
  tela: [200, 750, 1150],
};

const vaiEVolta =(t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// a folha abre, a câmera atravessa a janela e as listras viram o fundo
@Component({
  selector: 'app-travessia',
  standalone: true,
  templateUrl: './travessia.component.html',
  styleUrls: ['./travessia.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravessiaComponent implements AfterViewInit, OnDestroy {
  // painel: lado da arte no login e no cadastro; tela: a página inteira, para uma abertura
  @Input() variante: VarianteTravessia = 'painel';
  @Output() atravessou = new EventEmitter<void>();

  @ViewChild('vao') private vao!: ElementRef<SVGRectElement>;
  @ViewChild('janela') private janela!: ElementRef<SVGGElement>;
  @ViewChild('folha') private folha!: ElementRef<SVGGElement>;

  private readonly zona = inject(NgZone);
  private quadro = 0;
  private destruido = false;
  private pulou = false;

  protected readonly uid = `travessia-${++seq}`;
  protected readonly cores = ESPECTRO;
  protected readonly caixilho = CAIXILHO;

  protected get cena() {
    return CENAS[this.variante];
  }

  protected get viewBox(): string {
    return `0 0 ${this.cena.largura} ${this.cena.altura}`;
  }

  // sete listras paralelas do mesmo traçado
  protected deslocamento(indice: number): string {
    return `translate(0 ${(indice - 3) * 30})`;
  }

  ngAfterViewInit(): void {
    const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (semMovimento || jaAtravessou.has(this.variante)) {
      this.aplicar(APROXIMACAO, 1);
      this.atravessou.emit();
      return;
    }

    this.aplicar(1, 0);
    this.zona.runOutsideAngular(() => void this.tocar());
  }

  ngOnDestroy(): void {
    this.destruido = true;
    cancelAnimationFrame(this.quadro);
  }

  // corta a entrada e já mostra a cena do outro lado
  pular(): void {
    if (this.pulou || jaAtravessou.has(this.variante)) return;
    this.pulou = true;
    cancelAnimationFrame(this.quadro);
    this.aplicar(APROXIMACAO, 1);
    jaAtravessou.add(this.variante);
    this.atravessou.emit();
  }

  private async tocar(): Promise<void> {
    const [espera, abrir, atravessar] = TEMPOS[this.variante];
    await this.esperar(espera);
    await this.animar(abrir, (e) => this.aplicar(1, e));
    await this.animar(atravessar, (e) => this.aplicar(1 + (APROXIMACAO - 1) * e, 1));
    if (this.destruido || this.pulou) return;

    jaAtravessou.add(this.variante);
    this.zona.run(() => this.atravessou.emit());
  }

  // k aproxima a câmera do centro do vão; o recorte das listras cresce junto com a janela
  private aplicar(k: number, abertura: number): void {
    const { tx, ty, s } = this.cena.janela;
    const { x0, x1, y0, y1, cx, cy } = vaoDaJanela(this.cena.janela);
    const vao = this.vao.nativeElement;

    this.janela.nativeElement.setAttribute(
      'transform',
      `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy}) translate(${tx} ${ty}) scale(${s})`,
    );
    vao.setAttribute('x', String(cx - ((x1 - x0) * k) / 2));
    vao.setAttribute('y', String(cy - ((y1 - y0) * k) / 2));
    vao.setAttribute('width', String((x1 - x0) * k));
    vao.setAttribute('height', String((y1 - y0) * k));

    const quadros = this.folha.nativeElement.children;
    folhaD(abertura).forEach((d, n) => quadros[n].setAttribute('d', d));
  }

  private animar(duracao: number, passo: (e: number) => void): Promise<void> {
    return new Promise((pronto) => {
      const inicio = performance.now();
      const quadro = (agora: number) => {
        if (this.destruido || this.pulou) return pronto();
        const t = Math.min(1, (agora - inicio) / duracao);
        passo(vaiEVolta(t));
        if (t < 1) this.quadro = requestAnimationFrame(quadro);
        else pronto();
      };
      this.quadro = requestAnimationFrame(quadro);
    });
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((pronto) => setTimeout(pronto, ms));
  }
}
