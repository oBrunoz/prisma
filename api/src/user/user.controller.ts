import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { LIMITE_FOTO } from '../common/rate-limit.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import type { Media } from '../generated/prisma/client.js';
import { AvatarService, TAMANHO_MAXIMO_FOTO } from './avatar.service.js';
import { BuscaUsuarioQueryDto } from './dto/busca-usuario.dto.js';
import { CapaDto } from './dto/capa.dto.js';
import { FavoritosDto } from './dto/favoritos.dto.js';
import { EnquadramentoDto, FotoDto } from './dto/foto.dto.js';
import { PerfilPublicoDto } from './dto/perfil-publico.dto.js';
import { PublicUserDto } from './dto/public-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { BuscaUsuariosDto } from './dto/usuario-resumo.dto.js';
import { UserService } from './user.service.js';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly avatars: AvatarService,
  ) {}

  // antes de :id, senao "me" cairia no ParseUUIDPipe e viraria 400
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<PublicUserDto> {
    return this.userService.updateMe(user.sub, dto);
  }

  // o limite corta no recebimento (413); "original" + "enquadramento" deixam reabrir o ajuste
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: LIMITE_FOTO })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'foto', maxCount: 1 },
        { name: 'original', maxCount: 1 },
      ],
      { limits: { fileSize: TAMANHO_MAXIMO_FOTO, files: 2 } },
    ),
  )
  async enviarFoto(
    @CurrentUser() user: AccessTokenPayload,
    @Body() corpo: FotoDto,
    @UploadedFiles() arquivos: { foto?: { buffer: Buffer }[]; original?: { buffer: Buffer }[] } = {},
  ): Promise<PublicUserDto> {
    const foto = arquivos.foto?.[0];
    const original = arquivos.original?.[0];
    if (!foto) {
      throw new BadRequestException('Envie a imagem no campo "foto"');
    }
    if (!original !== !corpo.enquadramento) {
      throw new BadRequestException('A original e o enquadramento vao juntos');
    }
    const ajuste =
      original && corpo.enquadramento
        ? { original: original.buffer, enquadramento: corpo.enquadramento }
        : undefined;
    const url = await this.avatars.salvar(user.sub, foto.buffer, ajuste);
    return this.userService.definirAvatar(user.sub, url);
  }

  // so a dona ve a original: pode ter algo que ela cortou de proposito
  @Get('me/avatar/original')
  @UseGuards(JwtAuthGuard)
  async fotoOriginal(
    @CurrentUser() user: AccessTokenPayload,
    @Res() res: Response,
  ): Promise<void> {
    const original = await this.avatars.lerOriginal(user.sub);
    if (!original) {
      throw new NotFoundException('Sem foto original guardada');
    }
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store' });
    res.send(original);
  }

  @Get('me/avatar/enquadramento')
  @UseGuards(JwtAuthGuard)
  async enquadramento(@CurrentUser() user: AccessTokenPayload): Promise<EnquadramentoDto> {
    const enquadramento = await this.avatars.lerEnquadramento(user.sub);
    if (!enquadramento) {
      throw new NotFoundException('Sem foto original guardada');
    }
    return enquadramento;
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  async tirarFoto(@CurrentUser() user: AccessTokenPayload): Promise<PublicUserDto> {
    await this.avatars.remover(user.sub);
    return this.userService.definirAvatar(user.sub, null);
  }

  @Put('me/cover')
  @UseGuards(JwtAuthGuard)
  definirCapa(@CurrentUser() user: AccessTokenPayload, @Body() dto: CapaDto) {
    return this.userService.definirCapa(user.sub, dto);
  }

  @Put('me/favorites')
  @UseGuards(JwtAuthGuard)
  definirFavoritos(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: FavoritosDto,
  ): Promise<Media[]> {
    return this.userService.definirFavoritos(user.sub, dto);
  }

  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  search(
    @Query() query: BuscaUsuarioQueryDto,
    @CurrentUser() user?: AccessTokenPayload,
  ): Promise<BuscaUsuariosDto> {
    return this.userService.buscar(query.q, query, user?.sub);
  }

  // o handle e o que vai na URL do perfil; o id fica para uso interno
  @Get('username/:username')
  findByUsername(
    @Param('username') username: string,
  ): Promise<PerfilPublicoDto> {
    return this.userService.findPerfilByUsername(username);
  }

  // site e API em origens diferentes: sem o CORP cross-origin o navegador recusa a imagem
  @Get(':id/avatar')
  async foto(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const foto = await this.avatars.ler(id);
    if (!foto) {
      throw new NotFoundException('Foto nao encontrada');
    }
    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(foto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicUserDto> {
    return this.userService.findPublicById(id);
  }
}
