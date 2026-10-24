import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, switchMap, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { MovieService, srcsetDeFundo, srcsetDeLogo } from '../../core/services/movie.service';
import { HeroSectionComponent } from '../../shared/components/hero-section/hero-section.component';
import { MovieCardComponent } from '../../shared/components/movie-card/movie-card.component';
import { CastCard, MappedCastMember } from '../../shared/components/cast-card/cast-card';
import { PersonModalComponent } from '../../shared/components/person-modal/person-modal.component';
import { CarouselRowComponent } from '../../shared/components/carousel-row/carousel-row.component';
import { WatchProvidersComponent } from '../../shared/components/watch-providers/watch-providers.component';
import { ContentFactsComponent } from '../../shared/components/content-facts/content-facts.component';
import { SeasonListComponent } from '../../shared/components/season-list/season-list.component';
import { MediaGalleryComponent } from '../../shared/components/media-gallery/media-gallery.component';
import { ReviewCardComponent } from '../../shared/components/review-card/review-card.component';
import { MediaActionsComponent } from '../../shared/components/media-actions/media-actions.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { TextoRecolhivelComponent } from '../../shared/components/texto-recolhivel/texto-recolhivel.component';
import { AvaliacaoService } from '../../core/services/avaliacao.service';
import { FichaSyncService } from '../../core/services/ficha-sync.service';
import { SmoothScrollService } from '../../core/services/smooth-scroll.service';
import { SeoService } from '../../core/services/seo.service';
import { AvaliacaoUsuario, EstatisticasMidia } from '../../core/models/catalogo.models';
import { mensagemDeErro } from '../../core/errors/mensagens';
import {
  ContentDetails,
  ImageBackdrop,
  MediaResult,
  Movie,
  Review,
  Season,
  TmdbListResponse,
  TvShow,
  Video,
  WatchProviderCountry,
} from '../../core/models/tmdb.models';
import { environment } from '../../../environments/environment';

export interface MappedSimilarItem {
  id: number;
  title: string;
  posterPath: string | null;
  year: string;
  rating: number;
  mediaType: 'movies' | 'series';
}

const REVIEWS_VAZIAS: TmdbListResponse<Review> = {
  page: 1,
  results: [],
  total_pages: 0,
  total_results: 0,
};

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HeroSectionComponent,
    MovieCardComponent,
    CastCard,
    PersonModalComponent,
    CarouselRowComponent,
    WatchProvidersComponent,
    ContentFactsComponent,
    SeasonListComponent,
    MediaGalleryComponent,
    ReviewCardComponent,
    MediaActionsComponent,
    UserAvatarComponent,
    TextoRecolhivelComponent,
  ],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.css'],
})
export class DetailsComponent implements OnInit, OnDestroy {
  details = signal<ContentDetails | null>(null);
  reviews = signal<Review[]>([]);
  avaliacoesPrisma = signal<AvaliacaoUsuario[]>([]);
  carregandoPrisma = signal(true);
  erroPrisma = signal('');
  estatisticas = signal<EstatisticasMidia | null>(null);

  readonly barras = computed(() => {
    const dist = this.estatisticas()?.distribuicao ?? [];
    const pico = Math.max(...dist, 0);
    return dist.map((quantidade, i) => ({
      nota: i + 1,
      quantidade,
      altura: pico > 0 ? Math.round((quantidade / pico) * 100) : 0,
    }));
  });
  contentType = signal<'movies' | 'series' | 'people'>('movies');
  trailerUrl = signal<string>('#');
  backgroundUrl = signal<string>('');
  backgroundSrcset = signal<string>('');
  logoUrl = signal<string>('');
  logoSrcset = signal<string>('');
  isLoading = signal(true);

  skeletonCast = Array(6).fill(0);

  selectedPersonId = signal<number | null>(null);
  skeletonSimilar = Array(6).fill(0);

  private destroy$ = new Subject<void>();
  private trocaDeTitulo$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private movieService: MovieService,
    private avaliacaoService: AvaliacaoService,
    private fichaSync: FichaSyncService,
    private smoothScroll: SmoothScrollService,
    private seo: SeoService
  ) {}

  ngOnInit(): void {
    this.fichaSync
      .todas()
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ tmdbId, mediaType }) => {
        if (tmdbId === this.details()?.id && mediaType === this.apiType()) {
          this.recarregarAvaliacoesPrisma();
        }
      });

    this.route.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          const type = params['content_type'] as 'movies' | 'series' | 'people';
          const id = Number(params['id']);
          this.contentType.set(type);
          this.isLoading.set(true);
          this.reviews.set([]);
          this.details.set(null);
          this.trocaDeTitulo$.next();
          this.avaliacoesPrisma.set([]);
          this.estatisticas.set(null);
          this.erroPrisma.set('');
          this.carregandoPrisma.set(true);
          if (type === 'movies' || type === 'series') this.carregarAvaliacoesPrisma(id);

          if (type !== 'movies' && type !== 'series') {
            return forkJoin({
              details: of(null as ContentDetails | null),
              reviews: of(REVIEWS_VAZIAS),
            });
          }

          const apiType = type === 'movies' ? 'movie' : 'tv';

          return forkJoin({
            details: this.movieService
              .getContentDetails(id, apiType)
              .pipe(catchError(() => of(null as ContentDetails | null))),
            reviews: this.movieService
              .getReviews(id, apiType)
              .pipe(catchError(() => of(REVIEWS_VAZIAS))),
          });
        })
      )
      .subscribe({
        next: ({ details, reviews }) => {
          this.details.set(details);
          this.reviews.set(reviews.results ?? []);
          this.trailerUrl.set(this.pickTrailerUrl(details));

          // a largura da original vem com a imagem; o backdrop_path solto não traz, e aí supõe 1920
          const fundo = details?.images?.backdrops?.[0];
          const backdrop = fundo?.file_path ?? details?.backdrop_path;
          const fundoUrl = backdrop ? `${environment.tmdbImageUrl}/w1280${backdrop}` : '';
          this.backgroundUrl.set(fundoUrl);
          this.backgroundSrcset.set(fundoUrl ? (srcsetDeFundo(fundoUrl, fundo?.width) ?? '') : '');

          const logo = this.pickLogo(details);
          const logoUrl = logo ? `${environment.tmdbImageUrl}/w500${logo.file_path}` : '';
          this.logoUrl.set(logoUrl);
          this.logoSrcset.set(logo ? (srcsetDeLogo(logoUrl, logo.width) ?? '') : '');

          this.isLoading.set(false);
          if (details) this.definirSeo(details, fundoUrl);

          // veio do convite de avaliar em outro banner
          if (this.route.snapshot.fragment === 'sua-avaliacao') {
            setTimeout(() => this.rolarParaAvaliacao(), 300);
          }
        },
        error: () => this.isLoading.set(false),
      });
  }

  ngOnDestroy(): void {
    this.trocaDeTitulo$.next();
    this.trocaDeTitulo$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  rolarParaAvaliacao(): void {
    const alvo = document.getElementById('sua-avaliacao');
    if (alvo) this.smoothScroll.scrollTo(alvo);
  }

  recarregarAvaliacoesPrisma(): void {
    const id = this.details()?.id;
    if (id) this.carregarAvaliacoesPrisma(id);
  }

  private carregarAvaliacoesPrisma(id: number): void {
    this.carregandoPrisma.set(true);
    this.erroPrisma.set('');

    forkJoin({
      lista: this.avaliacaoService.porTitulo(id, this.apiType()),
      // a lista é paginada: somar as notas no cliente daria média errada
      stats: this.avaliacaoService.estatisticas(id, this.apiType()),
    })
      .pipe(takeUntil(this.trocaDeTitulo$), takeUntil(this.destroy$))
      .subscribe({
        next: ({ lista, stats }) => {
          this.avaliacoesPrisma.set(lista);
          this.estatisticas.set(stats);
          this.carregandoPrisma.set(false);
        },
        error: (falha) => {
          this.erroPrisma.set(mensagemDeErro(falha));
          this.carregandoPrisma.set(false);
        },
      });
  }

  // título com "onde assistir": é como a maioria procura um filme no Google
  private definirSeo(details: ContentDetails, fundoUrl: string): void {
    const serie = this.isSeries();
    const ano = this.releaseYear;
    const nome = ano ? `${this.title} (${ano})` : this.title;
    const diretores = (details.credits?.crew ?? [])
      .filter((p) => p.job === 'Director')
      .map((p) => p.name);
    const criadores = (details.created_by ?? []).map((p) => p.name);
    const autoria = serie ? criadores : diretores;
    const poster = details.poster_path ? `${environment.tmdbImageUrl}/w500${details.poster_path}` : null;

    this.seo.definir({
      titulo: `${nome}: onde assistir, elenco e avaliações`,
      descricao:
        details.overview ||
        `Veja onde assistir ${this.title}, elenco, trailer e o que estão achando no Prisma.`,
      imagem: fundoUrl || poster,
      tipo: serie ? 'video.tv_show' : 'video.movie',
      dados: {
        '@type': serie ? 'TVSeries' : 'Movie',
        name: this.title,
        description: details.overview || undefined,
        image: poster ?? undefined,
        datePublished: details.release_date || details.first_air_date || undefined,
        genre: details.genres?.map((g) => g.name),
        [serie ? 'creator' : 'director']: autoria.length
          ? autoria.map((name) => ({ '@type': 'Person', name }))
          : undefined,
        actor: details.credits?.cast?.slice(0, 5).map((p) => ({ '@type': 'Person', name: p.name })),
        ...(serie && details.number_of_seasons ? { numberOfSeasons: details.number_of_seasons } : {}),
      },
    });
  }

  private pickLogo(details: ContentDetails | null): ImageBackdrop | null {
    const logos = details?.images?.logos ?? [];
    const escolhido =
      logos.find((l) => l.iso_639_1 === 'pt') ??
      logos.find((l) => l.iso_639_1 === 'en') ??
      logos[0];
    return escolhido ?? null;
  }

  private pickTrailerUrl(details: ContentDetails | null): string {
    const videos = (details?.videos?.results ?? []).filter((v) => v.site === 'YouTube');
    const escolhido =
      videos.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'pt') ??
      videos.find((v) => v.type === 'Trailer') ??
      videos.find((v) => v.type === 'Teaser');
    return escolhido ? `https://www.youtube-nocookie.com/embed/${escolhido.key}` : '#';
  }

  apiType = computed<'movie' | 'tv'>(() =>
    this.contentType() === 'series' ? 'tv' : 'movie'
  );

  isSeries = computed(() => this.contentType() === 'series');

  get contentLabel(): string {
    const t = this.contentType();
    if (t === 'movies') return 'Filme';
    if (t === 'series') return 'Série';
    return 'Pessoa';
  }

  get title(): string {
    return this.details()?.title || this.details()?.name || '';
  }

  get releaseYear(): string {
    const date = this.details()?.release_date || this.details()?.first_air_date;
    return date ? String(new Date(date).getFullYear()) : '';
  }

  get runtime(): string {
    const d = this.details();
    if (!d) return '';
    if (this.contentType() === 'movies' && d.runtime) {
      return `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}min`;
    }
    if (this.contentType() === 'series') {
      if (d.number_of_seasons) {
        return `${d.number_of_seasons} temporada${d.number_of_seasons === 1 ? '' : 's'}`;
      }
      if (d.episode_run_time?.length) return `${d.episode_run_time[0]} min/ep`;
    }
    return '';
  }

  certification = computed(() => this.movieService.getCertification(this.details()));

  watchProviders = computed<WatchProviderCountry | null>(() =>
    this.movieService.getWatchProviders(this.details())
  );

  hasWatchProviders = computed(() => {
    const p = this.watchProviders();
    if (!p) return false;
    return !!(
      p.flatrate?.length ||
      p.free?.length ||
      p.ads?.length ||
      p.rent?.length ||
      p.buy?.length
    );
  });

  seasons = computed<Season[]>(() => this.details()?.seasons ?? []);

  videos = computed<Video[]>(() => this.details()?.videos?.results ?? []);
  backdrops = computed<ImageBackdrop[]>(() => this.details()?.images?.backdrops ?? []);
  posters = computed<ImageBackdrop[]>(() => this.details()?.images?.posters ?? []);

  hasMedia = computed(
    () =>
      this.videos().length > 0 ||
      this.backdrops().length > 0 ||
      this.posters().length > 0
  );

  openPerson(personId: number): void {
    this.selectedPersonId.set(personId);
  }

  closePerson(): void {
    this.selectedPersonId.set(null);
  }

  mappedCast = computed<MappedCastMember[]>(() => {
    const castList = this.details()?.credits?.cast || [];
    return castList.slice(0, 20).map((actor) => ({
      ...actor,
      profileUrl: this.movieService.getImageUrl(actor.profile_path, 'w500'),
    }));
  });

  private mapList(list: MediaResult[]): MappedSimilarItem[] {
    const mediaType = this.contentType() === 'movies' ? 'movies' : 'series';
    return list
      .filter((item): item is Movie | TvShow => 'poster_path' in item)
      .map((item) => {
        const date = 'release_date' in item ? item.release_date : item.first_air_date;
        const title = 'title' in item ? item.title : item.name;
        return {
          id: item.id,
          title,
          posterPath: item.poster_path,
          year: date ? String(new Date(date).getFullYear()) : '',
          rating: item.vote_average,
          mediaType,
        };
      });
  }

  mappedSimilar = computed<MappedSimilarItem[]>(() =>
    this.mapList(this.details()?.similar?.results ?? [])
  );

  mappedRecommendations = computed<MappedSimilarItem[]>(() =>
    this.mapList(this.details()?.recommendations?.results ?? [])
  );
}
