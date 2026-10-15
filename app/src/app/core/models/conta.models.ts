export interface TrocaPendente {
  email: string;
  expiraEm: string;
  // antes disso a API recusa o reenvio
  reenvioEm: string;
}

// o que só a própria pessoa vê; nada daqui sai no perfil público
export interface Conta {
  email: string;
  sessoes: number;
  trocaDeEmail: TrocaPendente | null;
}
