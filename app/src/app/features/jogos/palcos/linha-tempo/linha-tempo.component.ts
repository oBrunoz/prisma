import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { ConteudoLinha } from '../../../../core/models/jogos.models';
import { ESPECTRO } from '../../../../core/models/espectro';

// a linha do tempo: a carta da vez em cima e a linha embaixo, com uma vaga entre cada filme
@Component({
  selector: 'app-linha-tempo',
  standalone: true,
  templateUrl: './linha-tempo.component.html',
  styleUrls: ['./linha-tempo.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinhaTempoComponent implements OnChanges, AfterViewChecked {
  @Input({ required: true }) conteudo!: ConteudoLinha;
  @Input() ocupado = false;

  @Output() encaixar = new EventEmitter<number>();

  @ViewChild('trilho') private trilho?: ElementRef<HTMLElement>;

  readonly imagens = environment.tmdbImageUrl;
  readonly vaga = signal<number | null>(null);
  readonly nova = signal<number | null>(null);
  readonly tremendo = signal(false);
  private readonly dados = signal<ConteudoLinha | null>(null);
  // depois de desenhar, rola até a vaga escolhida ou a carta que acabou de entrar
  private rolarPara: string | null = null;

  readonly acertos = computed(() => this.dados()?.resultados.filter(Boolean).length ?? 0);
  readonly fios = computed(() => {
    const r = this.dados()?.resultados ?? [];
    return ESPECTRO.map((cor, i) => ({
      cor,
      estado: i < r.length ? (r[i] ? 'ok' : 'erro') : i === r.length && this.dados()?.atual ? 'atual' : '',
    }));
  });

  ngOnChanges(mudou: SimpleChanges): void {
    const antes = mudou['conteudo']?.previousValue as ConteudoLinha | undefined;
    this.dados.set(this.conteudo);
    if (antes && this.conteudo.linha.length > antes.linha.length) {
      const ids = new Set(antes.linha.map((f) => f.tmdbId));
      const entrou = this.conteudo.linha.find((f) => !ids.has(f.tmdbId));
      this.nova.set(entrou?.tmdbId ?? null);
      this.vaga.set(null);
      if (entrou) this.rolarPara = `[data-filme="${entrou.tmdbId}"]`;
      if (entrou?.ok === false) {
        this.tremendo.set(false);
        requestAnimationFrame(() => this.tremendo.set(true));
      }
    }
  }

  ngAfterViewChecked(): void {
    if (!this.rolarPara || !this.trilho) return;
    const trilho = this.trilho.nativeElement;
    const alvo = trilho.querySelector<HTMLElement>(this.rolarPara);
    this.rolarPara = null;
    if (!alvo) return;
    // rola só a fileira: scrollIntoView arrastaria junto a página, que tem overflow escondido
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const meio = alvo.offsetLeft + alvo.offsetWidth / 2 - trilho.clientWidth / 2;
    trilho.scrollTo({ left: Math.max(0, meio), behavior: reduzido ? 'auto' : 'smooth' });
  }

  escolher(i: number): void {
    if (!this.conteudo.atual) return;
    this.vaga.set(this.vaga() === i ? null : i);
    if (this.vaga() !== null) this.rolarPara = `[data-vaga="${i}"]`;
  }

  confirmar(): void {
    const v = this.vaga();
    if (v === null || this.ocupado || !this.conteudo.atual) return;
    this.encaixar.emit(v);
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    const alvo = evento.target as HTMLElement | null;
    if (!this.conteudo.atual || alvo?.closest('input, textarea, [role="dialog"]')) return;
    const max = this.conteudo.linha.length;
    if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
      evento.preventDefault();
      const passo = evento.key === 'ArrowRight' ? 1 : -1;
      const atual = this.vaga();
      const i = atual === null ? Math.floor(max / 2) + (passo > 0 ? 1 : 0) : Math.min(max, Math.max(0, atual + passo));
      this.vaga.set(i);
      this.rolarPara = `[data-vaga="${i}"]`;
    } else if (evento.key === 'Enter' && this.vaga() !== null && !alvo?.closest('button, a')) {
      evento.preventDefault();
      this.confirmar();
    }
  }
}
