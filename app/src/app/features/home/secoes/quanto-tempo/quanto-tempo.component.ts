import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, catchError, of, switchMap, takeUntil, tap } from 'rxjs';
import { FAIXAS_DE_DURACAO } from '../../../../core/config/vitrine';
import { Movie } from '../../../../core/models/tmdb.models';
import { MovieService } from '../../../../core/services/movie.service';
import { CarouselRowComponent } from '../../../../shared/components/carousel-row/carousel-row.component';
import { MovieCardComponent } from '../../../../shared/components/movie-card/movie-card.component';
import { AparecerDirective } from '../../../../shared/directives/aparecer.directive';

@Component({
  selector: 'app-quanto-tempo',
  standalone: true,
  imports: [CarouselRowComponent, MovieCardComponent, AparecerDirective],
  templateUrl: './quanto-tempo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuantoTempoComponent implements OnDestroy {
  private readonly movies = inject(MovieService);
  private readonly troca$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly faixas = FAIXAS_DE_DURACAO;
  readonly faixa = signal(FAIXAS_DE_DURACAO[0].id);
  readonly filmes = signal<Movie[]>([]);
  readonly carregando = signal(true);
  readonly esqueleto = Array(8).fill(0);

  constructor() {
    this.troca$
      .pipe(
        tap(() => this.carregando.set(true)),
        switchMap((id) => {
          const faixa = this.faixas.find((f) => f.id === id)!;
          // populares e bem avaliados, para a escolha não cair em filme desconhecido
          return this.movies
            .discover<Movie>('movie', {
              params: { ...faixa.params, 'vote_count.gte': 500, 'vote_average.gte': 6.5 },
            })
            .pipe(catchError(() => of(null)));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((res) => {
        this.filmes.set(res?.results ?? []);
        this.carregando.set(false);
      });
  }

  carregar(): void {
    this.troca$.next(this.faixa());
  }

  escolher(id: string): void {
    if (id === this.faixa()) return;
    this.faixa.set(id);
    this.troca$.next(id);
  }

  ano(filme: Movie): string {
    return filme.release_date ? filme.release_date.slice(0, 4) : '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
