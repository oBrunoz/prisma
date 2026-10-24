import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { Media, User } from '../generated/prisma/client.js';
import { MediaService } from '../media/media.service.js';
import { TmdbService } from '../tmdb/tmdb.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { CapaDto } from './dto/capa.dto.js';
import { FavoritosDto } from './dto/favoritos.dto.js';
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

// cenas sem texto (null) primeiro; o front pede a mesma lista ao montar a grade
const IDIOMAS_DAS_CENAS = 'null,pt,en';

// faz o login gastar o mesmo tempo quando o e-mail nao existe
let hashFalso: Promise<string> | null = null;

function hashDescartavel(): Promise<string> {
  hashFalso ??= argon2.hash('login-sem-usuario', { type: argon2.argon2id });
  return hashFalso;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly tmdb: TmdbService,
  ) {}

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
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.bio !== undefined && { bio: dto.bio.trim() || null }),
        // string vazia e o jeito de tirar a foto
        ...(dto.avatarUrl !== undefined && {
          avatarUrl: dto.avatarUrl || null,
        }),
      },
    });
    // tirou a foto: a enviada nao fica guardada a toa
    if (dto.avatarUrl === '') {
      await this.prisma.avatar.deleteMany({ where: { userId: id } });
    }
    return UserService.toPublic(user);
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
        _count: { select: { followers: true, following: true } },
        favorites: { include: { media: true }, orderBy: { position: 'asc' } },
        coverMedia: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    // contado no banco: a lista que o front carrega e paginada
    const assistido = (type: 'MOVIE' | 'TV') => ({
      userId: user.id,
      watchedAt: { not: null },
      media: { type },
    });
    const [avaliacoes, filmes, series, notas] = await Promise.all([
      this.prisma.review.count({
        where: {
          userId: user.id,
          OR: [{ rating: { not: null } }, { content: { not: null } }],
        },
      }),
      this.prisma.review.count({ where: assistido('MOVIE') }),
      this.prisma.review.count({ where: assistido('TV') }),
      this.prisma.review.aggregate({
        where: { userId: user.id, rating: { not: null } },
        _avg: { rating: true },
      }),
    ]);

    return Object.assign(UserService.toPublic(user), {
      contagem: {
        avaliacoes,
        filmes,
        series,
        seguidores: user._count.followers,
        seguindo: user._count.following,
        notaMedia: notas._avg.rating,
      },
      favoritos: user.favorites.map((f) => f.media),
      capa: UserService.capa(user),
    });
  }

  async definirCapa(userId: string, dto: CapaDto): Promise<PerfilPublicoDto['capa']> {
    if (dto.tipo !== 'titulo') {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          coverKind: dto.tipo === 'nenhuma' ? 'NONE' : 'FAVORITE',
          coverMediaId: null,
          coverPath: null,
        },
        include: {
          coverMedia: true,
          favorites: { include: { media: true }, orderBy: { position: 'asc' } },
        },
      });
      return UserService.capa(user);
    }

    const tmdbId = dto.tmdbId!;
    const mediaType = dto.mediaType!;
    // so vale imagem de cena desse titulo: o credito "Capa: titulo" precisa ser verdade
    // os mesmos idiomas que a tela de escolha mostra: sem isto so viriam as cenas em pt
    const imagens = await this.tmdb.get<{ backdrops?: { file_path: string }[] }>(
      `/${mediaType === 'MOVIE' ? 'movie' : 'tv'}/${tmdbId}/images`,
      { include_image_language: IDIOMAS_DAS_CENAS },
    );
    if (!imagens.backdrops?.some((b) => b.file_path === dto.backdropPath)) {
      throw new BadRequestException('Essa imagem nao e uma cena desse titulo');
    }

    const media = await this.media.resolve(tmdbId, mediaType);
    await this.prisma.user.update({
      where: { id: userId },
      data: { coverKind: 'TITLE', coverMediaId: media.id, coverPath: dto.backdropPath },
    });
    return { tipo: 'titulo', backdropPath: dto.backdropPath!, media };
  }

  async definirAvatar(userId: string, avatarUrl: string | null): Promise<PublicUserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return UserService.toPublic(user);
  }

  // titulo sem midia (apagada) volta para o favorito, como se nunca tivesse escolhido
  private static capa(user: {
    coverKind: 'FAVORITE' | 'TITLE' | 'NONE';
    coverPath: string | null;
    coverMedia: Media | null;
    favorites: { media: Media }[];
  }): PerfilPublicoDto['capa'] {
    if (user.coverKind === 'NONE') {
      return { tipo: 'nenhuma', backdropPath: null, media: null };
    }
    if (user.coverKind === 'TITLE' && user.coverPath && user.coverMedia) {
      return { tipo: 'titulo', backdropPath: user.coverPath, media: user.coverMedia };
    }
    return { tipo: 'favorito', backdropPath: null, media: user.favorites[0]?.media ?? null };
  }

  async definirFavoritos(userId: string, dto: FavoritosDto): Promise<Media[]> {
    const chaves = dto.itens.map((i) => `${i.mediaType}:${i.tmdbId}`);
    if (new Set(chaves).size !== chaves.length) {
      throw new BadRequestException('O mesmo titulo aparece duas vezes');
    }

    // resolve antes da transacao: pode precisar buscar o titulo na TMDB
    const medias = await Promise.all(
      dto.itens.map((i) => this.media.resolve(i.tmdbId, i.mediaType)),
    );

    await this.prisma.$transaction([
      this.prisma.favorite.deleteMany({ where: { userId } }),
      this.prisma.favorite.createMany({
        data: medias.map((m, position) => ({
          userId,
          mediaId: m.id,
          position,
        })),
      }),
    ]);

    return medias;
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
