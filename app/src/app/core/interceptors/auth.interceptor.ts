import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

// renovar a partir destas geraria laço: elas é que emitem o token
const SEM_RENOVACAO = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function comToken<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

// várias requisições caem juntas quando a sessão expira; a chave deixa um aviso só
function avisarSessaoExpirada(toast: ToastService, router: Router): void {
  toast.aviso('Sua sessão expirou', {
    detalhe: 'Entre de novo para continuar de onde parou.',
    chave: 'sessao',
    acao: {
      rotulo: 'Entrar',
      executar: () => router.navigate(['/login'], { queryParams: { redirect: router.url } }),
    },
  });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  // o proxy da TMDB é público: anexar o header ali só criaria um preflight por prateleira
  if (req.url.startsWith(`${environment.apiUrl}/tmdb`)) return next(req);

  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const router = inject(Router);
  const token = auth.token();

  return next(token ? comToken(req, token) : req).pipe(
    catchError((erro: HttpErrorResponse) => {
      const renovavel =
        erro.status === 401 && !SEM_RENOVACAO.some((rota) => req.url.includes(rota));

      if (!renovavel) return throwError(() => erro);

      // o renovar já limpa a sessão ao falhar, então é preciso saber antes se havia uma
      const tinhaSessao = auth.autenticado();

      // só a renovação falhando derruba a sessão; o erro da requisição repetida volta para quem pediu
      return auth.renovar().pipe(
        catchError((falha) => {
          auth.limparSessao();
          if (tinhaSessao) avisarSessaoExpirada(toast, router);
          return throwError(() => falha);
        }),
        switchMap((novoToken) => next(comToken(req, novoToken))),
      );
    }),
  );
};
