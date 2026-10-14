import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MovieService } from '../../core/services/movie.service';
import { MovieCardComponent } from '../../shared/components/movie-card/movie-card.component';
import { HeroSectionComponent } from '../../shared/components/hero-section/hero-section.component';
import { CarouselRowComponent } from '../../shared/components/carousel-row/carousel-row.component';
import { ContentShelfComponent } from '../../shared/components/content-shelf/content-shelf.component';
import { HOME_SHELVES, HomeShelfConfig } from '../../core/config/shelves';
import { Movie, TvShow, SpotlightData } from '../../core/models/tmdb.models';
import {
  LucideArrowRight,
  LucideChevronLeft,
  LucideChevronRight,
  LucideStar,
  LucideUserPlus,
  LucideLogIn,
} from '@lucide/angular';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MovieCardComponent,
    HeroSectionComponent,
    CarouselRowComponent,
    ContentShelfComponent,
    LucideArrowRight,
    LucideChevronLeft,
    LucideChevronRight,
    LucideStar,
    LucideUserPlus,
    LucideLogIn,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  spotlights = signal<SpotlightData[]>([]);
  trendingMovies = signal<Movie[]>([]);
  popularMovies = signal<Movie[]>([]);
  trendingSeries = signal<TvShow[]>([]);
  lastRecommendation = signal<SpotlightData | undefined>(undefined);

  // prateleiras que se carregam sozinhas quando o usuário chega nelas
  shelfNosCinemas = this.shelf('nos-cinemas');
  shelfEmBreve = this.shelf('em-breve');
  shelfEpisodiosDaSemana = this.shelf('episodios-da-semana');

  private shelf(id: string): HomeShelfConfig {
    return HOME_SHELVES.find((s) => s.id === id)!;
  }

  exploreGenres = [
    { id: 28, name: 'Ação' },
    { id: 12, name: 'Aventura' },
    { id: 35, name: 'Comédia' },
    { id: 18, name: 'Drama' },
    { id: 27, name: 'Terror' },
    { id: 878, name: 'Ficção científica' },
    { id: 53, name: 'Suspense' },
    { id: 16, name: 'Animação' },
    { id: 10749, name: 'Romance' },
    { id: 9648, name: 'Mistério' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentário' },
  ];

  highlightPair = computed(() => this.spotlights().slice(-2));
  
  carouselCurrentIndex = signal(0);
  isLoading = signal(true);
  hasError = signal(false);
  shouldDisplayCarouselDots = signal(true);
  skeletonItems = Array(10).fill(0);

  private destroy$ = new Subject<void>();
  private autoPlayInterval: ReturnType<typeof setInterval> | null = null

  constructor(private movieService: MovieService) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.loadSpotlights();
      this.loadTrending();
      this.loadPopular();
      this.loadTrendingSeries();
      this.loadLastRecommendation();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.clearInterval();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSpotlights(): void {
    this.movieService
      .getSpotlightMovies(10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.spotlights.set(data);
          this.isLoading.set(false);
          this.startAutoPlay();
        },
        error: (err) => {
          console.error('Erro ao carregar spotlight:', err);
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  private loadTrending(): void {
    this.movieService
      .getTrendingMovies('week')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.trendingMovies.set(data.results.slice(0, 20));
        },
        error: (err) => console.error('Erro ao carregar trending:', err),
      });
  }

  private loadPopular(): void {
    this.movieService
      .getPopularMovies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.popularMovies.set(data.results.slice(0, 20));
        },
        error: (err) => console.error('Erro ao carregar populares:', err),
      });
  }

  private loadTrendingSeries(): void {
    this.movieService
      .getTrendingTv('week')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.trendingSeries.set(data.results.slice(0, 20));
        },
        error: (err) => console.error('Erro ao carregar séries em alta:', err),
      });
  }

  private loadLastRecommendation(): void {
    this.movieService
      .getSpotlightMovie()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.lastRecommendation.set(data),
        error: (err) => console.error('Erro ao carregar a última recomendação:', err),
      });
  }

  private clearInterval(): void {
    if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
  }

  private startAutoPlay() {
    this.clearInterval();

    this.autoPlayInterval = setInterval(() => {
      const next = (this.carouselCurrentIndex() + 1) % this.spotlights().length;
            this.carouselCurrentIndex.set(next);
    }, 10000);
  }

  get runtime(): string {
    return this.formatRuntime(this.currentSpotlight?.details?.runtime);
  }

  formatRuntime(minutes?: number): string {
    if (!minutes) return '';
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }

  get releaseYear(): string {
    const date = this.currentSpotlight?.movie?.release_date;
    return date ? String(new Date(date).getFullYear()) : '';
  }

  get spotlightDetailsRoute(): unknown[] | null {
    const id = this.currentSpotlight?.movie?.id;
    return id ? ['/search', 'movies', id] : null;
  }

  get currentSpotlight(): SpotlightData | undefined {
    return this.spotlights()[this.carouselCurrentIndex()];
  }

  goToSlide(index: number) {
    this.carouselCurrentIndex.set(index);
    this.startAutoPlay();
  }

  nextSlide(): void {
    const total = this.spotlights().length;
    if (!total) return;
    this.goToSlide((this.carouselCurrentIndex() + 1) % total);
  }

  private toqueInicio: { x: number; y: number } | null = null;

  aoTocarDestaque(evento: TouchEvent): void {
    const toque = evento.changedTouches[0];
    this.toqueInicio = toque ? { x: toque.clientX, y: toque.clientY } : null;
  }

  // só conta como troca o gesto horizontal: rolar a página na vertical não mexe no destaque
  aoSoltarDestaque(evento: TouchEvent): void {
    const inicio = this.toqueInicio;
    const toque = evento.changedTouches[0];
    this.toqueInicio = null;
    if (!inicio || !toque || !this.shouldDisplayCarouselDots()) return;
    const dx = toque.clientX - inicio.x;
    const dy = toque.clientY - inicio.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) this.nextSlide();
    else this.prevSlide();
  }

  prevSlide(): void {
    const total = this.spotlights().length;
    if (!total) return;
    this.goToSlide((this.carouselCurrentIndex() - 1 + total) % total);
  }

  getMovieYear(movie?: Movie): string {
    return movie?.release_date ? String(new Date(movie.release_date).getFullYear()) : '';
  }

  getSeriesYear(serie: TvShow): string {
    return serie.first_air_date ? String(new Date(serie.first_air_date).getFullYear()) : '';
  }

  // o convite de avaliar some se o destaque trocar no meio da leitura
  segurarDestaque(segurar: boolean): void {
    if (segurar) this.clearInterval();
    else this.startAutoPlay();
  }

  pauseAutoPlay(): void {
    this.clearInterval();
    this.shouldDisplayCarouselDots.set(false);
    this.autoPlayInterval = null;
  }

  resumeAutoPlay(): void {
    this.shouldDisplayCarouselDots.set(true);
    this.startAutoPlay();
  }

  retry(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.spotlights.set([]);
    this.trendingMovies.set([]);
    this.popularMovies.set([]);
    this.trendingSeries.set([]);
    this.lastRecommendation.set(undefined);
    setTimeout(() => {
      this.loadSpotlights();
      this.loadTrending();
      this.loadPopular();
      this.loadTrendingSeries();
      this.loadLastRecommendation();
    }, 500);
  }
}
