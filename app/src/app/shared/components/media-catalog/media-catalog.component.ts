import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  HostListener,
  NgZone,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, of, forkJoin } from 'rxjs';
import { takeUntil, switchMap, map, catchError } from 'rxjs/operators';
import { MovieService } from '../../../core/services/movie.service';
import { MovieCardComponent } from '../movie-card/movie-card.component';
import { HeroSectionComponent } from '../hero-section/hero-section.component';
import { Genre, Movie, TvShow, Spotlight } from '../../../core/models/tmdb.models';
import { ShelfConfig, MOVIE_SHELVES, TV_SHELVES } from '../../../core/config/shelves';
import { ContentShelfComponent } from '../content-shelf/content-shelf.component';
import { NavigationStateService } from '../../../core/services/navigation-state.service';
import { LucideChevronDown, LucideCheck, LucideX } from '@lucide/angular';
import { STREAMINGS } from '../../../core/config/vitrine';

type CatalogItem = Movie & TvShow;

@Component({
  selector: 'app-media-catalog',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MovieCardComponent,
    HeroSectionComponent,
    ContentShelfComponent,
    LucideChevronDown,
    LucideCheck,
    LucideX,
  ],
  templateUrl: './media-catalog.component.html',
})
export class MediaCatalogComponent implements OnInit, OnDestroy {
  @Input({ required: true }) type: 'movie' | 'tv' = 'movie';
  @Input() heading = '';

  genres = signal<Genre[]>([]);
  selectedGenreId = signal<number | null>(null);
  decada = signal<number | null>(null);
  streaming = signal<number | null>(null);
  items = signal<CatalogItem[]>([]);
  spotlight = signal<Spotlight | null>(null);

  isGenreMenuOpen = signal(false);
  isBarVisible = signal(true);
  isBarSolid = signal(false);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  isLoadingSpotlight = signal(true);
  hasError = signal(false);

  skeletonItems = Array(20).fill(0);
  moreSkeletonItems = Array(5).fill(0);

  private page = signal(1);
  private totalPages = signal(1);
  private destroy$ = new Subject<void>();
  private lastScrollY = 0;
  private observer?: IntersectionObserver;

  // a sentinela só existe no DOM enquanto houver próxima página
  @ViewChild('sentinel')
  set sentinel(el: ElementRef<HTMLElement> | undefined) {
    this.observer?.disconnect();
    if (!el) return;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) this.zone.run(() => this.loadMore());
        },
        { rootMargin: '600px 0px' }
      );
      this.observer.observe(el.nativeElement);
    });
  }

  constructor(
    private movieService: MovieService,
    private route: ActivatedRoute,
    private router: Router,
    private host: ElementRef<HTMLElement>,
    private zone: NgZone,
    private navState: NavigationStateService
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isGenreMenuOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.isGenreMenuOpen.set(false);
    }
  }

  private syncScrollState(): void {
    this.lastScrollY = window.scrollY;
    this.isBarVisible.set(true);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const y = window.scrollY;
    const delta = y - this.lastScrollY;

    this.isBarSolid.set(y > window.innerHeight - 128);

    if (Math.abs(delta) > 6) {
      this.isBarVisible.set(y < 120 || delta < 0);
      this.lastScrollY = y;
    }

    if (!this.isBarVisible()) this.isGenreMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isGenreMenuOpen.set(false);
  }

  get shelves(): ShelfConfig[] {
    return this.type === 'movie' ? MOVIE_SHELVES : TV_SHELVES;
  }

  get mediaType(): 'movies' | 'series' {
    return this.type === 'movie' ? 'movies' : 'series';
  }

  selectedGenre = computed(() =>
    this.genres().find((g) => g.id === this.selectedGenreId()) ?? null
  );

  recorte = computed(() => {
    const decada = this.decada();
    const streaming = STREAMINGS.find((s) => s.id === this.streaming());
    const campo = this.type === 'movie' ? 'primary_release_date' : 'first_air_date';
    const params: Record<string, string | number> = {};
    const rotulos: string[] = [];
    if (decada) {
      params[`${campo}.gte`] = `${decada}-01-01`;
      params[`${campo}.lte`] = `${decada + 9}-12-31`;
      rotulos.push(`Anos ${String(decada).slice(2)}`);
    }
    if (streaming) {
      params['with_watch_providers'] = streaming.id;
      params['watch_region'] = 'BR';
      rotulos.push(`${streaming.em} ${streaming.nome}`);
    }
    return rotulos.length ? { params, rotulo: rotulos.join(' · ') } : null;
  });

  sectionTitle = computed(() => {
    const genero = this.selectedGenre()?.name;
    const recorte = this.recorte()?.rotulo;
    if (recorte) return genero ? `${genero} · ${recorte}` : recorte;
    return genero ?? this.heading;
  });

  canLoadMore = computed(() => this.page() < this.totalPages());

  ngOnInit(): void {
    this.syncScrollState();

    this.movieService
      .getGenres(this.type)
      .pipe(takeUntil(this.destroy$))
      .subscribe((genres) => this.genres.set(genres));

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const raw = params.get('genero');
      const genreId = raw ? Number(raw) : null;
      this.selectedGenreId.set(Number.isFinite(genreId) && genreId ? genreId : null);
      this.decada.set(numeroDaUrl(params.get('decada')));
      this.streaming.set(numeroDaUrl(params.get('streaming')));
      this.syncScrollState();
      this.loadFirstPage();
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleGenreMenu(): void {
    this.isGenreMenuOpen.update((open) => !open);
  }

  selectGenre(genreId: number | null): void {
    this.isGenreMenuOpen.set(false);
    if (genreId === this.selectedGenreId()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { genero: genreId },
      queryParamsHandling: 'merge',
    });
  }

  limparRecorte(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { decada: null, streaming: null },
      queryParamsHandling: 'merge',
    });
  }

  loadMore(): void {
    if (!this.canLoadMore() || this.isLoadingMore()) return;

    const next = this.page() + 1;
    this.isLoadingMore.set(true);

    this.movieService
      .discover<CatalogItem>(this.type, { genreId: this.selectedGenreId(), page: next, params: this.recorte()?.params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.items.update((current) => [...current, ...data.results]);
          this.page.set(data.page);
          this.navState.savePages(this.router.url, data.page);
          this.isLoadingMore.set(false);
        },
        error: () => this.isLoadingMore.set(false),
      });
  }

  retry(): void {
    this.loadFirstPage();
  }

  private loadFirstPage(): void {
    const url = this.router.url;
    const pagesToLoad = this.navState.isRestoring() ? this.navState.readPages(url) : 1;

    this.isLoading.set(true);
    this.isLoadingSpotlight.set(true);
    this.hasError.set(false);
    this.items.set([]);
    this.spotlight.set(null);

    const requests = Array.from({ length: pagesToLoad }, (_, i) =>
      this.movieService.discover<CatalogItem>(this.type, {
        genreId: this.selectedGenreId(),
        page: i + 1,
        params: this.recorte()?.params,
      })
    );

    forkJoin(requests)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((responses) => {
          const first = responses[0];

          this.items.set(responses.flatMap((r) => r.results));
          this.page.set(responses.length);
          this.totalPages.set(Math.min(first.total_pages, 500));
          this.navState.savePages(url, responses.length);
          this.isLoading.set(false);

          const top = first.results[0];
          if (!top) return of(null);

          return this.movieService.getSpotlight(top.id, this.type).pipe(
            catchError(() => of(null))
          );
        }),
        map((spot) => spot)
      )
      .subscribe({
        next: (spot) => {
          this.spotlight.set(spot);
          this.isLoadingSpotlight.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.isLoadingSpotlight.set(false);
          this.hasError.set(true);
        },
      });
  }

  get spotlightRuntime(): string {
    const minutes = this.spotlight()?.runtime;
    if (!minutes) return '';
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  get spotlightRoute(): unknown[] | null {
    const id = this.spotlight()?.id;
    return id ? ['/search', this.mediaType, id] : null;
  }

  getTitle(item: CatalogItem): string {
    return item.title ?? item.name ?? '';
  }

  getYear(item: CatalogItem): string {
    const date = this.type === 'movie' ? item.release_date : item.first_air_date;
    return date ? String(new Date(date).getFullYear()) : '';
  }
}

function numeroDaUrl(valor: string | null): number | null {
  const n = valor ? Number(valor) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
