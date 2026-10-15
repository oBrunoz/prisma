import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { PerfilPublicoDto } from './dto/perfil-publico.dto.js';
import {
  BuscaUsuariosDto,
  SELECT_RESUMO,
  UsuarioResumoDto,
  paraResumo,
} from './dto/usuario-resumo.dto.js';
import { PublicUserDto } from './dto/public-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const UNIQUE_VIOLATION = 'P2002';

// faz o login gastar o mesmo tempo quando o e-mail nao existe
let hashFalso: Promise<string> | null = null;

function hashDescartavel(): Promise<string> {
  hashFalso ??= argon2.hash('login-sem-usuario', { type: argon2.argon2id });
  return hashFalso;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<PublicUserDto> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          username: dto.username.toLowerCase(),
          email: dto.email.toLowerCase(),
          passwordHash,
        },
      });
      return UserService.toPublic(user);
    } catch (error) {
      // o formulario tem dois campos unicos: a mensagem precisa dizer qual deles
      if (this.isUniqueViolation(error, 'username')) {
        throw new ConflictException('Esse nome de usuario ja esta em uso');
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('E-mail ja cadastrado');
      }
      throw error;
    }
  }

  async updateMe(id: string, dto: UpdateUserDto): Promise<PublicUserDto> {
    const atual = await this.prisma.user.findUnique({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const email = dto.email?.toLowerCase();
    const trocaEmail = email !== undefined && email !== atual.email;

    if (trocaEmail) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Informe a senha atual para trocar o e-mail',
        );
      }
      const confere = await argon2.verify(
        atual.passwordHash,
        dto.currentPassword,
      );
      if (!confere) {
        throw new UnauthorizedException('Senha atual incorreta');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.username !== undefined && {
            username: dto.username.toLowerCase(),
          }),
          ...(trocaEmail && { email }),
          ...(dto.bio !== undefined && { bio: dto.bio.trim() || null }),
          // string vazia e o jeito de tirar a foto
          ...(dto.avatarUrl !== undefined && {
            avatarUrl: dto.avatarUrl || null,
          }),
        },
      });
      return UserService.toPublic(user);
    } catch (error) {
      if (this.isUniqueViolation(error, 'username')) {
        throw new ConflictException('Esse nome de usuario ja esta em uso');
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('E-mail ja cadastrado');
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findPublicById(id: string): Promise<PublicUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }
    return UserService.toPublic(user);
  }

  async findPerfilByUsername(username: string): Promise<PerfilPublicoDto> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: {
        _count: { select: { reviews: true, followers: true, following: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    return Object.assign(UserService.toPublic(user), {
      contagem: {
        avaliacoes: user._count.reviews,
        seguidores: user._count.followers,
        seguindo: user._count.following,
      },
    });
  }

  async buscar(
    termo: string,
    pagina: PaginationDto,
    quemVe?: string,
  ): Promise<BuscaUsuariosDto> {
    const where = {
      username: { contains: termo, mode: 'insensitive' as const },
    };

    const [total, linhas] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: SELECT_RESUMO,
        orderBy: { username: 'asc' },
        take: pagina.take,
        skip: pagina.skip,
      }),
    ]);

    return {
      total,
      resultados: await this.marcarSeguindo(linhas.map(paraResumo), quemVe),
    };
  }

  // um "voce segue" por linha, numa consulta so
  async marcarSeguindo(
    usuarios: UsuarioResumoDto[],
    quemVe?: string,
  ): Promise<UsuarioResumoDto[]> {
    if (!quemVe || usuarios.length === 0) return usuarios;

    const seguidos = await this.prisma.follow.findMany({
      where: {
        followerId: quemVe,
        followingId: { in: usuarios.map((u) => u.id) },
      },
      select: { followingId: true },
    });
    const ids = new Set(seguidos.map((s) => s.followingId));

    return usuarios.map((u) => ({ ...u, seguindo: ids.has(u.id) }));
  }

  async verifyPassword(user: User | null, password: string): Promise<boolean> {
    if (!user) {
      await argon2.verify(await hashDescartavel(), password).catch(() => false);
      return false;
    }
    return argon2.verify(user.passwordHash, password);
  }

  static toPublic(user: User): PublicUserDto {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
    };
  }

  private isUniqueViolation(error: unknown, campo?: string): boolean {
    const ehUnico =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === UNIQUE_VIOLATION;

    if (!ehUnico || !campo) return ehUnico;

    const alvo = (error as { meta?: { target?: unknown } }).meta?.target;
    const campos = Array.isArray(alvo) ? alvo.map(String) : [String(alvo ?? '')];

    return campos.some((c) => c.includes(campo));
  }
}
