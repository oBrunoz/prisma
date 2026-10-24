import { Component, Input, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { LucideChevronDown } from '@lucide/angular';
import { Episode, Season } from '../../../core/models/tmdb.models';
import { MovieService } from '../../../core/services/movie.service';
import { MediaFallbackComponent } from '../media-fallback/media-fallback.component';

@Component({
  selector: 'app-season-list',
  standalone: true,
  imports: [CommonModule, LucideChevronDown, MediaFallbackComponent],
  templateUrl: './season-list.component.html',
})
export class SeasonListComponent implements OnDestroy {
  @Input({ required: true }) tvId!: number;

  @Input() set seasons(value: Season[]) {
    // especiais (temporada 0) vão para o fim
    this.orderedSeasons.set(
      [...(value ?? [])].sort((a, b) => {
        if (a.season_number === 0) return 1;
        if (b.season_number === 0) return -1;
        return a.season_number - b.season_number;
      })
    );
    this.openSeason.set(null);
    this.episodesBySeason.set({});
  }

  orderedSeasons = signal<Season[]>([]);
  openSeason = signal<number | null>(null);
  loadingSeason = signal<number | null>(null);
  episodesBySeason = signal<Record<number, Episode[]>>({});

  private destroy$ = new Subject<void>();

  constructor(private movieService: MovieService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle(season: Season): void {
    if (this.openSeason() === season.season_number) {
      this.openSeason.set(null);
      return;
    }

    this.openSeason.set(season.season_number);

    if (this.episodesBySeason()[season.season_number]) return;

    this.loadingSeason.set(season.season_number);
    this.movieService
      .getSeasonDetails(this.tvId, season.season_number)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null))
      )
      .subscribe((details) => {
        this.episodesBySeason.update((cache) => ({
          ...cache,
          [season.season_number]: details?.episodes ?? [],
        }));
        this.loadingSeason.set(null);
      });
  }

  episodesOf(season: Season): Episode[] {
    return this.episodesBySeason()[season.season_number] ?? [];
  }

  posterUrl(season: Season): string {
    return this.movieService.getImageUrl(season.poster_path, 'w185');
  }

  stillUrl(episode: Episode): string {
    return this.movieService.getImageUrl(episode.still_path, 'w300');
  }

  year(season: Season): string {
    return season.air_date ? String(new Date(season.air_date).getFullYear()) : '';
  }
}
