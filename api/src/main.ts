import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // sem isso o req.ip atras do balanceador e sempre o mesmo e o rate limit vira um balde unico
  if (config.getOrThrow<string>('NODE_ENV') === 'production') {
    app.set('trust proxy', config.get<number>('TRUST_PROXY') ?? 1);
  }

  // cabecalho que o cliente nao forja: so ligar onde nada chega na API sem passar pela Cloudflare
  const cabecalhoDoIp = config.get<string>('CLIENT_IP_HEADER')?.toLowerCase();
  if (cabecalhoDoIp) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const ip = req.get(cabecalhoDoIp);
      if (ip) Object.defineProperty(req, 'ip', { value: ip.trim() });
      next();
    });
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
