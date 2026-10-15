import { Partida, TENTATIVAS } from '../../core/models/jogos.models';

// o dia vira à meia-noite de Brasília (UTC-3, sem horário de verão)
const FUSO_MS = 3 * 3600_000;

export function tempoAteAVirada(agora = Date.now()): string {
  const local = new Date(agora - FUSO_MS);
  const meiaNoite =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) + FUSO_MS;
  const s = Math.max(0, Math.floor((meiaNoite - agora) / 1000));
  const dois = (v: number) => String(v).padStart(2, '0');
  return `${dois(Math.floor(s / 3600))}:${dois(Math.floor(s / 60) % 60)}:${dois(s % 60)}`;
}

// "quinta, 15 de outubro" a partir do YYYY-MM-DD da API
export function dataPorExtenso(dia: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
    .format(new Date(`${dia}T12:00:00Z`))
    .replace('-feira', '');
}

// texto para colar no grupo: erros, o acerto e o que sobrou
export function textoDoResultado(nome: string, p: Partida): string {
  const acertou = p.status === 'WON';
  const erros = acertou ? p.guesses.length - 1 : p.guesses.length;
  const quadros = Array.from({ length: TENTATIVAS }, (_, i) =>
    i < erros ? '⬛' : acertou && i === erros ? '🟩' : '⬜',
  ).join('');
  return `Prisma · ${nome} Nº ${p.number}\n${quadros}  ${acertou ? erros + 1 : 'X'}/${TENTATIVAS}`;
}
