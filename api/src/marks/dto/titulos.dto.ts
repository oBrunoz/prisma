import { Matches } from 'class-validator';

// uma fileira ou uma página de grade cabe com folga; acima disso é abuso
export const MAX_TITULOS = 60;

// "movie-550,tv-1399": tipo e id da TMDB, separados por vírgula; nove dígitos não estouram o int4
export class TitulosDto {
  @Matches(new RegExp(`^(movie|tv)-\\d{1,9}(,(movie|tv)-\\d{1,9}){0,${MAX_TITULOS - 1}}$`), {
    message: `titles deve listar até ${MAX_TITULOS} títulos no formato movie-550,tv-1399`,
  })
  titles: string;
}
