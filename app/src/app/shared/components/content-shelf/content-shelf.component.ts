import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  NgZone,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { switchMap, takeUntil, catchError } from 'rxjs/operators';
import { MovieService } from '../../../core/services/movie.service';
import { MovieCardComponent } from '../movie-card/movie-card.component';
import { CarouselRowComponent } from '../carousel-row/carousel-row.component';
import { Movie, TvShow } from '../../../core/models/tmdb.models';

type ShelfItem = Movie & TvShow;

@Component({
  selector: 'app-content-shelf',
  standalone: true,
  imports: [CommonModule, MovieCardComponent, CarouselRowComponent],
  templateUrl: './content-shelf.component.html',
})
export class ContentShelfComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) type: 'movie' | 'tv' = 'movie';
  @Input() title = '';
  @Input() params: Record<string, string | number> = {};

  @Input() large = false;

  @Input()
  set genreId(value: number | null) {
    this.currentGenreId = value;
    // sem ter aparecido ainda, a troca de gênero espera o usuário chegar aqui
    if (this.hasAppeared) this.trigger$.next();
  }

  items = signal<ShelfItem[]>([]);
  isLoading = signal(true);
  skeletonItems = Array(6).fill(0);

  private currentGenreId: number | null = null;
  private hasAppeared = false;
  private observer?: IntersectionObserver;
  private trigger$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private movieService: MovieService,
    private host: ElementRef<HTMLElement>,
    private zone: NgZone
  ) {}

  get mediaType(): 'movies' | 'series' {
    return this.type === 'movie' ? 'movies' : 'series';
  }

  ngOnInit(): void {
    this.trigger$
      .pipe(
        switchMap(() => {
          this.isLoading.set(true);
          return this.movieService
            .discover<ShelfItem>(this.type, {
              genreId: this.currentGenreId,
              params: this.params,
            })
            .pipe(catchError(() => of(null)));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((data) => {
        this.items.set(data?.results ?? []);
        this.isLoading.set(false);
      });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          this.observer?.disconnect();
          this.zone.run(() => {
            this.hasAppeared = true;
            this.trigger$.next();
          });
        },
        { rootMargin: '300px 0px' }
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  getTitle(item: ShelfItem): string {
    return item.title ?? item.name ?? '';
  }

  getYear(item: ShelfItem): string {
    const date = this.type === 'movie' ? item.release_date : item.first_air_date;
    return date ? String(new Date(date).getFullYear()) : '';
  }
}
