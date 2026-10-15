import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsPositive,
  Matches,
  Max,
  ValidateIf,
} from 'class-validator';
import { MediaType } from '../../generated/prisma/enums.js';

export const TIPOS_DE_CAPA = ['favorito', 'titulo', 'nenhuma'] as const;
export type TipoDeCapa = (typeof TIPOS_DE_CAPA)[number];

// teto do int4 do Postgres: acima disso a query estoura no banco
const MAX_INT4 = 2_147_483_647;

const eTitulo = (dto: CapaDto) => dto.tipo === 'titulo';

export class CapaDto {
  @IsIn(TIPOS_DE_CAPA)
  tipo: TipoDeCapa;

  @ValidateIf(eTitulo)
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(MAX_INT4)
  tmdbId?: number;

  @ValidateIf(eTitulo)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(MediaType)
  mediaType?: MediaType;

  // so o nome do arquivo na TMDB; o servidor confere se e cena desse titulo
  @ValidateIf(eTitulo)
  @Matches(/^\/[A-Za-z0-9_-]{1,64}\.(jpg|png)$/)
  backdropPath?: string;
}
