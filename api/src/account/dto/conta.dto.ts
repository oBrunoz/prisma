export class TrocaPendenteDto {
  email: string;
  expiraEm: Date;
  // antes disso o reenvio e recusado
  reenvioEm: Date;
}

// o que so a propria pessoa ve: nada daqui entra no perfil publico
export class ContaDto {
  email: string;
  sessoes: number;
  trocaDeEmail: TrocaPendenteDto | null;
}

interface TituloExportado {
  tmdbId: number;
  tipo: string;
  titulo: string;
}

// a copia que a pessoa baixa em Configuracoes > Conta: tudo que o banco guarda
// dela, menos senha e sessoes, que sao hashes e nao dizem nada
export class ExportacaoDto {
  exportadoEm: Date;
  conta: {
    nome: string;
    usuario: string;
    email: string;
    bio: string | null;
    criadaEm: Date;
    temFoto: boolean;
    capa: {
      tipo: string;
      titulo: TituloExportado | null;
      imagem: string | null;
    };
  };
  favoritos: TituloExportado[];
  avaliacoes: (TituloExportado & {
    nota: number | null;
    resenha: string | null;
    curtido: boolean;
    assistidoEm: Date | null;
    criadaEm: Date;
  })[];
  watchlist: (TituloExportado & { adicionadoEm: Date })[];
  seguindo: { usuario: string; desde: Date }[];
  seguidores: { usuario: string; desde: Date }[];
  // so o tmdbId de cada palpite (0 = pulo): a resposta de partida em aberto nao sai
  partidas: {
    jogo: string;
    desafio: number;
    dia: Date;
    palpites: number[];
    resultado: string | null;
  }[];
}
