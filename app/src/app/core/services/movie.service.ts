import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of, switchMap, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Movie,
  TvShow,
  TmdbListResponse,
  VideoResponse,
  ImagesResponse,
  ContentDetails,
  MediaResult,
  SpotlightData,
  Spotlight,
  Genre,
  Review,
  SeasonDetails,
  WatchProviderCountry,
  PersonDetails,
  PersonCredit,
  Person
} from '../models/tmdb.models';

// talk show, jornalismo e reality: aparição, não trabalho
const GENEROS_SEM_PAPEL = new Set([10767, 10763, 10764]);

@Injectable({
  providedIn: 'root',
})
export class MovieService {
  private readonly baseUrl = `${environment.apiUrl}/tmdb`;
  private readonly lang = 'pt-BR';

  constructor(private http: HttpClient) {}

  // Cache de leitura da TMDB
  private readonly cache = new Map<string, { at: number; stream$: Observable<unknown> }>();
  private readonly cacheTtl = 10 * 60 * 1000;
  private readonly cacheMaxEntries = 150;

  private get<T>(endpoint: string, extraParams: Record<string, any> = {}): Observable<T> {
    let params = new HttpParams().set('language', this.lang);

    Object.entries(extraParams).forEach(([key, value]) => {
      params = params.set(key, String(value));
    });

    const key = `${endpoint}?${params.keys().sort().map((k) => `${k}=${params.get(k)}`).join('&')}`;
    const hit = this.cache.get(key);

    if (hit && Date.now() - hit.at < this.cacheTtl) {
      return hit.stream$ as Observable<T>;
    }

    const stream$ = this.http.get<T>(`${this.baseUrl}${endpoint}`, { params }).pipe(
      catchError((err) => {
        this.cache.delete(key);
        return throwError(() => err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.cache.set(key, { at: Date.now(), stream$ });
    this.pruneCache();

    return stream$;
  }

  // Remove o que venceu e, se ainda estiver grande, as entradas mais antigas.
  private pruneCache(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now - entry.at >= this.cacheTtl) this.cache.delete(key);
    }

    while (this.cache.size > this.cacheMaxEntries) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }

  getPopularMovies(page = 1): Observable<TmdbListResponse<Movie>> {
    return this.get<TmdbListResponse<Movie>>('/movie/popular', { page });
  }

  getTrendingMovies(timeWindow: 'day' | 'week' = 'week', page = 1): Observable<TmdbListResponse<Movie>> {
    return this.get<TmdbListResponse<Movie>>(`/trending/movie/${timeWindow}`, { page });
  }

  getTrendingTv(timeWindow: 'day' | 'week' = 'week', page = 1): Observable<TmdbListResponse<TvShow>> {
    return this.get<TmdbListResponse<TvShow>>(`/trending/tv/${timeWindow}`, { page });
  }

  searchMulti(query: string, page = 1): Observable<TmdbListResponse<MediaResult>> {
    return this.get<TmdbListResponse<MediaResult>>('/search/multi', { query, page });
  }

  searchMovies(query: string, page = 1): Observable<TmdbListResponse<Movie>> {
    return this.get<TmdbListResponse<Movie>>('/search/movie', { query, page });
  }

  searchTv(query: string, page = 1): Observable<TmdbListResponse<TvShow>> {
    return this.get<TmdbListResponse<TvShow>>('/search/tv', { query, page });
  }

  searchPeople(query: string, page = 1): Observable<TmdbListResponse<Person>> {
    return this.get<TmdbListResponse<Person>>('/search/person', { query, page });
  }

  getMovieDetails(id: number): Observable<ContentDetails> {
    return this.get<ContentDetails>(`/movie/${id}`, {
      append_to_response:
        'credits,similar,recommendations,videos,images,keywords,external_ids,release_dates,watch/providers',
      include_image_language: 'pt,en,null',
      include_video_language: 'pt,en',
    });
  }

  getTvDetails(id: number): Observable<ContentDetails> {
    return this.get<ContentDetails>(`/tv/${id}`, {
      append_to_response:
        'credits,similar,recommendations,videos,images,keywords,external_ids,content_ratings,watch/providers',
      include_image_language: 'pt,en,null',
      include_video_language: 'pt,en',
    });
  }

  // só os dados básicos, sem créditos nem vídeos: serve para a capa do perfil
  getBackdrop(id: number, type: 'movie' | 'tv'): Observable<string | null> {
    return this.get<{ backdrop_path: string | null }>(`/${type}/${id}`).pipe(
      map((res) => res.backdrop_path),
    );
  }

  // as cenas sem texto por cima primeiro: são as que servem de capa
  getBackdrops(id: number, type: 'movie' | 'tv'): Observable<string[]> {
    return this.get<{ backdrops?: { file_path: string }[] }>(`/${type}/${id}/images`, {
      include_image_language: 'null,pt,en',
    }).pipe(map((res) => (res.backdrops ?? []).map((b) => b.file_path)));
  }

  getContentDetails(id: number, type: 'movie' | 'tv'): Observable<ContentDetails> {
    return type === 'movie' ? this.getMovieDetails(id) : this.getTvDetails(id);
  }

  /**
   * As reviews da TMDB são quase todas em inglês; pedir em pt-BR devolve lista vazia.
   */
  getReviews(id: number, type: 'movie' | 'tv', page = 1): Observable<TmdbListResponse<Review>> {
    const params = new HttpParams().set('language', 'en-US').set('page', String(page));

    return this.http
      .get<TmdbListResponse<Review>>(`${this.baseUrl}/${type}/${id}/reviews`, { params })
      .pipe(catchError(() => of({ page: 1, results: [], total_pages: 0, total_results: 0 })));
  }

  getSeasonDetails(tvId: number, seasonNumber: number): Observable<SeasonDetails> {
    return this.get<SeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
  }

  /** Provedores de streaming do país informado (padrão Brasil). */
  getWatchProviders(details: ContentDetails | null, country = 'BR'): WatchProviderCountry | null {
    return details?.['watch/providers']?.results?.[country] ?? null;
  }

  /** Classificação indicativa brasileira (filme usa release_dates, série usa content_ratings). */
  getCertification(details: ContentDetails | null, country = 'BR'): string {
    if (!details) return '';

    const tvRating = details.content_ratings?.results?.find((r) => r.iso_3166_1 === country);
    if (tvRating?.rating) return tvRating.rating;

    const movieEntry = details.release_dates?.results?.find((r) => r.iso_3166_1 === country);
    const cert = movieEntry?.release_dates?.find((d) => d.certification)?.certification;
    return cert ?? '';
  }

  /**
   * Filmografia relevante da pessoa, de cast e crew juntos.
   *
   * Só cast não serve: diretor e roteirista não aparecem lá, e o que sobra são
   * entrevistas e documentários — o "Conhecido por" do Nolan vinha sem os filmes
   * dele. Entram os papéis de atuação e as funções do próprio ofício da pessoa;
   * aparições como ela mesma, talk show, jornalismo e reality ficam de fora.
   * Um mesmo título creditado duas vezes (dirigiu e escreveu) aparece uma só.
   */
  getPersonCredits(person: PersonDetails | null): PersonCredit[] {
    if (!person) return [];

    const oficio = person.known_for_department;
    const elenco = (person.combined_credits?.cast ?? []).filter(
      (c) => !this.isAparicao(c)
    );
    const equipe = (person.combined_credits?.crew ?? []).filter(
      (c) => c.department === oficio
    );

    const porTitulo = new Map<string, PersonCredit>();

    for (const credito of [...elenco, ...equipe]) {
      if ((credito.genre_ids ?? []).some((id) => GENEROS_SEM_PAPEL.has(id))) continue;
      if (!credito.poster_path) continue;

      const chave = `${credito.media_type}-${credito.id}`;
      const atual = porTitulo.get(chave);
      if (!atual || this.pesoCredito(credito, oficio) > this.pesoCredito(atual, oficio)) {
        porTitulo.set(chave, credito);
      }
    }

    // vote_count, e não popularity: popularity reflete acesso recente
    return [...porTitulo.values()].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  }

  // aparição como si mesmo não é trabalho
  private isAparicao(credit: PersonCredit): boolean {
    return /(self|himself|herself|themselves|ele mesmo|ela mesma)/i.test(
      credit.character ?? ''
    );
  }

  // qual crédito representa melhor o título quando a pessoa aparece duas vezes nele
  private pesoCredito(credit: PersonCredit, oficio: string): number {
    if (credit.department === oficio) return 3;
    if (credit.character) return oficio === 'Acting' ? 2 : 1;
    return 0;
  }

  /**
   * Detalhes de uma pessoa.
   *
   * A TMDB frequentemente não tem biografia em pt-BR para nomes menos
   * conhecidos (volta string vazia), então cai para o inglês em vez de mostrar
   * um espaço em branco. O `language` no extraParams sobrescreve o padrão e
   * entra na chave do cache, então o fallback também é cacheado.
   */
  getPersonDetails(id: number): Observable<PersonDetails> {
    return this.get<PersonDetails>(`/person/${id}`, {
      append_to_response: 'combined_credits,external_ids',
    }).pipe(
      switchMap((person) => {
        if (person.biography?.trim()) return of(person);

        return this.get<PersonDetails>(`/person/${id}`, { language: 'en-US' }).pipe(
          map((fallback) => ({ ...person, biography: fallback.biography ?? '' })),
          catchError(() => of(person))
        );
      })
    );
  }

  getMovieVideos(id: number): Observable<VideoResponse> {
    return this.get<VideoResponse>(`/movie/${id}/videos`);
  }

  getTvVideos(id: number): Observable<VideoResponse> {
    return this.get<VideoResponse>(`/tv/${id}/videos`);
  }

  getMovieImages(id: number): Observable<ImagesResponse> {
    return this.get<ImagesResponse>(`/movie/${id}/images`, {
      include_image_language: 'pt,en,null',
    });
  }

  getTvImages(id: number): Observable<ImagesResponse> {
    return this.get<ImagesResponse>(`/tv/${id}/images`, {
      include_image_language: 'pt,en,null',
    });
  }

  private pickLogoUrl(images: ImagesResponse): string {
    const logos = images?.logos ?? [];
    const ptLogo = logos.find((l) => l.iso_639_1 === 'pt');
    const enLogo = logos.find((l) => l.iso_639_1 === 'en');
    const logo = ptLogo ?? enLogo ?? logos[0];
    return logo ? `${environment.tmdbImageUrl}/original${logo.file_path}` : '';
  }

  getContentImages(id: number, type: 'movie' | 'tv'): Observable<ImagesResponse> {
    return type === 'movie' ? this.getMovieImages(id) : this.getTvImages(id);
  }

  getTrailerUrl(id: number, type: 'movie' | 'tv' = 'movie'): Observable<string> {
    const videosReq = type === 'movie' ? this.getMovieVideos(id) : this.getTvVideos(id);

    return videosReq.pipe(
      switchMap((data) => {
        const trailer = data?.results?.find(
          (v) => v.type === 'Trailer' && v.site === 'YouTube'
        );
        if (trailer) return of(`https://www.youtube-nocookie.com/embed/${trailer.key}`);

        // Fallback: busca em inglês se não encontrar em pt-BR
        let params = new HttpParams().set('language', 'en-US');
        const endpoint = type === 'movie' ? `/movie/${id}/videos` : `/tv/${id}/videos`;
        return this.http.get<VideoResponse>(`${this.baseUrl}${endpoint}`, { params }).pipe(
          map((d) => {
            const t = d?.results?.find((v) => v.type === 'Trailer' && v.site === 'YouTube');
            return t ? `https://www.youtube-nocookie.com/embed/${t.key}` : '#';
          }),
          catchError(() => of('#'))
        );
      }),
      catchError(() => of('#'))
    );
  }

  // string vazia quando não há imagem: quem renderiza troca pelo app-media-fallback
  getImageUrl(path: string | null, size: string = 'w500'): string {
    if (!path) return '';
    return `${environment.tmdbImageUrl}/${size}${path}`;
  }

  /** Monta o destaque a partir de um único /movie/{id} — imagens e vídeos já vêm anexados. */
  private toSpotlight(movie: Movie, details: ContentDetails): SpotlightData {
    const images = details.images ?? ({ backdrops: [], posters: [], logos: [] } as ImagesResponse);
    const trailer = (details.videos?.results ?? []).find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer'
    );

    return {
      movie,
      details,
      backgroundUrl: images.backdrops?.[0]
        ? `${environment.tmdbImageUrl}/original${images.backdrops[0].file_path}`
        : '',
      logoUrl: this.pickLogoUrl(images),
      trailerUrl: trailer ? `https://www.youtube-nocookie.com/embed/${trailer.key}` : '#',
    };
  }

  getSpotlightMovie(): Observable<SpotlightData> {
    return this.getPopularMovies().pipe(
      switchMap((data) => {
        const movie = data.results[0];
        return this.getMovieDetails(movie.id).pipe(
          map((details) => this.toSpotlight(movie, details))
        );
      })
    );
  }

  getSpotlightMovies(count = 5): Observable<SpotlightData[]> {
    return this.getTrendingMovies().pipe(
      switchMap((data) =>
        forkJoin(
          data.results.slice(0, count).map((movie) =>
            this.getMovieDetails(movie.id).pipe(
              map((details) => this.toSpotlight(movie, details))
            )
          )
        )
      )
    );
  }

  // Lista de gêneros
  getGenres(type: 'movie' | 'tv'): Observable<Genre[]> {
    return this.get<{ genres: Genre[] }>(`/genre/${type}/list`).pipe(
      map((data) => data.genres ?? []),
      catchError(() => of([]))
    );
  }

  // Catálogo por gênero. Sem `genreId` devolve o populares geral.
  discover<T>(
    type: 'movie' | 'tv',
    options: {
      genreId?: number | null;
      page?: number;
      params?: Record<string, string | number>;
    } = {}
  ): Observable<TmdbListResponse<T>> {
    const params: Record<string, any> = {
      page: options.page ?? 1,
      sort_by: 'popularity.desc',
      'vote_count.gte': 150,
      include_adult: false,
      ...options.params,
    };

    if (options.genreId) params['with_genres'] = options.genreId;

    return this.get<TmdbListResponse<T>>(`/discover/${type}`, params);
  }

  // Destaque de um título qualquer
  getSpotlight(id: number, type: 'movie' | 'tv'): Observable<Spotlight> {
    return this.getContentDetails(id, type).pipe(
      map((details) => this.toGenericSpotlight(details, type))
    );
  }

  // Monta o destaque a partir de um /movie/{id} ou /tv/{id}
  private toGenericSpotlight(details: ContentDetails, type: 'movie' | 'tv'): Spotlight {
    const images = details.images ?? ({ backdrops: [], posters: [], logos: [] } as ImagesResponse);
    const trailer = (details.videos?.results ?? []).find(
      (v) => v.site === 'YouTube' && v.type === 'Trailer'
    );
    const date = type === 'movie' ? details.release_date : details.first_air_date;

    return {
      id: details.id,
      type,
      title: details.title ?? details.name ?? '',
      overview: details.overview ?? '',
      voteAverage: details.vote_average ?? 0,
      year: date ? String(new Date(date).getFullYear()) : '',
      runtime: details.runtime ?? details.episode_run_time?.[0] ?? null,
      details,
      backgroundUrl: images.backdrops?.[0]
        ? `${environment.tmdbImageUrl}/original${images.backdrops[0].file_path}`
        : '',
      logoUrl: this.pickLogoUrl(images),
      trailerUrl: trailer ? `https://www.youtube-nocookie.com/embed/${trailer.key}` : '#',
    };
  }
}
