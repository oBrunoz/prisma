import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TENTATIVAS } from '../games.constants.js';
import { FILMES_DA_CARREIRA, MAX_DICAS } from '../games.regras.js';

// teto do int4 do Postgres: acima disso a query estoura no banco
const MAX_INT4 = 2_147_483_647;

export class JogadaDto {
  // tmdbId de cada palpite na ordem (0 e um pulo); duelo: o escolhido; linha: a vaga; carreira: as ordens em fila
  @IsArray()
  @ArrayMaxSize(TENTATIVAS * FILMES_DA_CARREIRA)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MAX_INT4, { each: true })
  guesses: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TENTATIVAS)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  words?: string[];

  // letreiro e legenda: pista, letra (a API escolhe) ou letra:X (já escolhida antes)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DICAS)
  @Matches(/^(pista|letra|letra:[A-Z0-9]|letra:\d)$/, { each: true })
  hints?: string[];
}
