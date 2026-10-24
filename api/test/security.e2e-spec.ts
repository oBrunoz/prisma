import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const SENHA = 'senhaforte123';

describe('Segurança (e2e)', () => {
  let app: INestApplication<App>;
  let ana: { token: string; id: string };
  let bob: { token: string; id: string };

  const server = () => request(app.getHttpServer());

  async function registra(nome: string) {
    const res = await server()
      .post('/auth/register')
      .send({
        name: nome,
        username: `${nome.replace(/[^a-z0-9_]/g, '')}${Date.now()}`.slice(0, 20),
        email: `${nome}-${Date.now()}@sec.test`,
        password: SENHA,
      })
      .expect(201);
    return { token: res.body.accessToken, id: res.body.user.id };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    ana = await registra('ana');
    bob = await registra('bob');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('proxy da TMDB', () => {
    it('recusa prefixo fora da allowlist', async () => {
      await server().get('/tmdb/account/123').expect(400);
    });

    // regressao: barra codificada escapava da allowlist e alcancava qualquer endpoint da TMDB
    it('recusa barra codificada no segmento', async () => {
      await server().get('/tmdb/movie/..%2fauthentication%2ftoken%2fnew').expect(400);
      await server().get('/tmdb/movie/%2e%2e%2fauthentication%2ftoken%2fnew').expect(400);
      await server().get('/tmdb/movie/%2e%2e/authentication/token/new').expect(400);
    });

    it('recusa caminho fundo demais', async () => {
      await server().get('/tmdb/movie/1/2/3/4/5/6/7').expect(400);
    });

    it('permite o que o front usa', async () => {
      await server().get('/tmdb/movie/550').expect(200);
    });
  });

  describe('autorização por dono', () => {
    it('impede editar e apagar review de outro usuário', async () => {
      const review = await server()
        .post('/reviews')
        .set('Authorization', `Bearer ${ana.token}`)
        .send({ tmdbId: 550, mediaType: 'movie', rating: 8, content: 'minha' })
        .expect(201);

      await server()
        .patch(`/reviews/${review.body.id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ rating: 1 })
        .expect(403);

      await server()
        .delete(`/reviews/${review.body.id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(403);

      await server()
        .delete(`/reviews/${review.body.id}`)
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(204);
    });

    it('watchlist só enxerga a do próprio usuário', async () => {
      await server()
        .post('/watchlist')
        .set('Authorization', `Bearer ${ana.token}`)
        .send({ tmdbId: 550, mediaType: 'movie' })
        .expect(201);

      const doBob = await server()
        .get('/watchlist')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(doBob.body).toHaveLength(0);
    });
  });

  describe('minha avaliação no título', () => {
    // regressao: achando a propria review na lista publica paginada, salvar de novo apagava o texto
    it('acha a review do usuário mesmo atrás de outras mais novas', async () => {
      const filme = 78;

      await server()
        .post('/reviews')
        .set('Authorization', `Bearer ${ana.token}`)
        .send({ tmdbId: filme, mediaType: 'movie', rating: 7, content: 'texto da ana' })
        .expect(201);

      await server()
        .post('/reviews')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ tmdbId: filme, mediaType: 'movie', rating: 2, content: 'mais nova' })
        .expect(201);

      const paginaPublica = await server()
        .get(`/reviews/media/movie/${filme}?limit=1`)
        .expect(200);
      expect(paginaPublica.body.some((r: { user: { id: string } }) => r.user.id === ana.id)).toBe(
        false,
      );

      const minha = await server()
        .get(`/reviews/me/movie/${filme}`)
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(200);

      expect(minha.body.rating).toBe(7);
      expect(minha.body.content).toBe('texto da ana');
    });

    it('devolve vazio quando o usuário não avaliou', async () => {
      const resposta = await server()
        .get('/reviews/me/movie/12345')
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(200);

      expect(resposta.body).toEqual({});
    });

    it('exige autenticação', async () => {
      await server().get('/reviews/me/movie/550').expect(401);
    });
  });

  describe('limites de entrada', () => {
    // regressao: tmdbId acima de int4 estourava no Postgres e virava 500
    it('tmdbId acima do int4 vira 400, não 500', async () => {
      await server().get('/reviews/media/movie/999999999999999999').expect(400);
      await server()
        .post('/watchlist')
        .set('Authorization', `Bearer ${ana.token}`)
        .send({ tmdbId: 9999999999, mediaType: 'movie' })
        .expect(400);
    });

    it('respeita limit e recusa limit absurdo', async () => {
      await server()
        .get('/watchlist?limit=1')
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(200);

      await server()
        .get('/watchlist?limit=100000')
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(400);
    });
  });

  describe('exposição de dados', () => {
    it('listagens públicas não trazem e-mail nem hash', async () => {
      const reviews = await server().get('/reviews/media/movie/550').expect(200);
      const perfil = await server().get(`/user/${ana.id}`).expect(200);

      const bruto = JSON.stringify([reviews.body, perfil.body]);
      expect(bruto).not.toContain('passwordHash');
      expect(bruto).not.toContain('@sec.test');
    });
  });

  describe('forja de token', () => {
    it('recusa alg:none', async () => {
      const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
        'base64url',
      );
      const corpo = Buffer.from(
        JSON.stringify({ sub: ana.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString('base64url');

      await server()
        .get('/auth/me')
        .set('Authorization', `Bearer ${cabecalho}.${corpo}.`)
        .expect(401);
    });
  });
});
