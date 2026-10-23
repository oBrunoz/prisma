import {
  ConteudoCarreira,
  ConteudoDuelo,
  ConteudoLegenda,
  ConteudoLinha,
  CorDaLetra,
  Partida,
  TENTATIVAS,
} from '../../core/models/jogos.models';

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

const COR_DA_LETRA: Record<CorDaLetra, string> = { certo: '🟦', lugar: '🟧', ausente: '⬛' };

// texto para colar no grupo: erros, o acerto e o que sobrou; as dicas aparecem como lâmpadas
export function textoDoResultado(nome: string, p: Partida): string {
  const cabeca = `Prisma · ${nome} Nº ${p.number}`;
  const acertou = p.status === 'WON';
  const lampadas = p.hints.length ? `  ${'💡'.repeat(p.hints.length)}` : '';

  if (p.kind === 'DUELO') {
    const c = p.content as ConteudoDuelo;
    const fios = c.duelos.filter((d) => d.acertou !== null).map((d) => (d.acertou ? '🟩' : '⬛')).join('');
    return `${cabeca}\n${fios}  ${p.score ?? 0}/${c.total}`;
  }
  if (p.kind === 'LINHA') {
    const c = p.content as ConteudoLinha;
    return `${cabeca}\n${c.resultados.map((ok) => (ok ? '🟩' : '⬛')).join('')}  ${p.score ?? 0}/${c.total}`;
  }
  if (p.kind === 'LEGENDA') {
    const c = p.content as ConteudoLegenda;
    const linhas = c.linhas.map((l) => l.cores.map((cor) => COR_DA_LETRA[cor]).join('')).join('\n');
    return `${cabeca}  ${acertou ? c.linhas.length : 'X'}/${TENTATIVAS}${lampadas}\n${linhas}`;
  }
  if (p.kind === 'CARREIRA') {
    const c = p.content as ConteudoCarreira;
    const linhas = c.conferidas.map((r) => r.map((ok) => (ok ? '🟦' : '⬛')).join('')).join('\n');
    return `${cabeca}  ${acertou ? c.conferidas.length : 'X'}/${TENTATIVAS}\n${linhas}`;
  }

  const erros = acertou ? p.guesses.length - 1 : p.guesses.length;
  const quadros = Array.from({ length: TENTATIVAS }, (_, i) =>
    i < erros ? '⬛' : acertou && i === erros ? '🟩' : '⬜',
  ).join('');
  return `${cabeca}\n${quadros}  ${acertou ? erros + 1 : 'X'}/${TENTATIVAS}${lampadas}`;
}
