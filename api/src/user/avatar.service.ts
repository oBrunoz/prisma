import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service.js';

export const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;
const LADO = 320;
const FORMATOS_ACEITOS = new Set(['jpeg', 'png', 'webp']);
// uma foto de celular tem uns 12 milhoes de pixels; acima disso e abuso
const PIXELS_MAXIMOS = 50_000_000;

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  // o tipo vem do conteudo, nao do nome nem do content-type que o navegador manda;
  // regravar tira os metadados (GPS do celular) e neutraliza arquivo disfarcado
  async salvar(userId: string, arquivo: Buffer): Promise<string> {
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

    const data = await imagem
      .rotate()
      .resize(LADO, LADO, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();

    await this.prisma.avatar.upsert({
      where: { userId },
      create: { userId, data },
      update: { data },
    });

    // a versao na URL deixa o navegador guardar a imagem para sempre
    return `/user/${userId}/avatar?v=${Date.now()}`;
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
