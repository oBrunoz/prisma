import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { LIMITE_LOGIN } from '../common/rate-limit.js';
import type { Request, Response } from 'express';
import { CreateUserDto } from '../user/dto/create-user.dto.js';
import { PublicUserDto } from '../user/dto/public-user.dto.js';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants.js';
import { AuthResult, AuthService } from './auth.service.js';
import { gravarRefreshCookie } from './refresh-cookie.js';
import { LoginDto } from './dto/login.dto.js';
import type { AccessTokenPayload } from './token.service.js';
import { TokenPair } from './token.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

interface SessionResponse {
  user?: PublicUserDto;
  accessToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() payload: AccessTokenPayload): Promise<PublicUserDto> {
    return this.authService.me(payload.sub);
  }

  @Throttle({ default: LIMITE_LOGIN })
  @Post('register')
  async register(
    @Body() dto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.emitSession(await this.authService.register(dto), res);
  }

  @Throttle({ default: LIMITE_LOGIN })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.emitSession(await this.authService.login(dto), res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const tokens = await this.authService.refresh(this.readRefreshCookie(req));
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookie = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (cookie) {
      await this.authService.logout(cookie);
    }
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  private emitSession(
    { user, tokens }: AuthResult,
    res: Response,
  ): SessionResponse {
    this.setRefreshCookie(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  private readRefreshCookie(req: Request): string {
    const cookie = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!cookie) {
      throw new UnauthorizedException('Sem refresh token');
    }
    return cookie;
  }

  private setRefreshCookie(res: Response, tokens: TokenPair): void {
    gravarRefreshCookie(res, tokens, this.config);
  }
}
