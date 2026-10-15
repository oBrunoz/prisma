import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AtualizacaoPerfil,
  Credenciais,
  DadosCadastro,
  PublicUser,
  SessionResponse,
} from '../models/auth.models';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly base = `${environment.apiUrl}/auth`;

  readonly usuario = signal<PublicUser | null>(null);
  readonly autenticado = computed(() => this.usuario() !== null);

  // fica só em memória: um XSS não consegue ler, e ele morre em 15 min
  private readonly accessToken = signal<string | null>(null);

  private renovacao$: Observable<string> | null = null;

  token(): string | null {
    return this.accessToken();
  }

  cadastrar(dados: DadosCadastro): Observable<PublicUser> {
    return this.http
      .post<SessionResponse>(`${this.base}/register`, dados, { withCredentials: true })
      .pipe(map((res) => this.aplicarSessao(res)));
  }

  entrar(credenciais: Credenciais): Observable<PublicUser> {
    return this.http
      .post<SessionResponse>(`${this.base}/login`, credenciais, { withCredentials: true })
      .pipe(map((res) => this.aplicarSessao(res)));
  }

  atualizarPerfil(dados: AtualizacaoPerfil): Observable<PublicUser> {
    return this.http
      .patch<PublicUser>(`${environment.apiUrl}/user/me`, dados)
      .pipe(tap((usuario) => this.usuario.set(usuario)));
  }

  sair(): Observable<void> {
    return this.http
      .post<void>(`${this.base}/logout`, {}, { withCredentials: true })
      .pipe(
        catchError(() => of(void 0)),
        tap(() => this.limparSessao()),
      );
  }

  // uma renovação por vez: cinco requisições falhando juntas compartilham a mesma
  renovar(): Observable<string> {
    this.renovacao$ ??= this.http
      .post<SessionResponse>(`${this.base}/refresh`, {}, { withCredentials: true })
      .pipe(
        map((res) => {
          this.accessToken.set(res.accessToken);
          return res.accessToken;
        }),
        catchError((erro) => {
          this.limparSessao();
          return throwError(() => erro);
        }),
        finalize(() => {
          this.renovacao$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.renovacao$;
  }

  // o cookie de refresh é httpOnly, então só dá para saber se há sessão tentando usá-lo
  restaurarSessao(): Promise<void> {
    return new Promise((resolve) => {
      this.renovar()
        .pipe(
          switchMap(() => this.http.get<PublicUser>(`${this.base}/me`)),
          catchError(() => of(null)),
        )
        .subscribe((usuario) => {
          this.usuario.set(usuario);
          resolve();
        });
    });
  }

  // o usuário fica na página; entrar ou criar conta traz ele de volta para ela
  pedirLogin(motivo: string): void {
    const volta = { queryParams: { redirect: this.router.url } };

    this.toast.aviso(motivo, {
      detalhe: 'Leva menos de um minuto e você continua daqui.',
      chave: 'login',
      acao: { rotulo: 'Entrar', executar: () => this.router.navigate(['/login'], volta) },
      acaoSecundaria: { rotulo: 'Criar conta', executar: () => this.router.navigate(['/register'], volta) },
    });
  }

  // trocar e-mail ou senha derruba todas as sessões e a API reabre só esta
  adotarSessao(res: SessionResponse): void {
    this.accessToken.set(res.accessToken);
    if (res.user) this.usuario.set(res.user);
  }

  limparSessao(): void {
    this.usuario.set(null);
    this.accessToken.set(null);
  }

  private aplicarSessao(res: SessionResponse): PublicUser {
    this.accessToken.set(res.accessToken);
    this.usuario.set(res.user ?? null);
    return res.user!;
  }
}
