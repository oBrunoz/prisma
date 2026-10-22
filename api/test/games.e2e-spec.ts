import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { MediaService } from '../src/media/media.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const SENHA = 'senhaforte123';
// existe na TMDB: e a resposta dos desafios de teste
const FILME = 550;
const OUTRO = 680;
// dias longe da curadoria real, com numeros que ela nunca vai usar
const ONTEM = '2099-03-09';
const HOJE = '2099-03-10';
const AMANHA = '2099-03-11';
const FRAMES = Array.from({ length: 7 }, (_, i) => `/frame${i + 1}.jpg`);

describe('Jogos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const desafios: Record<string, string> = {};

  const server = () => request(app.getHttpServer());
  const jogar = (id: string, guesses: number[], auth = false) => {
    const req = server().post(`/games/${id}/play`).send({ guesses });
    return auth ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    // so o relogio muda: o dia do jogo passa a ser HOJE
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(`${HOJE}T15:00:00Z`) });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    const media = await app.get(MediaService).resolve(FILME, 'MOVIE');
    const criar = async (chave: string, kind: 'FRAMES' | 'POSTER', day: string, number: number) => {
      const d = await prisma.gameChallenge.create({
        data: { kind, day: new Date(day), number, mediaId: media.id, images: kind === 'FRAMES' ? FRAMES : ['/poster.jpg'] },
      });
      desafios[chave] = d.id;
    };
    await criar('ontem', 'FRAMES', ONTEM, 90001);
    await criar('hoje', 'FRAMES', HOJE, 90002);
    await criar('amanha', 'FRAMES', AMANHA, 90003);
    await criar('poster', 'POSTER', HOJE, 90002);

    // o relogio esta congelado, entao o Date.now() repetiria o mesmo nome a cada execucao
    const username = `jogo_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const res = await server()
      .post('/auth/register')
      .send({ name: 'jogo', username, email: `${username}@teste.com`, password: SENHA })
      .expect(201);
    token = res.body.accessToken;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await prisma.gameChallenge.deleteMany({ where: { id: { in: Object.values(desafios) } } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await app.close();
    vi.useRealTimers();
  });

  it('entrega so o desafio do dia, com a primeira imagem e sem resposta', async () => {
    const res = await server().get('/games/today').expect(200);

    expect(res.body.day).toBe(HOJE);
    const frames = res.body.challenges.find((c: { id: string }) => c.id === desafios.hoje);
    expect(frames).toMatchObject({ kind: 'FRAMES', number: 90002, images: [FRAMES[0]], guesses: [], status: 'PLAYING', answer: null });
    // no poster a imagem e uma so desde o comeco
    const poster = res.body.challenges.find((c: { id: string }) => c.id === desafios.poster);
    expect(poster.images).toEqual(['/poster.jpg']);
    expect(res.body.challenges.some((c: { id: string }) => c.id === desafios.amanha)).toBe(false);
  });

  it('libera um frame por erro e a resposta so no acerto', async () => {
    let res = await jogar(desafios.hoje, [OUTRO, 0]).expect(200);
    expect(res.body.images).toEqual(FRAMES.slice(0, 3));
    expect(res.body.answer).toBeNull();

    // palpite depois do acerto nao conta
    res = await jogar(desafios.hoje, [OUTRO, FILME, OUTRO]).expect(200);
    expect(res.body).toMatchObject({ status: 'WON', guesses: [OUTRO, FILME], images: FRAMES });
    expect(res.body.answer).toMatchObject({ tmdbId: FILME, title: expect.any(String) });
  });

  it('perde depois de sete palpites errados', async () => {
    const res = await jogar(desafios.hoje, Array(7).fill(0)).expect(200);
    expect(res.body).toMatchObject({ status: 'LOST', images: FRAMES });
    expect(res.body.answer.tmdbId).toBe(FILME);

    await jogar(desafios.hoje, Array(8).fill(0)).expect(400);
    await jogar(desafios.hoje, [-1]).expect(400);
  });

  it('nao deixa jogar o desafio de amanha', async () => {
    await jogar(desafios.amanha, []).expect(404);
  });

  it('grava a partida de quem esta logado e nao deixa reescrever', async () => {
    await jogar(desafios.hoje, [OUTRO], true).expect(200);

    const hoje = await server().get('/games/today').set('Authorization', `Bearer ${token}`).expect(200);
    const frames = hoje.body.challenges.find((c: { id: string }) => c.id === desafios.hoje);
    expect(frames.guesses).toEqual([OUTRO]);

    // aparelho atrasado recebe o que esta salvo
    const atrasado = await jogar(desafios.hoje, [], true).expect(200);
    expect(atrasado.body.guesses).toEqual([OUTRO]);

    await jogar(desafios.hoje, [0, 0], true).expect(409);

    const ganhou = await jogar(desafios.hoje, [OUTRO, FILME], true).expect(200);
    expect(ganhou.body.status).toBe('WON');

    // terminada, a partida nao muda mais
    const depois = await jogar(desafios.hoje, [OUTRO, 0, 0], true).expect(200);
    expect(depois.body).toMatchObject({ status: 'WON', guesses: [OUTRO, FILME] });
  });

  it('desafio de outro dia mostra o resultado sem gravar', async () => {
    const res = await jogar(desafios.ontem, [FILME], true).expect(200);
    expect(res.body.status).toBe('WON');

    const salva = await prisma.gamePlay.findUnique({
      where: { userId_challengeId: { userId, challengeId: desafios.ontem } },
    });
    expect(salva).toBeNull();
  });

  it('conta a sequencia pelos dias seguidos', async () => {
    await server().get('/games/stats').expect(401);

    // a vitoria de ontem entra direto no banco: pela api so o dia corrente grava
    await prisma.gamePlay.create({
      data: { userId, challengeId: desafios.ontem, guesses: [OUTRO, OUTRO, FILME], result: 'WON' },
    });

    const res = await server().get('/games/stats').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.FRAMES).toEqual({
      played: 2,
      won: 2,
      currentStreak: 2,
      bestStreak: 2,
      distribution: [0, 1, 1, 0, 0, 0, 0, 0],
    });
    expect(res.body.POSTER).toMatchObject({ played: 0, currentStreak: 0 });
  });

  describe('aleatorio', () => {
    const sortear = (query: Record<string, string>) =>
      server().get('/games/random').query(query).set('Authorization', `Bearer ${token}`);

    it('so para quem tem conta, e valida o pedido', async () => {
      await server().get('/games/random').query({ kind: 'FRAMES' }).expect(401);
      await sortear({ kind: 'ELENCO' }).expect(400);
      await sortear({ kind: 'FRAMES', exceto: 'nao-e-id' }).expect(400);
    });

    it('sorteia um desafio de dia passado, sem resposta e sem o que ja terminou', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await sortear({ kind: 'FRAMES' }).expect(200);
        const { challenge } = res.body;
        expect(challenge.day < HOJE).toBe(true);
        expect(challenge).toMatchObject({ kind: 'FRAMES', guesses: [], status: 'PLAYING', answer: null });
        expect(challenge.images).toHaveLength(1);
        // ontem ja foi ganho (teste anterior): so volta quando acabar o resto
        expect(challenge.id).not.toBe(desafios.ontem);
        expect(res.body.repeated).toBe(false);
      }
    });

    it('visto tudo, repete avisando e nao devolve o ultimo sorteado', async () => {
      const antigos = await prisma.gameChallenge.findMany({
        where: { kind: 'FRAMES', day: { lt: new Date(HOJE) }, id: { not: desafios.ontem } },
        select: { id: true },
      });
      const exceto = antigos.map((a) => a.id);

      const res = await sortear({ kind: 'FRAMES', exceto: exceto.join(',') }).expect(200);
      expect(res.body.repeated).toBe(true);
      expect(res.body.challenge.id).not.toBe(exceto.at(-1));
    });

    it('a partida sorteada confere, mas nao grava', async () => {
      const res = await sortear({ kind: 'FRAMES' }).expect(200);
      const id = res.body.challenge.id;
      await jogar(id, [0], true).expect(200);
      const salva = await prisma.gamePlay.findUnique({ where: { userId_challengeId: { userId, challengeId: id } } });
      expect(salva).toBeNull();
    });
  });
});
