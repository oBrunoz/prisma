import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SELECT_RESUMO,
  UsuarioResumoDto,
  paraResumo,
} from '../user/dto/usuario-resumo.dto.js';
import { UserService } from '../user/user.service.js';

const PERFIL = { select: SELECT_RESUMO };

@Injectable()
export class FollowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
  ) {}

  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('Não dá para seguir a si mesmo');
    }

    const alvo = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true },
    });
    if (!alvo) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const apagados = await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });

    if (apagados.count === 0) {
      throw new NotFoundException('Você não segue esse usuário');
    }
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const vinculo = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { followerId: true },
    });
    return vinculo !== null;
  }

  async followers(
    userId: string,
    pagina: PaginationDto,
    quemVe?: string,
  ): Promise<UsuarioResumoDto[]> {
    const vinculos = await this.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: PERFIL },
      orderBy: { createdAt: 'desc' },
      take: pagina.take,
      skip: pagina.skip,
    });
    return this.users.marcarSeguindo(
      vinculos.map((v) => paraResumo(v.follower)),
      quemVe,
    );
  }

  async following(
    userId: string,
    pagina: PaginationDto,
    quemVe?: string,
  ): Promise<UsuarioResumoDto[]> {
    const vinculos = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: PERFIL },
      orderBy: { createdAt: 'desc' },
      take: pagina.take,
      skip: pagina.skip,
    });
    return this.users.marcarSeguindo(
      vinculos.map((v) => paraResumo(v.following)),
      quemVe,
    );
  }

  // derivado dos follows: quem seguiu e desistiu antes de ser visto some sozinho
  async novos(userId: string, limite = 3) {
    const dono = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { followersSeenAt: true },
    });
    const where = {
      followingId: userId,
      ...(dono?.followersSeenAt && {
        createdAt: { gt: dono.followersSeenAt },
      }),
    };

    const [total, vinculos] = await Promise.all([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        include: { follower: PERFIL },
        orderBy: { createdAt: 'desc' },
        take: limite,
      }),
    ]);

    return {
      total,
      // o front devolve esse instante ao marcar como visto
      ate: vinculos[0]?.createdAt ?? null,
      recentes: await this.users.marcarSeguindo(
        vinculos.map((v) => paraResumo(v.follower)),
        userId,
      ),
    };
  }

  async marcarVistos(userId: string, ate: Date): Promise<void> {
    // nunca volta no tempo, e nunca passa do agora
    const limite = new Date(Math.min(ate.getTime(), Date.now()));
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ followersSeenAt: null }, { followersSeenAt: { lt: limite } }],
      },
      data: { followersSeenAt: limite },
    });
  }

  async counts(userId: string) {
    const [seguidores, seguindo] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
    return { seguidores, seguindo };
  }
}
