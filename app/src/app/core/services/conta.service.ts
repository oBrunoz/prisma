import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionResponse } from '../models/auth.models';
import { Conta, TrocaPendente } from '../models/conta.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ContaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/account`;

  resumo(): Observable<Conta> {
    return this.http.get<Conta>(this.base);
  }

  pedirTrocaDeEmail(email: string, currentPassword: string): Observable<TrocaPendente> {
    return this.http.post<TrocaPendente>(`${this.base}/email`, { email, currentPassword });
  }

  reenviarCodigo(): Observable<TrocaPendente> {
    return this.http.post<TrocaPendente>(`${this.base}/email/resend`, {});
  }

  cancelarTrocaDeEmail(): Observable<void> {
    return this.http.delete<void>(`${this.base}/email`);
  }

  confirmarTrocaDeEmail(code: string): Observable<void> {
    return this.reabrir(this.http.post<SessionResponse>(`${this.base}/email/confirm`, { code }, { withCredentials: true }));
  }

  trocarSenha(currentPassword: string, newPassword: string): Observable<void> {
    return this.reabrir(
      this.http.patch<SessionResponse>(`${this.base}/password`, { currentPassword, newPassword }, { withCredentials: true }),
    );
  }

  encerrarOutrasSessoes(): Observable<void> {
    return this.reabrir(this.http.post<SessionResponse>(`${this.base}/sessions/end-others`, {}, { withCredentials: true }));
  }

  // a resposta traz o token novo e grava o cookie de refresh: sem withCredentials o cookie não pega
  private reabrir(pedido: Observable<SessionResponse>): Observable<void> {
    return pedido.pipe(
      tap((res) => this.auth.adotarSessao(res)),
      map(() => undefined),
    );
  }
}
