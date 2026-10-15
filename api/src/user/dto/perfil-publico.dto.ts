import { PublicUserDto } from './public-user.dto.js';

export class PerfilPublicoDto extends PublicUserDto {
  contagem: {
    avaliacoes: number;
    seguidores: number;
    seguindo: number;
  };
}
