import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';
import type { Mensagem } from '../src/mail/mail.templates.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const SENHA = 'senhaforte123';

// guarda os e-mails em vez de mandar: o teste le o codigo daqui
class CarteiroFalso {
  enviados: { para: string; mensagem: Mensagem }[] = [];
  falhar = false;

  enviar(para: string, mensagem: Mensagem): Promise<void> {
    if (this.falhar) return Promise.reject(new Error('smtp fora do ar'));
    this.enviados.push({ para, mensagem });
    return Promise.resolve();
  }

  avisar(para: string, mensagem: Mensagem): void {
    this.enviados.push({ para, mensagem });
  }

  ultimoPara(para: string): Mensagem | undefined {
    return this.enviados.filter((e) => e.para === para).at(-1)?.mensagem;
  }

  codigoPara(para: string): string {
    const texto = this.ultimoPara(para)?.text ?? '';
    return (texto.match(/(\d{3}) (\d{3})/) ?? []).slice(1).join('');
  }
}

interface Conta {
  email: string;
  token: string;
  cookie: string[];
}

describe('Account (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const carteiro = new CarteiroFalso();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // o guard do limite e global (APP_GUARD), e o overrideGuard nao chega
      // nele; esta suite cadastra e entra bem mais que 5 vezes por minuto
      .overrideProvider(getOptionsToken())
      .useValue({ throttlers: [{ ttl: 60_000, limit: 1 }], skipIf: () => true })
      .overrideProvider(MailService)
      .useValue(carteiro)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const como = (conta: Conta) => ({
    get: (url: string) =>
      server().get(url).set('Authorization', `Bearer ${conta.token}`),
    post: (url: string) =>
      server().post(url).set('Authorization', `Bearer ${conta.token}`),
    patch: (url: string) =>
      server().patch(url).set('Authorization', `Bearer ${conta.token}`),
    delete: (url: string) =>
      server().delete(url).set('Authorization', `Bearer ${conta.token}`),
  });

  let sequencia = 0;
  async function novaConta(): Promise<Conta> {
    const carimbo = `${Date.now().toString().slice(-7)}${sequencia++}`;
    const email = `conta-${carimbo}@teste.com`;
    const res = await server()
      .post('/auth/register')
      .send({
        name: 'Conta E2E',
        username: `conta_${carimbo}`,
        email,
        password: SENHA,
      })
      .expect(201);
    return {
      email,
      token: res.body.accessToken,
      cookie: res.headers['set-cookie'] as unknown as string[],
    };
  }

  async function entrar(email: string, senha = SENHA): Promise<Conta> {
    const res = await server()
      .post('/auth/login')
      .send({ email, password: senha })
      .expect(200);
    return {
      email,
      token: res.body.accessToken,
      cookie: res.headers['set-cookie'] as unknown as string[],
    };
  }

  const renovar = (conta: Conta) =>
    server().post('/auth/refresh').set('Cookie', conta.cookie);

  it('exige sessao', async () => {
    await server().get('/account').expect(401);
    await server()
      .post('/account/email')
      .send({ email: 'a@b.com', currentPassword: SENHA })
      .expect(401);
  });

  it('mostra o e-mail e as sessoes so para a propria pessoa', async () => {
    const conta = await novaConta();
    const res = await como(conta).get('/account').expect(200);
    expect(res.body).toEqual({
      email: conta.email,
      sessoes: 1,
      trocaDeEmail: null,
    });
  });

  describe('troca de e-mail', () => {
    it('recusa senha errada, o mesmo e-mail e um e-mail de outra conta', async () => {
      const conta = await novaConta();
      const outra = await novaConta();
      const novo = `novo-${Date.now()}@teste.com`;

      await como(conta)
        .post('/account/email')
        .send({ email: novo, currentPassword: 'senhaerrada123' })
        .expect(403);
      await como(conta)
        .post('/account/email')
        .send({ email: conta.email, currentPassword: SENHA })
        .expect(400);
      await como(conta)
        .post('/account/email')
        .send({ email: outra.email, currentPassword: SENHA })
        .expect(409);
      expect(carteiro.ultimoPara(novo)).toBeUndefined();
    });

    it('so troca depois do codigo, encerra as outras sessoes e avisa o endereco antigo', async () => {
      const conta = await novaConta();
      const outroAparelho = await entrar(conta.email);
      const novo = `trocado-${Date.now()}@teste.com`;

      const pedido = await como(conta)
        .post('/account/email')
        .send({ email: novo.toUpperCase(), currentPassword: SENHA })
        .expect(202);
      expect(pedido.body.email).toBe(novo);

      // enquanto o codigo nao volta, nada mudou
      await server()
        .post('/auth/login')
        .send({ email: conta.email, password: SENHA })
        .expect(200);
      const resumo = await como(conta).get('/account').expect(200);
      expect(resumo.body.email).toBe(conta.email);
      expect(resumo.body.trocaDeEmail.email).toBe(novo);

      const codigo = carteiro.codigoPara(novo);
      expect(codigo).toMatch(/^\d{6}$/);

      const confirmado = await como(conta)
        .post('/account/email/confirm')
        .send({ code: codigo })
        .expect(200);
      expect(confirmado.body.accessToken).toEqual(expect.any(String));
      expect(confirmado.body.user.email).toBeUndefined();
      expect(confirmado.headers['set-cookie'][0]).toContain('HttpOnly');

      await server()
        .post('/auth/login')
        .send({ email: novo, password: SENHA })
        .expect(200);
      await server()
        .post('/auth/login')
        .send({ email: conta.email, password: SENHA })
        .expect(401);

      await renovar(outroAparelho).expect(401);
      await renovar({
        ...conta,
        cookie: confirmado.headers['set-cookie'] as unknown as string[],
      }).expect(200);

      expect(carteiro.ultimoPara(conta.email)?.subject).toContain('mudou');
      expect(carteiro.ultimoPara(conta.email)?.text).not.toContain(novo);
    });

    it('cancela o pedido depois de cinco codigos errados', async () => {
      const conta = await novaConta();
      const novo = `errado-${Date.now()}@teste.com`;
      await como(conta)
        .post('/account/email')
        .send({ email: novo, currentPassword: SENHA })
        .expect(202);

      const certo = carteiro.codigoPara(novo);
      const errado = certo === '000000' ? '111111' : '000000';

      const primeira = await como(conta)
        .post('/account/email/confirm')
        .send({ code: errado })
        .expect(400);
      expect(primeira.body.restantes).toBe(4);
      for (let i = 0; i < 4; i++) {
        await como(conta)
          .post('/account/email/confirm')
          .send({ code: errado })
          .expect(400);
      }

      // nem o codigo certo vale mais
      await como(conta)
        .post('/account/email/confirm')
        .send({ code: certo })
        .expect(400);
      const resumo = await como(conta).get('/account').expect(200);
      expect(resumo.body.trocaDeEmail).toBeNull();
    });

    it('recusa codigo vencido', async () => {
      const conta = await novaConta();
      const novo = `vencido-${Date.now()}@teste.com`;
      await como(conta)
        .post('/account/email')
        .send({ email: novo, currentPassword: SENHA })
        .expect(202);
      await prisma.emailChange.updateMany({
        where: { newEmail: novo },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await como(conta)
        .post('/account/email/confirm')
        .send({ code: carteiro.codigoPara(novo) })
        .expect(400);
    });

    it('reenvia so depois do intervalo, com outro codigo', async () => {
      const conta = await novaConta();
      const novo = `reenvio-${Date.now()}@teste.com`;
      await como(conta)
        .post('/account/email')
        .send({ email: novo, currentPassword: SENHA })
        .expect(202);
      const primeiro = carteiro.codigoPara(novo);

      await como(conta).post('/account/email/resend').expect(429);

      await prisma.emailChange.updateMany({
        where: { newEmail: novo },
        data: { sentAt: new Date(Date.now() - 60_000) },
      });
      await como(conta).post('/account/email/resend').expect(202);
      const segundo = carteiro.codigoPara(novo);

      if (primeiro !== segundo) {
        await como(conta)
          .post('/account/email/confirm')
          .send({ code: primeiro })
          .expect(400);
      }
      await como(conta)
        .post('/account/email/confirm')
        .send({ code: segundo })
        .expect(200);
    });

    it('nao guarda o pedido quando o e-mail nao sai', async () => {
      const conta = await novaConta();
      carteiro.falhar = true;
      try {
        await como(conta)
          .post('/account/email')
          .send({
            email: `semsmtp-${Date.now()}@teste.com`,
            currentPassword: SENHA,
          })
          .expect(503);
      } finally {
        carteiro.falhar = false;
      }
      const resumo = await como(conta).get('/account').expect(200);
      expect(resumo.body.trocaDeEmail).toBeNull();
    });

    it('cancela o pedido', async () => {
      const conta = await novaConta();
      await como(conta)
        .post('/account/email')
        .send({
          email: `cancela-${Date.now()}@teste.com`,
          currentPassword: SENHA,
        })
        .expect(202);
      await como(conta).delete('/account/email').expect(204);
      const resumo = await como(conta).get('/account').expect(200);
      expect(resumo.body.trocaDeEmail).toBeNull();
    });

    it('recusa codigo fora do formato', async () => {
      const conta = await novaConta();
      await como(conta)
        .post('/account/email/confirm')
        .send({ code: '12ab56' })
        .expect(400);
    });
  });

  describe('troca de senha', () => {
    it('pede a senha atual e uma nova diferente', async () => {
      const conta = await novaConta();
      await como(conta)
        .patch('/account/password')
        .send({
          currentPassword: 'senhaerrada123',
          newPassword: 'outrasenha123',
        })
        .expect(403);
      await como(conta)
        .patch('/account/password')
        .send({ currentPassword: SENHA, newPassword: SENHA })
        .expect(400);
      await como(conta)
        .patch('/account/password')
        .send({ currentPassword: SENHA, newPassword: 'curta' })
        .expect(400);
    });

    it('troca, encerra as outras sessoes e avisa por e-mail', async () => {
      const conta = await novaConta();
      const outroAparelho = await entrar(conta.email);
      const nova = 'senhanova12345';

      const res = await como(conta)
        .patch('/account/password')
        .send({ currentPassword: SENHA, newPassword: nova })
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));

      await entrar(conta.email, nova);
      await server()
        .post('/auth/login')
        .send({ email: conta.email, password: SENHA })
        .expect(401);
      await renovar(outroAparelho).expect(401);
      expect(carteiro.ultimoPara(conta.email)?.subject).toContain('senha');
    });
  });

  it('encerra as outras sessoes e mantem esta', async () => {
    const conta = await novaConta();
    const outroAparelho = await entrar(conta.email);
    expect((await como(conta).get('/account').expect(200)).body.sessoes).toBe(
      2,
    );

    const res = await como(conta)
      .post('/account/sessions/end-others')
      .expect(200);
    const esta = {
      ...conta,
      cookie: res.headers['set-cookie'] as unknown as string[],
    };

    await renovar(outroAparelho).expect(401);
    await renovar(esta).expect(200);
    expect((await como(conta).get('/account').expect(200)).body.sessoes).toBe(
      1,
    );
  });

  it('exporta os dados da propria pessoa, sem senha nem sessoes', async () => {
    const conta = await novaConta();
    const res = await como(conta).get('/account/export').expect(200);

    expect(res.body.conta).toMatchObject({
      nome: 'Conta E2E',
      email: conta.email,
      temFoto: false,
    });
    expect(res.body).toMatchObject({
      favoritos: [],
      avaliacoes: [],
      watchlist: [],
      seguindo: [],
      seguidores: [],
      partidas: [],
    });
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain('passwordHash');
    expect(texto).not.toContain('tokenHash');
  });

  describe('exclusao da conta', () => {
    it('recusa sem a senha certa', async () => {
      const conta = await novaConta();
      await como(conta).delete('/account').send({}).expect(400);
      await como(conta)
        .delete('/account')
        .send({ currentPassword: 'senhaerrada123' })
        .expect(403);
      await como(conta).get('/account').expect(200);
    });

    it('apaga a conta, derruba as sessoes e libera o e-mail', async () => {
      const conta = await novaConta();
      const outroAparelho = await entrar(conta.email);

      const res = await como(conta)
        .delete('/account')
        .send({ currentPassword: SENHA })
        .expect(204);
      expect(String(res.headers['set-cookie'])).toContain('boxd_refresh=;');

      await renovar(outroAparelho).expect(401);
      await server()
        .post('/auth/login')
        .send({ email: conta.email, password: SENHA })
        .expect(401);
      expect(
        await prisma.user.findUnique({ where: { email: conta.email } }),
      ).toBeNull();
    });
  });
});
