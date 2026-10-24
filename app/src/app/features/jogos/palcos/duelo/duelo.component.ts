import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { LucideArrowRight, LucideStar } from '@lucide/angular';
import { environment } from '../../../../../environments/environment';
import { ConteudoDuelo, FilmeDoDuelo } from '../../../../core/models/jogos.models';
import { ESPECTRO } from '../../../../core/models/espectro';

@Component({
  selector: 'app-duelo',
  standalone: true,
  imports: [LucideArrowRight, LucideStar],
  templateUrl: './duelo.component.html',
  styleUrls: ['./duelo.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DueloComponent implements OnChanges {
  @Input({ required: true }) conteudo!: ConteudoDuelo;
  @Input() ocupado = false;

  @Output() escolher = new EventEmitter<number>();

  readonly imagens = environment.tmdbImageUrl;
  readonly espectro = ESPECTRO;
  readonly vendo = signal(0);
  readonly tremendo = signal(false);
  private readonly dados = signal<ConteudoDuelo | null>(null);

  readonly duelo = computed(() => this.dados()?.duelos[this.vendo()] ?? null);
  readonly escolhidos = computed(() => this.dados()?.duelos.filter((d) => d.escolhido !== null).length ?? 0);
  readonly temProximo = computed(() => {
    const d = this.duelo();
    return !!d && d.escolhido !== null && this.vendo() < (this.dados()?.duelos.length ?? 0) - 1;
  });
  readonly maior = computed(() => {
    const d = this.duelo();
    if (!d || d.a.nota === null || d.b.nota === null) return null;
    return d.a.nota >= d.b.nota ? d.a.tmdbId : d.b.tmdbId;
  });

  readonly fios = computed(() => {
    const duelos = this.dados()?.duelos ?? [];
    return this.espectro.map((cor, i) => {
      const d = duelos[i];
      return {
        cor,
        estado: !d || d.acertou === null ? (i === this.vendo() ? 'atual' : '') : d.acertou ? 'ok' : 'erro',
      };
    });
  });

  ngOnChanges(mudou: SimpleChanges): void {
    const antes = mudou['conteudo']?.previousValue as ConteudoDuelo | undefined;
    this.dados.set(this.conteudo);
    const duelos = this.conteudo.duelos;
    const feitos = duelos.filter((d) => d.escolhido !== null).length;
    if (!antes) {
      this.vendo.set(Math.min(feitos, duelos.length - 1));
      return;
    }
    const feitosAntes = antes.duelos.filter((d) => d.escolhido !== null).length;
    if (feitos > feitosAntes) {
      this.vendo.set(feitos - 1);
      if (duelos[feitos - 1].acertou === false) {
        this.tremendo.set(false);
        requestAnimationFrame(() => this.tremendo.set(true));
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    const alvo = evento.target as HTMLElement | null;
    if (alvo?.closest('input, textarea, [role="dialog"]')) return;
    const d = this.duelo();
    if (!d) return;
    if (d.escolhido === null && (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight')) {
      evento.preventDefault();
      this.tocar(evento.key === 'ArrowLeft' ? d.a : d.b);
    } else if (evento.key === 'Enter' && this.temProximo() && !alvo?.closest('button, a')) {
      this.proximo();
    }
  }

  tocar(f: FilmeDoDuelo): void {
    if (this.ocupado || this.duelo()?.escolhido !== null) return;
    this.escolher.emit(f.tmdbId);
  }

  proximo(): void {
    this.vendo.update((v) => v + 1);
  }
}
