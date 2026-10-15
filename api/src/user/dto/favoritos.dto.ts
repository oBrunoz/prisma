import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { MediaRefDto } from '../../media/dto/media-ref.dto.js';

export const MAX_FAVORITOS = 4;

// a lista inteira, na ordem: o backend substitui, e lista vazia limpa
export class FavoritosDto {
  @IsArray()
  @ArrayMaxSize(MAX_FAVORITOS)
  @ValidateNested({ each: true })
  @Type(() => MediaRefDto)
  itens: MediaRefDto[];
}
