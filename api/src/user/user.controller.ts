import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { AccessTokenPayload } from '../auth/token.service.js';
import { BuscaUsuarioQueryDto } from './dto/busca-usuario.dto.js';
import { PerfilPublicoDto } from './dto/perfil-publico.dto.js';
import { PublicUserDto } from './dto/public-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { BuscaUsuariosDto } from './dto/usuario-resumo.dto.js';
import { UserService } from './user.service.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // antes de :id, senao "me" cairia no ParseUUIDPipe e viraria 400
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<PublicUserDto> {
    return this.userService.updateMe(user.sub, dto);
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

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicUserDto> {
    return this.userService.findPublicById(id);
  }
}
