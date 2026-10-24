import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { EmailChange, User } from '../generated/prisma/client.js';
import { TokenPair, TokenService } from '../auth/token.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  codigoDeTroca,
  emailTrocado,
  mascararEmail,
  senhaTrocada,
} from '../mail/mail.templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PublicUserDto } from '../user/dto/public-user.dto.js';
import { UserService } from '../user/user.service.js';
import { ContaDto, ExportacaoDto, TrocaPendenteDto } from './dto/conta.dto.js';
import { PedidoTrocaEmailDto } from './dto/pedido-troca-email.dto.js';
import { TrocaSenhaDto } from './dto/troca-senha.dto.js';

const VALIDADE_MIN = 15;
const INTERVALO_REENVIO_MS = 45_000;
const TENTATIVAS = 5;

export interface SessaoReaberta {
  user: PublicUserDto;
  tokens: TokenPair;
}

@Injectable()
export class AccountService {
  // chave propria: com o banco vazado, um hash simples de 6 digitos cairia em segundos
  private readonly chaveDoCodigo: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.chaveDoCodigo = createHmac(
      'sha256',
      config.getOrThrow<string>('JWT_SECRET'),
    )
      .update('codigo-de-troca-de-email')
      .digest();
  }

  async resumo(userId: string): Promise<ContaDto> {
    const user = await this.buscar(userId);
    const [sessoes, troca] = await Promise.all([
      this.tokens.countActive(userId),
      this.trocaValida(userId),
    ]);
    return {
      email: user.email,
      sessoes,
      trocaDeEmail: troca && AccountService.pendente(troca),
    };
  }

  async pedirTrocaDeEmail(
    userId: string,
    dto: PedidoTrocaEmailDto,
  ): Promise<TrocaPendenteDto> {
    const user = await this.buscar(userId);
    await this.exigirSenha(user, dto.currentPassword);

    if (dto.email === user.email) {
      throw new BadRequestException('Esse ja e o seu e-mail');
    }
    if (
      await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      })
    ) {
      throw new ConflictException('E-mail ja cadastrado');
    }

    // um pedido por pessoa: pedir de novo substitui o anterior
    const codigo = AccountService.gerarCodigo();
    const dados = {
      newEmail: dto.email,
      codeHash: this.hashDoCodigo(userId, codigo),
      attempts: 0,
      sentAt: new Date(),
      expiresAt: AccountService.validade(),
    };
    const troca = await this.prisma.emailChange.upsert({
      where: { userId },
      create: { userId, ...dados },
      update: dados,
    });

    try {
      await this.mail.enviar(
        troca.newEmail,
        codigoDeTroca(codigo, VALIDADE_MIN),
      );
    } catch {
      await this.prisma.emailChange.delete({ where: { id: troca.id } });
      throw new ServiceUnavailableException(
        'Nao conseguimos enviar o codigo agora',
      );
    }

    return AccountService.pendente(troca);
  }

  // as tentativas continuam contando: reenviar nao da cinco chances novas
  async reenviarCodigo(userId: string): Promise<TrocaPendenteDto> {
    const troca = await this.exigirTroca(userId);

    if (Date.now() < troca.sentAt.getTime() + INTERVALO_REENVIO_MS) {
      throw new HttpException(
        'Espere um pouco para pedir outro codigo',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codigo = AccountService.gerarCodigo();
    const atualizada = await this.prisma.emailChange.update({
      where: { id: troca.id },
      data: {
        codeHash: this.hashDoCodigo(userId, codigo),
        sentAt: new Date(),
        expiresAt: AccountService.validade(),
      },
    });

    try {
      await this.mail.enviar(
        atualizada.newEmail,
        codigoDeTroca(codigo, VALIDADE_MIN),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Nao conseguimos enviar o codigo agora',
      );
    }

    return AccountService.pendente(atualizada);
  }

  async cancelarTrocaDeEmail(userId: string): Promise<void> {
    await this.prisma.emailChange.deleteMany({ where: { userId } });
  }

  async confirmarTrocaDeEmail(
    userId: string,
    codigo: string,
  ): Promise<SessaoReaberta> {
    const troca = await this.exigirTroca(userId);

    // conta a tentativa antes de comparar: pedidos em paralelo nao passam do limite
    const contada = await this.prisma.emailChange.updateMany({
      where: { id: troca.id, attempts: { lt: TENTATIVAS } },
      data: { attempts: { increment: 1 } },
    });
    if (contada.count === 0) {
      await this.cancelarTrocaDeEmail(userId);
      throw new BadRequestException({
        message: 'Codigo incorreto. Peca um novo',
        restantes: 0,
      });
    }

    if (!this.codigoConfere(userId, codigo, troca.codeHash)) {
      const restantes = TENTATIVAS - troca.attempts - 1;
      if (restantes <= 0) await this.cancelarTrocaDeEmail(userId);
      throw new BadRequestException({
        message:
          restantes > 0 ? 'Codigo incorreto' : 'Codigo incorreto. Peca um novo',
        restantes: Math.max(restantes, 0),
      });
    }

    const antigo = (await this.buscar(userId)).email;
    let user: User;
    try {
      [user] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { email: troca.newEmail },
        }),
        this.prisma.emailChange.delete({ where: { id: troca.id } }),
      ]);
    } catch (erro) {
      // alguem se cadastrou com o endereco enquanto o codigo estava no caminho
      if (AccountService.violouUnico(erro)) {
        await this.cancelarTrocaDeEmail(userId);
        throw new ConflictException('E-mail ja cadastrado');
      }
      throw erro;
    }

    const tokens = await this.tokens.restart(userId);
    this.mail.avisar(antigo, emailTrocado(mascararEmail(user.email)));
    return { user: UserService.toPublic(user), tokens };
  }

  async trocarSenha(userId: string, dto: TrocaSenhaDto): Promise<TokenPair> {
    const user = await this.buscar(userId);
    await this.exigirSenha(user, dto.currentPassword);

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'newPassword precisa ser diferente da senha atual',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(dto.newPassword, {
          type: argon2.argon2id,
        }),
      },
    });

    const tokens = await this.tokens.restart(userId);
    this.mail.avisar(user.email, senhaTrocada());
    return tokens;
  }

  encerrarOutrasSessoes(userId: string): Promise<TokenPair> {
    return this.tokens.restart(userId);
  }

  async exportar(userId: string): Promise<ExportacaoDto> {
    const titulo = { select: { tmdbId: true, type: true, title: true } };
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        avatar: { select: { userId: true } },
        coverMedia: titulo,
        favorites: { include: { media: titulo }, orderBy: { position: 'asc' } },
        reviews: { include: { media: titulo }, orderBy: { createdAt: 'asc' } },
        watchlist: { include: { media: titulo }, orderBy: { addedAt: 'asc' } },
        following: {
          include: { following: { select: { username: true } } },
          orderBy: { createdAt: 'asc' },
        },
        followers: {
          include: { follower: { select: { username: true } } },
          orderBy: { createdAt: 'asc' },
        },
        gamePlays: {
          include: {
            challenge: { select: { kind: true, number: true, day: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const media = (m: { tmdbId: number; type: string; title: string }) => ({
      tmdbId: m.tmdbId,
      tipo: m.type,
      titulo: m.title,
    });

    return {
      exportadoEm: new Date(),
      conta: {
        nome: user.name,
        usuario: user.username,
        email: user.email,
        bio: user.bio,
        criadaEm: user.createdAt,
        temFoto: !!user.avatar,
        capa: {
          tipo: user.coverKind,
          titulo: user.coverMedia && media(user.coverMedia),
          imagem: user.coverPath,
          foco: { x: user.coverX, y: user.coverY, zoom: user.coverZoom },
        },
      },
      favoritos: user.favorites.map((f) => media(f.media)),
      avaliacoes: user.reviews.map((r) => ({
        ...media(r.media),
        nota: r.rating,
        resenha: r.content,
        curtido: r.liked,
        assistidoEm: r.watchedAt,
        criadaEm: r.createdAt,
      })),
      watchlist: user.watchlist.map((w) => ({
        ...media(w.media),
        adicionadoEm: w.addedAt,
      })),
      seguindo: user.following.map((f) => ({
        usuario: f.following.username,
        desde: f.createdAt,
      })),
      seguidores: user.followers.map((f) => ({
        usuario: f.follower.username,
        desde: f.createdAt,
      })),
      partidas: user.gamePlays.map((p) => ({
        jogo: p.challenge.kind,
        desafio: p.challenge.number,
        dia: p.challenge.day,
        palpites: p.guesses,
        resultado: p.result,
      })),
    };
  }

  // o resto da pessoa cai junto pelo cascade do schema
  async excluir(userId: string, senha: string): Promise<void> {
    const user = await this.buscar(userId);
    await this.exigirSenha(user, senha);
    await this.prisma.user.delete({ where: { id: userId } });
  }

  private async buscar(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }
    return user;
  }

  // 403, nao 401: com 401 o front renovaria o token e leria a senha errada como sessao vencida
  private async exigirSenha(user: User, senha: string): Promise<void> {
    if (!(await argon2.verify(user.passwordHash, senha))) {
      throw new ForbiddenException('Senha atual incorreta');
    }
  }

  private async trocaValida(userId: string): Promise<EmailChange | null> {
    const troca = await this.prisma.emailChange.findUnique({
      where: { userId },
    });
    return troca && troca.expiresAt > new Date() ? troca : null;
  }

  private async exigirTroca(userId: string): Promise<EmailChange> {
    const troca = await this.trocaValida(userId);
    if (!troca) {
      await this.cancelarTrocaDeEmail(userId);
      throw new BadRequestException('O codigo expirou. Peca um novo');
    }
    return troca;
  }

  private hashDoCodigo(userId: string, codigo: string): string {
    return createHmac('sha256', this.chaveDoCodigo)
      .update(`${userId}:${codigo}`)
      .digest('hex');
  }

  private codigoConfere(userId: string, codigo: string, hash: string): boolean {
    return timingSafeEqual(
      Buffer.from(this.hashDoCodigo(userId, codigo), 'hex'),
      Buffer.from(hash, 'hex'),
    );
  }

  private static gerarCodigo(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private static validade(): Date {
    return new Date(Date.now() + VALIDADE_MIN * 60_000);
  }

  private static pendente(troca: EmailChange): TrocaPendenteDto {
    return {
      email: troca.newEmail,
      expiraEm: troca.expiresAt,
      reenvioEm: new Date(troca.sentAt.getTime() + INTERVALO_REENVIO_MS),
    };
  }

  private static violouUnico(erro: unknown): boolean {
    return (
      typeof erro === 'object' &&
      erro !== null &&
      'code' in erro &&
      erro.code === 'P2002'
    );
  }
}
