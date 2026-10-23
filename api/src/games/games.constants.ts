import { GameKind } from '../generated/prisma/enums.js';

export const TENTATIVAS = 7;

// o dia vira a meia-noite de Brasilia para todo mundo
export const FUSO_DO_JOGO = 'America/Sao_Paulo';

// palpite que so passa a vez
export const PULO = 0;

// os jogos que pedem conta; o front marca os mesmos com soComConta (jogos.models.ts)
export const SO_COM_CONTA: GameKind[] = [
  GameKind.POSTER,
  GameKind.LETREIRO,
  GameKind.LEGENDA,
  GameKind.CARREIRA,
  GameKind.LINHA,
];

// dia corrente no fuso do jogo, como YYYY-MM-DD
export function diaDoJogo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DO_JOGO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}
