import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, takeUntil } from 'rxjs';
import { DECADAS, decadaParams } from '../../../../core/config/vitrine';
import { ESPECTRO } from '../../../../core/models/espectro';
import { Movie } from '../../../../core/models/tmdb.models';
import { MovieService } from '../../../../core/services/movie.service';
import { AparecerDirective } from '../../../../shared/directives/aparecer.directive';

interface Decada {
  inicio: number;
  cor: string;
  total: number;
  posters: string[];
}

@Component({
  selector: 'app-decadas',
  standalone: true,
  imports: [DecimalPipe, RouterLink, AparecerDirective],
  templateUrl: './decadas.component.html',
  styleUrls: ['./decadas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecadasComponent implements OnDestroy {
  private readonly movies = inject(MovieService);
  private readonly destroy$ = new Subject<void>();

  readonly decadas = signal<Decada[]>([]);
  readonly esqueleto = DECADAS;

  carregar(): void {
    forkJoin(
      DECADAS.map((inicio, i) =>
        this.movies
          .discover<Movie>('movie', { params: { ...decadaParams(inicio), sort_by: 'vote_count.desc' } })
          .pipe(
            map((res) => ({
              inicio,
              cor: ESPECTRO[i],
              total: res.total_results,
              posters: res.results
                .filter((m) => m.poster_path)
                .slice(0, 3)
                .map((m) => this.movies.getImageUrl(m.poster_path, 'w185')),
            })),
            catchError(() => of({ inicio, cor: ESPECTRO[i], total: 0, posters: [] })),
          ),
      ),
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe((d) => this.decadas.set(d));
  }

  rotulo(inicio: number): string {
    return String(inicio).slice(2);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
