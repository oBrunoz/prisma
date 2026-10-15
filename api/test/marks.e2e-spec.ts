import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const SENHA = 'senhaforte123';

// ids estáveis na TMDB: Clube da Luta, Pulp Fiction e Breaking Bad
const CLUBE = 550;
const PULP = 680;
const BREAKING = 1396;

describe('Marks (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

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

    const registro = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Marks E2E',
        username: `mrk_${Date.now()}`,
        email: `marks-${Date.now()}@teste.com`,
        password: SENHA,
      })
      .expect(201);

    token = registro.body.accessToken;
  });

  afterAll(async () => {
    // nao deixa a ficha deste usuario poluindo as estatisticas do titulo
    await autenticado().post('/reviews').send({ tmdbId: CLUBE, mediaType: 'movie' });
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const autenticado = () => ({
    post: (rota: string) => server().post(rota).set('Authorization', `Bearer ${token}`),
    get: (rota: string) => server().get(rota).set('Authorization', `Bearer ${token}`),
  });

  it('exige login', async () => {
    await server().get(`/marks?titles=movie-${CLUBE}`).expect(401);
  });

  it('devolve assistido, curtido e watchlist de varios titulos de uma vez', async () => {
    await autenticado()
      .post('/reviews')
      .send({ tmdbId: CLUBE, mediaType: 'movie', liked: true, watched: true })
      .expect(201);
    await autenticado().post('/watchlist').send({ tmdbId: BREAKING, mediaType: 'tv' }).expect(201);

    const res = await autenticado()
      .get(`/marks?titles=movie-${CLUBE},movie-${PULP},tv-${BREAKING}`)
      .expect(200);

    // Pulp Fiction nao tem marca: fica de fora
    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual({
      tmdbId: CLUBE,
      mediaType: 'MOVIE',
      watched: true,
      liked: true,
      watchlist: false,
    });
    expect(res.body).toContainEqual({
      tmdbId: BREAKING,
      mediaType: 'TV',
      watched: false,
      liked: false,
      watchlist: true,
    });

    await server()
      .delete(`/watchlist/tv/${BREAKING}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('nao confunde filme e serie com o mesmo id', async () => {
    const res = await autenticado().get(`/marks?titles=tv-${CLUBE}`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('recusa lista mal formada ou grande demais', async () => {
    await autenticado().get('/marks?titles=filme-550').expect(400);
    await autenticado().get('/marks').expect(400);

    const muitos = Array.from({ length: 61 }, (_, i) => `movie-${i + 1}`).join(',');
    await autenticado().get(`/marks?titles=${muitos}`).expect(400);
  });
});
