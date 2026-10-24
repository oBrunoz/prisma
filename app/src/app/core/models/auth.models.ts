import { Midia, TipoMidia } from './catalogo.models';

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface PerfilPublico extends PublicUser {
  contagem: {
    // só as que têm nota ou texto: marcar assistido não é avaliar
    avaliacoes: number;
    filmes: number;
    series: number;
    seguidores: number;
    seguindo: number;
    notaMedia: number | null;
  };
  // até quatro, na ordem que a pessoa escolheu
  favoritos: Midia[];
  capa: Capa;
}

export type TipoDeCapa = 'favorito' | 'titulo' | 'nenhuma';

// como a foto foi enquadrada no círculo: zoom e deslocamento em diâmetros do círculo
export interface EnquadramentoFoto {
  zoom: number;
  x: number;
  y: number;
  giro: number;
}

// o ponto da cena que fica à vista (%, como object-position) e a aproximação
export interface FocoCapa {
  x: number;
  y: number;
  zoom: number;
}

export const FOCO_PADRAO: FocoCapa = { x: 50, y: 30, zoom: 1 };
export const ZOOM_MAXIMO_CAPA = 2;

// object-cover + o mesmo ponto como origem do scale: o foco nunca sai do quadro
export function estiloDaCapa(foco: FocoCapa): Record<string, string> {
  const ponto = `${foco.x}% ${foco.y}%`;
  return { 'object-position': ponto, 'transform-origin': ponto, transform: `scale(${foco.zoom})` };
}

// com tipo favorito, a cena vem do primeiro favorito e o front busca a imagem
export interface Capa {
  tipo: TipoDeCapa;
  backdropPath: string | null;
  media: Midia | null;
  foco: FocoCapa;
}

export interface EnvioCapa {
  tipo: TipoDeCapa;
  tmdbId?: number;
  mediaType?: TipoMidia;
  backdropPath?: string;
  foco?: FocoCapa;
}

export interface UsuarioResumo {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  contagem: { avaliacoes: number; seguidores: number };
  // só vem com sessão
  seguindo?: boolean;
}

export interface NovosSeguidores {
  total: number;
  // o follow mais recente: é o que volta ao marcar como visto
  ate: string | null;
  recentes: UsuarioResumo[];
}

export interface BuscaUsuarios {
  total: number;
  resultados: UsuarioResumo[];
}

export interface SessionResponse {
  user?: PublicUser;
  accessToken: string;
}

// o username é fixo; e-mail e senha mudam pela ContaService
export interface AtualizacaoPerfil {
  name?: string;
  bio?: string;
  // string vazia tira a foto
  avatarUrl?: string;
}

export interface Credenciais {
  email: string;
  password: string;
}

export interface DadosCadastro extends Credenciais {
  name: string;
  username: string;
}
