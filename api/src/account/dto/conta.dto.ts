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
