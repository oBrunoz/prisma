import { BadRequestException, Injectable } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EnquadramentoDto } from './dto/foto.dto.js';

export const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;
const LADO = 320;
const LADO_ORIGINAL = 2048;
const FORMATOS_ACEITOS = new Set(['jpeg', 'png', 'webp']);
// uma foto de celular tem uns 12 milhoes de pixels; acima disso e abuso
const PIXELS_MAXIMOS = 50_000_000;

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  // o tipo vem do conteudo, nao do nome; regravar tira os metadados (GPS) e neutraliza arquivo disfarcado
  async salvar(
    userId: string,
    arquivo: Buffer,
    ajuste?: { original: Buffer; enquadramento: EnquadramentoDto },
  ): Promise<string> {
    const data = await (await AvatarService.abrir(arquivo))
      .rotate()
      .resize(LADO, LADO, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();

    const original = ajuste
      ? await (await AvatarService.abrir(ajuste.original))
          .rotate()
          .resize(LADO_ORIGINAL, LADO_ORIGINAL, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer()
      : null;
    // sem original, a foto nova nao reabre com o enquadramento da antiga
    const guardado = {
      data,
      original,
      enquadramento: ajuste ? { ...ajuste.enquadramento } : Prisma.DbNull,
    };

    await this.prisma.avatar.upsert({
      where: { userId },
      create: { userId, ...guardado },
      update: guardado,
    });

    // a versao na URL deixa o navegador guardar a imagem para sempre
    return `/user/${userId}/avatar?v=${Date.now()}`;
  }

  async lerOriginal(userId: string): Promise<Buffer | null> {
    const foto = await this.prisma.avatar.findUnique({
      where: { userId },
      select: { original: true },
    });
    return foto?.original ? Buffer.from(foto.original) : null;
  }

  async lerEnquadramento(userId: string): Promise<EnquadramentoDto | null> {
    const foto = await this.prisma.avatar.findFirst({
      where: { userId, original: { not: null } },
      select: { enquadramento: true },
    });
    return (foto?.enquadramento as EnquadramentoDto | null | undefined) ?? null;
  }

  private static async abrir(arquivo: Buffer): Promise<Sharp> {
    const imagem = sharp(arquivo, { limitInputPixels: PIXELS_MAXIMOS });
    let formato: string | undefined;
    try {
      formato = (await imagem.metadata()).format;
    } catch {
      formato = undefined;
    }
    if (!formato || !FORMATOS_ACEITOS.has(formato)) {
      throw new BadRequestException('Envie uma imagem JPG, PNG ou WebP');
    }
    return imagem;
  }

  async remover(userId: string): Promise<void> {
    await this.prisma.avatar.deleteMany({ where: { userId } });
  }

  async ler(userId: string): Promise<Buffer | null> {
    const foto = await this.prisma.avatar.findUnique({
      where: { userId },
      select: { data: true },
    });
    return foto ? Buffer.from(foto.data) : null;
  }
}
