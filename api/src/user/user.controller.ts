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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  // o limite de tamanho corta no recebimento: acima dele vira 413 sem ler o resto
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: LIMITE_FOTO })
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: TAMANHO_MAXIMO_FOTO, files: 1 } }),
  )
  async enviarFoto(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() arquivo?: { buffer: Buffer },
  ): Promise<PublicUserDto> {
    if (!arquivo) {
      throw new BadRequestException('Envie a imagem no campo "foto"');
    }
    const url = await this.avatars.salvar(user.sub, arquivo.buffer);
    return this.userService.definirAvatar(user.sub, url);
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
