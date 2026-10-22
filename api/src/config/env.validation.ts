import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsInt()
  PORT: number;

  // quantos proxies ficam entre a internet e a API (padrao 1)
  @IsOptional()
  @IsInt()
  TRUST_PROXY?: number;

  // cabecalho com o IP real do visitante, ex.: cf-connecting-ip atras da Cloudflare
  @IsOptional()
  @IsString()
  CLIENT_IP_HEADER?: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  TMDB_API_KEY: string;

  // no desenvolvimento aponta para o Mailpit, que nao pede usuario nem senha
  @IsString()
  @IsNotEmpty()
  SMTP_HOST: string;

  @IsInt()
  SMTP_PORT: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM: string;
}

export function validate(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    const detalhes = errors
      .map(
        (e) =>
          `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`,
      )
      .join('\n');
    throw new Error(`Variaveis de ambiente invalidas:\n${detalhes}`);
  }

  return config;
}
