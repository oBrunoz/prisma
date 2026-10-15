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
  signal,
} from '@angular/core';
import { PosterListrasComponent } from '../poster-listras/poster-listras.component';

interface Vaga {
  src: string | null;
  // 0 listras grossas, 6 pôster nítido (os níveis do app-poster-listras)
  nivel: number;
  aberta: boolean;
}

const TOTAL = 30;
const NITIDO = 6;
// a cortina que abre a vaga e a passagem das listras ao pôster
const CORTINA = 900;
const REVELA = 1600;
// cada vaga animando redesenha o canvas inteiro a cada quadro: poucas por vez, a 30 quadros
const INTERVALO = 1100;
const MAX_ANIMANDO = 3;
const FPS = 30;
// logo depois de rolar, nenhuma vaga nova começa: é quando um engasgo mais aparece
const FOLGA_DA_ROLAGEM = 400;
// a estante não passa disso cheia: daí em diante um filme dá lugar a outro
const CHEIA = 0.7;
const INICIAL = 0.5;

// a grade do perfil em perspectiva: as vagas se enchem de pôsteres que surgem em listras
@Component({
  selector: 'app-estante-listras',
  standalone: true,
  imports: [PosterListrasComponent],
  templateUrl: './estante-listras.component.html',
  styleUrls: ['./estante-listras.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstanteListrasComponent implements AfterViewInit, OnChanges, OnDestroy {
  // URLs completas dos pôsteres
  @Input() posters: string[] = [];

  @ViewChild('grade', { static: true }) private grade!: ElementRef<HTMLElement>;

  readonly nitido = NITIDO;
  readonly revela = REVELA;
  readonly fps = FPS;
  readonly vagas = signal<Vaga[]>(Array.from({ length: TOTAL }, () => ({ src: null, nivel: 0, aberta: false })));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zona = inject(NgZone);
  // anima só em tela grande de aparelho capaz; no resto (e com movimento reduzido) aparece cheia e parada.
  // no celular ela fica atrás do texto, sob o véu: a animação mal apareceria e custaria caro
  private readonly parada =
    matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(min-width: 1024px)').matches || aparelhoModesto();
  private rolouEm = 0;
  private readonly aoRolar = () => (this.rolouEm = performance.now());
  private readonly ocupadas = new Set<number>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private observador?: IntersectionObserver;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private naTela = false;
  private montada = false;

  ngAfterViewInit(): void {
    this.zona.runOutsideAngular(() => {
      // avisa de novo com um terço à vista: só encostando na tela, ainda não há vaga visível para montar
      this.observador = new IntersectionObserver(
        ([e]) => {
          this.naTela = e.isIntersecting;
          this.acompanhar();
        },
        { threshold: [0, 0.35] },
      );
      this.observador.observe(this.host.nativeElement);
      addEventListener('scroll', this.aoRolar, { passive: true });
    });
  }

  ngOnChanges(): void {
    this.zona.runOutsideAngular(() => this.acompanhar());
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    removeEventListener('scroll', this.aoRolar);
    this.parar();
    this.timers.forEach(clearTimeout);
  }

  // monta a estante na primeira vez que aparece e só anima com ela na tela
  private acompanhar(): void {
    if (!this.naTela || !this.posters.length) {
      this.parar();
      return;
    }
    if (!this.montada) this.montar();
    if (!this.parada && !this.relogio) this.relogio = setInterval(() => this.passo(), INTERVALO);
  }

  private parar(): void {
    if (this.relogio) clearInterval(this.relogio);
    this.relogio = null;
  }

  // alguns filmes já na estante, para a seção não abrir vazia
  private montar(): void {
    const visiveis = this.visiveis();
    if (!visiveis.length) return;
    this.montada = true;
    const escolhidas = embaralhar(visiveis).slice(0, Math.ceil(visiveis.length * (this.parada ? CHEIA : INICIAL)));
    for (const i of escolhidas) this.alterar(i, { src: this.sortear(), nivel: NITIDO, aberta: true });
  }

  private passo(): void {
    if (!this.montada) return this.montar();
    if (this.ocupadas.size >= MAX_ANIMANDO || performance.now() - this.rolouEm < FOLGA_DA_ROLAGEM) return;
    const visiveis = this.visiveis();
    const vagas = this.vagas();
    const livres = visiveis.filter((i) => !this.ocupadas.has(i));
    if (!livres.length) return;
    const cheias = visiveis.filter((i) => vagas[i].src).length / visiveis.length;
    const vazias = livres.filter((i) => !vagas[i].src);
    const candidatas = cheias < CHEIA && vazias.length ? vazias : livres.filter((i) => vagas[i].src);
    if (candidatas.length) this.encher(candidatas[Math.floor(Math.random() * candidatas.length)]);
  }

  // vaga cheia volta às listras e fecha; depois a cortina abre outro filme em listras, que afinam até o pôster
  private async encher(i: number): Promise<void> {
    this.ocupadas.add(i);
    if (this.vagas()[i].src) {
      this.alterar(i, { nivel: 0 });
      await this.esperar(REVELA);
      this.alterar(i, { aberta: false });
      await this.esperar(CORTINA);
      this.alterar(i, { src: null });
    }
    this.alterar(i, { src: this.sortear(), nivel: 0, aberta: false });
    await this.esperar(60);
    this.alterar(i, { aberta: true });
    await this.esperar(CORTINA + 300);
    this.alterar(i, { nivel: NITIDO });
    await this.esperar(REVELA);
    this.ocupadas.delete(i);
  }

  // as vagas inteiras na largura, à direita do texto, com o centro longe do véu de cima e de baixo
  private visiveis(): number[] {
    const r = this.host.nativeElement.getBoundingClientRect();
    const filhos = Array.from(this.grade.nativeElement.children);
    return filhos.flatMap((el, i) => {
      const b = el.getBoundingClientRect();
      const meio = b.top + b.height / 2;
      const dentro =
        b.left > r.left + r.width * 0.4 &&
        b.right < r.right &&
        meio > r.top + r.height * 0.12 &&
        meio < r.bottom - r.height * 0.12;
      return dentro ? [i] : [];
    });
  }

  private sortear(): string {
    const naEstante = new Set(this.vagas().map((v) => v.src));
    const livres = this.posters.filter((p) => !naEstante.has(p));
    const lista = livres.length ? livres : this.posters;
    return lista[Math.floor(Math.random() * lista.length)];
  }

  private alterar(i: number, mudanca: Partial<Vaga>): void {
    this.vagas.update((vagas) => vagas.map((v, j) => (j === i ? { ...v, ...mudanca } : v)));
  }

  // timers somem com o componente; a sequência simplesmente não continua
  private esperar(ms: number): Promise<void> {
    return new Promise((ok) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        ok();
      }, ms);
      this.timers.add(t);
    });
  }
}

// poucos núcleos, pouca memória ou economia de dados ligada (deviceMemory e saveData só existem no Chromium)
function aparelhoModesto(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || !!nav.connection?.saveData;
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
