import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

const SENHA = 'senhaforte123';
// o mesmo titulo do spec de reviews: existe na TMDB
const FILME = 550;
const OUTRO_FILME = 27205;

describe('Foto enviada e capa do perfil (e2e)', () => {
  let app: INestApplication<App>;
  let id: string;
  let username: string;
  let token: string;

  const server = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

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

    username = `midia_${Date.now().toString().slice(-8)}`;
    const res = await server()
      .post('/auth/register')
      .send({ name: 'Midia E2E', username, email: `${username}@teste.com`, password: SENHA })
      .expect(201);
    id = res.body.user.id;
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('foto', () => {
    const enviar = (conteudo: Buffer, nome = 'foto.png') =>
      server().post('/user/me/avatar').set(auth()).attach('foto', conteudo, nome);

    it('exige sessao', async () => {
      const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#e63946' } })
        .png()
        .toBuffer();
      await server().post('/user/me/avatar').attach('foto', png, 'foto.png').expect(401);
    });

    it('regrava como webp quadrado e serve para outra origem', async () => {
      const png = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#2880a8' } })
        .png()
        .toBuffer();

      const res = await enviar(png).expect(201);
      expect(res.body.avatarUrl).toMatch(new RegExp(`^/user/${id}/avatar\\?v=\\d+$`));

      const foto = await server().get(`/user/${id}/avatar`).buffer(true).expect(200);
      expect(foto.headers['content-type']).toBe('image/webp');
      expect(foto.headers['cross-origin-resource-policy']).toBe('cross-origin');
      const meta = await sharp(foto.body as Buffer).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 320, height: 320 });
    });

    it('recusa o que nao e imagem, mesmo com nome de imagem', async () => {
      await enviar(Buffer.from('nao sou uma imagem'), 'foto.png').expect(400);
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      await enviar(svg, 'foto.svg').expect(400);
    });

    it('recusa arquivo acima de 5 MB', async () => {
      await enviar(Buffer.alloc(5 * 1024 * 1024 + 1, 1)).expect(413);
    });

    it('tira a foto e apaga o arquivo guardado', async () => {
      const res = await server().delete('/user/me/avatar').set(auth()).expect(200);
      expect(res.body.avatarUrl).toBeNull();
      await server().get(`/user/${id}/avatar`).expect(404);
    });
  });

  describe('capa', () => {
    const capa = () => server().put('/user/me/cover').set(auth());
    const perfil = async () => (await server().get(`/user/username/${username}`).expect(200)).body;

    it('comeca no primeiro favorito', async () => {
      expect((await perfil()).capa).toEqual({
        tipo: 'favorito',
        backdropPath: null,
        media: null,
        foco: { x: 50, y: 30, zoom: 1 },
      });
    });

    it('aceita uma cena do titulo e guarda o credito', async () => {
      // a mesma lista que a tela de escolha pede, com cenas sem texto
      const imagens = await server()
        .get(`/tmdb/movie/${FILME}/images`)
        .query({ include_image_language: 'null,pt,en' })
        .expect(200);
      const cena: string = imagens.body.backdrops.at(-1).file_path;

      await capa().send({ tipo: 'titulo', tmdbId: FILME, mediaType: 'movie', backdropPath: cena }).expect(200);

      const atual = (await perfil()).capa;
      expect(atual.tipo).toBe('titulo');
      expect(atual.backdropPath).toBe(cena);
      expect(atual.media.tmdbId).toBe(FILME);
    });

    it('recusa cena de outro titulo e caminho que nao e da TMDB', async () => {
      const imagens = await server().get(`/tmdb/movie/${OUTRO_FILME}/images`).expect(200);
      const deOutro: string = imagens.body.backdrops[0].file_path;

      await capa().send({ tipo: 'titulo', tmdbId: FILME, mediaType: 'movie', backdropPath: deOutro }).expect(400);
      await capa()
        .send({ tipo: 'titulo', tmdbId: FILME, mediaType: 'movie', backdropPath: '/../../etc/passwd' })
        .expect(400);
      await capa().send({ tipo: 'titulo', tmdbId: FILME, mediaType: 'movie' }).expect(400);
    });

    it('guarda o enquadramento e volta ao padrao sem ele', async () => {
      const foco = { x: 72.5, y: 40, zoom: 1.4 };
      await capa().send({ tipo: 'favorito', foco }).expect(200);
      expect((await perfil()).capa.foco).toEqual(foco);

      await capa().send({ tipo: 'favorito' }).expect(200);
      expect((await perfil()).capa.foco).toEqual({ x: 50, y: 30, zoom: 1 });
    });

    it('recusa enquadramento fora da cena', async () => {
      await capa().send({ tipo: 'favorito', foco: { x: 120, y: 40, zoom: 1 } }).expect(400);
      await capa().send({ tipo: 'favorito', foco: { x: 50, y: 40, zoom: 5 } }).expect(400);
      await capa().send({ tipo: 'favorito', foco: { x: 50, y: 40 } }).expect(400);
    });

    it('volta para as listras ou para o favorito', async () => {
      await capa().send({ tipo: 'nenhuma' }).expect(200);
      expect((await perfil()).capa.tipo).toBe('nenhuma');

      await capa().send({ tipo: 'favorito' }).expect(200);
      expect((await perfil()).capa.tipo).toBe('favorito');
    });

    it('exige sessao', async () => {
      await server().put('/user/me/cover').send({ tipo: 'nenhuma' }).expect(401);
    });
  });
});
