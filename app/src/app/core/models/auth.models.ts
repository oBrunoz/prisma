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
    avaliacoes: number;
    seguidores: number;
    seguindo: number;
  };
}

// o jeito curto de mostrar alguém: busca, seguidores, seguindo
export interface UsuarioResumo {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  contagem: { avaliacoes: number; seguidores: number };
  // só vem com sessão
  seguindo?: boolean;
}

export interface BuscaUsuarios {
  total: number;
  resultados: UsuarioResumo[];
}

export interface SessionResponse {
  user?: PublicUser;
  accessToken: string;
}

export interface AtualizacaoPerfil {
  name?: string;
  username?: string;
  email?: string;
  bio?: string;
  // string vazia tira a foto
  avatarUrl?: string;
  currentPassword?: string;
}

export interface Credenciais {
  email: string;
  password: string;
}

export interface DadosCadastro extends Credenciais {
  name: string;
  username: string;
}
