import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const SENHA = 'senhaforte123';

describe('User (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let username: string;
  let email: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // o rate limit e por IP e derrubaria a suite inteira
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const carimbo = Date.now();
    username = `perfil_${carimbo}`;
    email = `perfil-${carimbo}@teste.com`;

    const registro = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Perfil E2E', username, email, password: SENHA })
      .expect(201);

    token = registro.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const patch = () => server().patch('/user/me').set('Authorization', `Bearer ${token}`);

  it('exige sessao', async () => {
    await server().patch('/user/me').send({ name: 'Invasor' }).expect(401);
  });

  it('atualiza nome, bio e foto', async () => {
    const res = await patch()
      .send({
        name: 'Nome Novo',
        bio: '  gosto de filmes  ',
        avatarUrl: 'https://exemplo.com/foto.jpg',
      })
      .expect(200);

    expect(res.body.name).toBe('Nome Novo');
    expect(res.body.bio).toBe('gosto de filmes');
    expect(res.body.avatarUrl).toBe('https://exemplo.com/foto.jpg');
    // o e-mail nunca sai na resposta publica
    expect(res.body.email).toBeUndefined();
  });

  it('limpa a foto com string vazia', async () => {
    const res = await patch().send({ avatarUrl: '' }).expect(200);
    expect(res.body.avatarUrl).toBeNull();
  });

  it('recusa avatarUrl que nao e URL', async () => {
    await patch().send({ avatarUrl: 'nao-e-url' }).expect(400);
    await patch().send({ avatarUrl: 'javascript:alert(1)' }).expect(400);
  });

  // o username vira URL e o e-mail e a chave da conta: nenhum dos dois muda por aqui
  it('nao troca username nem e-mail pelo perfil', async () => {
    await patch().send({ username: `renom_${Date.now().toString().slice(-8)}` }).expect(400);
    await patch()
      .send({ email: `novo-${Date.now()}@teste.com`, currentPassword: SENHA })
      .expect(400);

    const eu = await server().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(eu.body.username).toBe(username);
    await server().post('/auth/login').send({ email, password: SENHA }).expect(200);
  });

  it('recusa campo desconhecido', async () => {
    await patch().send({ passwordHash: 'x' }).expect(400);
    await patch().send({ id: 'outro-id' }).expect(400);
  });
});
