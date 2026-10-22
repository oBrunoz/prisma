import { config } from 'dotenv';

config({ quiet: true });

// os e2e criam usuarios de verdade: so rodam num banco declarado para isso, nunca no DATABASE_URL
const banco = process.env.E2E_DATABASE_URL;
if (!banco) {
  throw new Error(
    'Defina E2E_DATABASE_URL no .env (um branch do Neon so para teste) antes de rodar os e2e',
  );
}
process.env.DATABASE_URL = banco;
