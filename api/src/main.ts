import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // sem isso o req.ip atras do balanceador e sempre o mesmo, e o rate limit
  // vira um balde unico para todo mundo; com o proxy da Cloudflare na frente sao 2 saltos
  if (config.getOrThrow<string>('NODE_ENV') === 'production') {
    app.set('trust proxy', config.get<number>('TRUST_PROXY') ?? 1);
  }

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGIN')
      .split(',')
      .map((origem) => origem.trim()),
    credentials: true,
  });

  // o deploy encerra com SIGTERM; assim a conexao com o banco fecha direito
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  console.log(`API na porta ${port}`);
}

await bootstrap();
