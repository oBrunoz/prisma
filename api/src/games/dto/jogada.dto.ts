import { ArrayMaxSize, IsArray, IsInt, Max, Min } from 'class-validator';
import { TENTATIVAS } from '../games.constants.js';

// teto do int4 do Postgres: acima disso a query estoura no banco
const MAX_INT4 = 2_147_483_647;

export class JogadaDto {
  // tmdbId de cada palpite na ordem; 0 e um pulo
  @IsArray()
  @ArrayMaxSize(TENTATIVAS)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MAX_INT4, { each: true })
  guesses: number[];
}
