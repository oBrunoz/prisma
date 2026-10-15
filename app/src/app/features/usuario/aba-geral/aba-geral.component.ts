import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideArrowRight, LucidePlus } from '@lucide/angular';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { AvaliacaoUsuario, Midia } from '../../../core/models/catalogo.models';
import { AvaliacaoService } from '../../../core/services/avaliacao.service';
import { CarouselRowComponent } from '../../../shared/components/carousel-row/carousel-row.component';
import { MovieCardComponent } from '../../../shared/components/movie-card/movie-card.component';
import { CartaoAvaliacaoComponent } from '../../../shared/components/cartao-avaliacao/cartao-avaliacao.component';

export type AbaPerfil = 'geral' | 'diario' | 'avaliacoes' | 'watchlist';

@Component({
  selector: 'app-aba-geral',
  standalone: true,
  imports: [CarouselRowComponent, MovieCardComponent, CartaoAvaliacaoComponent, LucideArrowRight, LucidePlus],
  templateUrl: './aba-geral.component.html',
})
export class AbaGeralComponent implements OnInit, OnDestroy {
  private readonly avaliacaoService = inject(AvaliacaoService);

  readonly userId = input.required<string>();
  readonly username = input.required<string>();
  readonly souEu = input(false);
  readonly favoritos = input<Midia[]>([]);
  readonly escolherFavoritos = output<void>();
  readonly verAba = output<AbaPerfil>();

  readonly assistidos = signal<AvaliacaoUsuario[]>([]);
  readonly escritas = signal<AvaliacaoUsuario[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal('');

  readonly vazio = computed(
    () =>
      !this.carregando() &&
      !this.erro() &&
      this.favoritos().length === 0 &&
      this.assistidos().length === 0 &&
      this.escritas().length === 0,
  );

  readonly vagas = computed(() => Array.from({ length: 4 - this.favoritos().length }, (_, i) => i));

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    forkJoin({
      assistidos: this.avaliacaoService.porUsuario(this.userId(), 12, 'diario'),
      escritas: this.avaliacaoService.porUsuario(this.userId(), 3, 'escritas'),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ assistidos, escritas }) => {
          this.assistidos.set(assistidos);
          this.escritas.set(escritas);
          this.carregando.set(false);
        },
        error: (falha) => {
          this.erro.set(mensagemDeErro(falha));
          this.carregando.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  tipoDeCard(midia: Midia): 'movies' | 'series' {
    return midia.type === 'MOVIE' ? 'movies' : 'series';
  }

  ano(midia: Midia): string {
    return midia.releaseDate ? midia.releaseDate.slice(0, 4) : '';
  }
}
