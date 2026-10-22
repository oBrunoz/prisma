import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// generate roda no build sem banco; migrate cobra a URL na hora de conectar
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
