import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class BuscaUsuarioQueryDto extends PaginationDto {
  // o "@" e so o jeito de pedir usuarios na busca: nao faz parte do username
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  q: string;
}
