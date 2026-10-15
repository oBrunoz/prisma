import type { Media } from '../../generated/prisma/client.js';
import type { TipoDeCapa } from './capa.dto.js';
import { PublicUserDto } from './public-user.dto.js';

export class PerfilPublicoDto extends PublicUserDto {
  contagem: {
    // so as que tem nota ou texto: marcar assistido nao e avaliar
    avaliacoes: number;
    filmes: number;
    series: number;
    seguidores: number;
    seguindo: number;
    notaMedia: number | null;
  };
  favoritos: Media[];
  // com tipo favorito, a imagem vem do primeiro favorito e o front busca a cena
  capa: {
    tipo: TipoDeCapa;
    backdropPath: string | null;
    media: Media | null;
  };
}
