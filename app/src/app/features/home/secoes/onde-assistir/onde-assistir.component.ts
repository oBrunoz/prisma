import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';
import { Subject, catchError, of, switchMap, takeUntil, tap } from 'rxjs';
import { STREAMINGS } from '../../../../core/config/vitrine';
import { Movie } from '../../../../core/models/tmdb.models';
import { MovieService } from '../../../../core/services/movie.service';
import { CarouselRowComponent } from '../../../../shared/components/carousel-row/carousel-row.component';
import { MovieCardComponent } from '../../../../shared/components/movie-card/movie-card.component';
import { AparecerDirective } from '../../../../shared/directives/aparecer.directive';

// o que tem em cada streaming no Brasil: as pills trocam a fileira
@Component({
  selector: 'app-onde-assistir',
  standalone: true,
  imports: [RouterLink, LucideArrowRight, CarouselRowComponent, MovieCardComponent, AparecerDirective],
  templateUrl: './onde-assistir.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OndeAssistirComponent implements OnDestroy {
  private readonly movies = inject(MovieService);
  private readonly troca$ = new Subject<number>();
  private readonly destroy$ = new Subject<void>();

  readonly streamings = STREAMINGS;
  readonly escolhido = signal(STREAMINGS[0].id);
  readonly logos = signal<Record<number, string>>({});
  readonly filmes = signal<Movie[]>([]);
  readonly carregando = signal(true);
  readonly esqueleto = Array(8).fill(0);

  constructor() {
    this.troca$
      .pipe(
        tap(() => this.carregando.set(true)),
        switchMap((id) =>
          this.movies
            .discover<Movie>('movie', {
              params: { with_watch_providers: id, watch_region: 'BR', 'vote_count.gte': 100 },
            })
            .pipe(catchError(() => of(null))),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((res) => {
        this.filmes.set(res?.results ?? []);
        this.carregando.set(false);
      });
  }

  carregar(): void {
    this.troca$.next(this.escolhido());
    // os logos vêm da TMDB; sem eles a pill fica só com o nome
    this.movies
      .getStreamingsDaRegiao('BR')
      .pipe(takeUntil(this.destroy$))
      .subscribe((lista) =>
        this.logos.set(Object.fromEntries(lista.map((p) => [p.provider_id, this.movies.getImageUrl(p.logo_path, 'w92')]))),
      );
  }

  escolher(id: number): void {
    if (id === this.escolhido()) return;
    this.escolhido.set(id);
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
