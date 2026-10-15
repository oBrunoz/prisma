import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const SENHA = 'senhaforte123';

interface Conta {
  id: string;
  username: string;
  token: string;
}

describe('Perfil publico e follow (e2e)', () => {
  let app: INestApplication<App>;
  let ana: Conta;
  let beto: Conta;

  const server = () => request(app.getHttpServer());

  async function registrar(prefixo: string): Promise<Conta> {
    // o username tem teto de 20 caracteres: sufixo curto
    const carimbo = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
    const username = `${prefixo}_${carimbo}`;
    const res = await server()
      .post('/auth/register')
      .send({
        name: prefixo,
        username,
        email: `${username}@teste.com`,
        password: SENHA,
      })
      .expect(201);

    return { id: res.body.user.id, username, token: res.body.accessToken };
  }

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

    ana = await registrar('ana');
    beto = await registrar('beto');
  });

  afterAll(async () => {
    await app.close();
  });

  it('abre o perfil pelo username, sem sessao', async () => {
    const res = await server().get(`/user/username/${ana.username.toUpperCase()}`).expect(200);

    expect(res.body.id).toBe(ana.id);
    expect(res.body.contagem).toEqual({ avaliacoes: 0, seguidores: 0, seguindo: 0 });
    expect(res.body.email).toBeUndefined();
  });

  it('responde 404 para username que nao existe', async () => {
    await server().get('/user/username/ninguem_aqui_xyz').expect(404);
  });

  it('status exige sessao', async () => {
    await server().get(`/follow/${ana.id}/status`).expect(401);
  });

  it('segue, conta e deixa de seguir', async () => {
    const comoBeto = (req: request.Test) => req.set('Authorization', `Bearer ${beto.token}`);

    let status = await comoBeto(server().get(`/follow/${ana.id}/status`)).expect(200);
    expect(status.body).toEqual({ seguindo: false });

    await comoBeto(server().post(`/follow/${ana.id}`)).expect(204);

    status = await comoBeto(server().get(`/follow/${ana.id}/status`)).expect(200);
    expect(status.body).toEqual({ seguindo: true });

    const perfil = await server().get(`/user/username/${ana.username}`).expect(200);
    expect(perfil.body.contagem.seguidores).toBe(1);

    const seguidores = await server().get(`/follow/${ana.id}/followers`).expect(200);
    expect(seguidores.body[0].username).toBe(beto.username);

    await comoBeto(server().delete(`/follow/${ana.id}`)).expect(204);

    status = await comoBeto(server().get(`/follow/${ana.id}/status`)).expect(200);
    expect(status.body).toEqual({ seguindo: false });
  });

  it('busca usuarios pelo username, com ou sem @', async () => {
    const trecho = ana.username.slice(0, 8);

    const res = await server().get('/user/search').query({ q: trecho.toUpperCase() }).expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const achada = res.body.resultados.find((u: { id: string }) => u.id === ana.id);
    expect(achada.username).toBe(ana.username);
    expect(achada.contagem).toEqual({ avaliacoes: 0, seguidores: 0 });
    // visitante nao recebe o campo
    expect(achada.seguindo).toBeUndefined();
    expect(achada.email).toBeUndefined();

    const comArroba = await server().get('/user/search').query({ q: `@${ana.username}` }).expect(200);
    expect(comArroba.body.resultados[0].id).toBe(ana.id);

    await server().get('/user/search').query({ q: '' }).expect(400);
  });

  it('marca quem eu sigo na busca e nas listas', async () => {
    const auth = { Authorization: `Bearer ${beto.token}` };
    await server().post(`/follow/${ana.id}`).set(auth).expect(204);

    const busca = await server().get('/user/search').query({ q: ana.username }).set(auth).expect(200);
    expect(busca.body.resultados[0].seguindo).toBe(true);

    const seguindo = await server().get(`/follow/${beto.id}/following`).set(auth).expect(200);
    expect(seguindo.body[0]).toMatchObject({ id: ana.id, seguindo: true });

    await server().delete(`/follow/${ana.id}`).set(auth).expect(204);
  });

  it('token invalido na rota publica vira 401, para o front renovar', async () => {
    await server()
      .get('/user/search')
      .query({ q: 'ana' })
      .set('Authorization', 'Bearer token-vencido')
      .expect(401);
  });
});
