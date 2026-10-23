import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from '../auth/auth.constants.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { gravarRefreshCookie } from '../auth/refresh-cookie.js';
import type { AccessTokenPayload, TokenPair } from '../auth/token.service.js';
import { LIMITE_ENVIO_EMAIL, LIMITE_LOGIN } from '../common/rate-limit.js';
import { PublicUserDto } from '../user/dto/public-user.dto.js';
import { AccountService } from './account.service.js';
import { ConfirmacaoEmailDto } from './dto/confirmacao-email.dto.js';
import { ContaDto, ExportacaoDto, TrocaPendenteDto } from './dto/conta.dto.js';
import { ExclusaoContaDto } from './dto/exclusao-conta.dto.js';
import { PedidoTrocaEmailDto } from './dto/pedido-troca-email.dto.js';
import { TrocaSenhaDto } from './dto/troca-senha.dto.js';

interface SessaoNova {
  user?: PublicUserDto;
  accessToken: string;
}

// tudo que muda como a pessoa entra; o perfil publico fica em /user/me
@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  resumo(@CurrentUser() quem: AccessTokenPayload): Promise<ContaDto> {
    return this.account.resumo(quem.sub);
  }

  @Throttle({ default: LIMITE_ENVIO_EMAIL })
  @Post('email')
  @HttpCode(HttpStatus.ACCEPTED)
  pedirTrocaDeEmail(
    @CurrentUser() quem: AccessTokenPayload,
    @Body() dto: PedidoTrocaEmailDto,
  ): Promise<TrocaPendenteDto> {
    return this.account.pedirTrocaDeEmail(quem.sub, dto);
  }

  @Throttle({ default: LIMITE_ENVIO_EMAIL })
  @Post('email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  reenviarCodigo(
    @CurrentUser() quem: AccessTokenPayload,
  ): Promise<TrocaPendenteDto> {
    return this.account.reenviarCodigo(quem.sub);
  }

  @Throttle({ default: LIMITE_LOGIN })
  @Post('email/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmarTrocaDeEmail(
    @CurrentUser() quem: AccessTokenPayload,
    @Body() dto: ConfirmacaoEmailDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoNova> {
    const { user, tokens } = await this.account.confirmarTrocaDeEmail(
      quem.sub,
      dto.code,
    );
    return { user, ...this.reabrir(res, tokens) };
  }

  @Delete('email')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelarTrocaDeEmail(@CurrentUser() quem: AccessTokenPayload): Promise<void> {
    return this.account.cancelarTrocaDeEmail(quem.sub);
  }

  @Throttle({ default: LIMITE_LOGIN })
  @Patch('password')
  async trocarSenha(
    @CurrentUser() quem: AccessTokenPayload,
    @Body() dto: TrocaSenhaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoNova> {
    return this.reabrir(res, await this.account.trocarSenha(quem.sub, dto));
  }

  @Post('sessions/end-others')
  @HttpCode(HttpStatus.OK)
  async encerrarOutrasSessoes(
    @CurrentUser() quem: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoNova> {
    return this.reabrir(
      res,
      await this.account.encerrarOutrasSessoes(quem.sub),
    );
  }

  @Get('export')
  exportar(@CurrentUser() quem: AccessTokenPayload): Promise<ExportacaoDto> {
    return this.account.exportar(quem.sub);
  }

  @Throttle({ default: LIMITE_LOGIN })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluir(
    @CurrentUser() quem: AccessTokenPayload,
    @Body() dto: ExclusaoContaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.account.excluir(quem.sub, dto.currentPassword);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  // todas as sessoes caem e so esta reabre, com cookie novo
  private reabrir(res: Response, tokens: TokenPair): SessaoNova {
    gravarRefreshCookie(res, tokens, this.config);
    return { accessToken: tokens.accessToken };
  }
}
