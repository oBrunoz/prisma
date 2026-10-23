// sobe API, front e Mailpit num terminal so: npm run dev (na raiz). Ctrl+C encerra os tres
import concurrently from 'concurrently';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MAILPIT = join(homedir(), 'bin', process.platform === 'win32' ? 'mailpit.exe' : 'mailpit');

// o Mailpit pode ja estar aberto por fora; ai so aproveita
const portaLivre = (porta) =>
  new Promise((resolve) => {
    const teste = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => teste.close(() => resolve(true)))
      .listen(porta, '127.0.0.1');
  });

const comandos = [
  { name: 'api', command: 'npm run start:dev', cwd: 'api', prefixColor: 'magenta' },
  { name: 'app', command: 'npm start', cwd: 'app', prefixColor: 'cyan' },
];

if (!existsSync(MAILPIT)) {
  console.log(`Mailpit nao encontrado em ${MAILPIT}: os e-mails da API vao falhar.`);
} else if (await portaLivre(1025)) {
  // so nesta maquina: sem isso a caixa de e-mails fica aberta para a rede
  comandos.push({
    name: 'mail',
    command: `"${MAILPIT}" --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025`,
    prefixColor: 'yellow',
  });
} else {
  console.log('Mailpit ja esta rodando: aproveitando.');
}

console.log('front  http://localhost:4200');
console.log('api    http://localhost:3000');
console.log('e-mail http://localhost:8025\n');

const { result } = concurrently(comandos, { prefix: 'name' });
// Ctrl+C encerra todos de proposito; nao e erro
result.catch(() => {});
