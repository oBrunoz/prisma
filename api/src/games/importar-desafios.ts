import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import {
  DesafiosDoArquivo,
  ImportacaoDeDesafiosService,
} from './importacao-de-desafios.service.js';

// grava os desafios da curadoria: npm run jogos:importar [-- caminho.json]
const caminho = process.argv[2] ?? 'prisma/jogos/desafios.json';

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});

try {
  const arquivo = JSON.parse(
    await readFile(caminho, 'utf8'),
  ) as DesafiosDoArquivo;
  const feitos = await app.get(ImportacaoDeDesafiosService).importar(arquivo);
  for (const d of feitos) {
    console.log(`${d.kind.padEnd(6)} ${d.day}  Nº ${d.number}  ${d.title}`);
  }
} finally {
  await app.close();
}
