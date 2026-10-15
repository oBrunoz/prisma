export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  character: string;
}

export interface Credits {
  cast: CastMember[];
  crew?: CrewMember[];
}

export interface Movie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: Genre[];
  runtime?: number;
  tagline?: string;
  media_type?: string;
}

export interface TvShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: Genre[];
  episode_run_time?: number[];
  tagline?: string;
  media_type?: string;
}

export interface Person {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  media_type?: string;
}

export type MediaResult = Movie | TvShow | Person;

export interface TmdbListResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  iso_639_1?: string;
  official?: boolean;
  published_at?: string;
}

export interface VideoResponse {
  id: number;
  results: Video[];
}

export interface ImageBackdrop {
  file_path: string;
  iso_639_1?: string | null;
  width: number;
  height: number;
}

export interface ImagesResponse {
  backdrops: ImageBackdrop[];
  posters: ImageBackdrop[];
  logos: ImageBackdrop[];
}

export interface ContentDetails {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  genres?: Genre[];
  tagline?: string;
  media_type?: string;
  credits?: Credits;
  similar?: TmdbListResponse<MediaResult>;
  recommendations?: TmdbListResponse<MediaResult>;
  videos?: VideoResponse;
  images?: ImagesResponse;
  reviews?: TmdbListResponse<Review>;
  keywords?: KeywordsResponse;
  external_ids?: ExternalIds;
  release_dates?: ReleaseDatesResponse;
  content_ratings?: ContentRatingsResponse;
  'watch/providers'?: WatchProvidersResponse;

  status?: string;
  homepage?: string | null;
  original_language?: string;
  budget?: number;
  revenue?: number;
  production_companies?: ProductionCompany[];
  belongs_to_collection?: BelongsToCollection | null;

  networks?: Network[];
  created_by?: CreatedBy[];
  seasons?: Season[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  in_production?: boolean;
  last_episode_to_air?: Episode | null;
  next_episode_to_air?: Episode | null;
}

export interface SpotlightData {
  movie: Movie;
  details: ContentDetails;
  backgroundUrl: string;
  // os tamanhos que cada tela pode pedir (vazio se não houver)
  backgroundSrcset: string;
  trailerUrl: string;
  logoUrl: string;
  logoSrcset: string;
}
export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface Network {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface Keyword {
  id: number;
  name: string;
}

export interface KeywordsResponse {
  keywords?: Keyword[];
  results?: Keyword[];
}

export interface ExternalIds {
  imdb_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
}

export interface ReviewAuthor {
  name: string;
  username: string;
  avatar_path: string | null;
  rating: number | null;
}

export interface Review {
  id: string;
  author: string;
  author_details: ReviewAuthor;
  content: string;
  created_at: string;
  updated_at: string;
  url: string;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface WatchProviderCountry {
  link: string;
  flatrate?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

export interface WatchProvidersResponse {
  id: number;
  results: Record<string, WatchProviderCountry>;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  episode_number: number;
  season_number: number;
  runtime: number | null;
  vote_average: number;
}

export interface Season {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  season_number: number;
  episode_count: number;
  vote_average?: number;
}

export interface SeasonDetails extends Season {
  episodes: Episode[];
}

export interface CreatedBy {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface BelongsToCollection {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface ReleaseDateEntry {
  certification: string;
  release_date: string;
  type: number;
}

export interface ReleaseDatesResponse {
  results: { iso_3166_1: string; release_dates: ReleaseDateEntry[] }[];
}

export interface ContentRatingsResponse {
  results: { iso_3166_1: string; rating: string }[];
}

export interface Spotlight {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  overview: string;
  voteAverage: number;
  year: string;
  runtime: number | null;
  details: ContentDetails;
  backgroundUrl: string;
  backgroundSrcset: string;
  logoUrl: string;
  logoSrcset: string;
  trailerUrl: string;
}

export interface PersonCredit {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  character?: string;
  job?: string;
  department?: string;
  overview?: string;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
  profile_path: string | null;
  also_known_as?: string[];
  homepage?: string | null;
  combined_credits?: { cast: PersonCredit[]; crew?: PersonCredit[] };
  external_ids?: ExternalIds;
}
