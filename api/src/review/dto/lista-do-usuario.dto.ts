import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export const FILTROS_DO_USUARIO = ['diario', 'escritas'] as const;

export class ListaDoUsuarioDto extends PaginationDto {
  // diario: o que foi assistido, pela data; escritas: so as com nota ou texto
  @IsOptional()
  @IsIn(FILTROS_DO_USUARIO)
  filtro?: (typeof FILTROS_DO_USUARIO)[number];
}
