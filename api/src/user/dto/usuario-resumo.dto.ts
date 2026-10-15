export const SELECT_RESUMO = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
  _count: { select: { reviews: true, followers: true } },
} as const;

export interface UsuarioResumoDto {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  contagem: { avaliacoes: number; seguidores: number };
  // so vem quando ha sessao
  seguindo?: boolean;
}

export interface BuscaUsuariosDto {
  total: number;
  resultados: UsuarioResumoDto[];
}

interface LinhaResumo {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  _count: { reviews: number; followers: number };
}

export function paraResumo(linha: LinhaResumo): UsuarioResumoDto {
  return {
    id: linha.id,
    username: linha.username,
    avatarUrl: linha.avatarUrl,
    bio: linha.bio,
    contagem: {
      avaliacoes: linha._count.reviews,
      seguidores: linha._count.followers,
    },
  };
}
