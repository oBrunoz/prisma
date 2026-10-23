import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// as palavras que a Legenda aceita (5 a 8 letras, sem acento), lidas uma vez; fora delas só o título do dia
const ARQUIVO = join(process.cwd(), 'prisma', 'jogos', 'palavras.txt');

let lista: Set<string> | null = null;

export function palavraAceita(palavra: string): boolean {
  lista ??= new Set(
    readFileSync(ARQUIVO, 'utf8')
      .split(/\r?\n/)
      .filter((linha) => linha && !linha.startsWith('#')),
  );
  return lista.has(palavra);
}
