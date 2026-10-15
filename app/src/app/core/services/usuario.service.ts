import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BuscaUsuarios, PerfilPublico, UsuarioResumo } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  perfil(username: string): Observable<PerfilPublico> {
    return this.http.get<PerfilPublico>(`${this.base}/user/username/${encodeURIComponent(username)}`);
  }

  buscar(termo: string, pagina = 1, limite = 20): Observable<BuscaUsuarios> {
    return this.http.get<BuscaUsuarios>(`${this.base}/user/search`, {
      params: { q: termo, page: pagina, limit: limite },
    });
  }

  seguidores(userId: string, pagina = 1, limite = 20): Observable<UsuarioResumo[]> {
    return this.http.get<UsuarioResumo[]>(`${this.base}/follow/${userId}/followers`, {
      params: { page: pagina, limit: limite },
    });
  }

  seguindoPor(userId: string, pagina = 1, limite = 20): Observable<UsuarioResumo[]> {
    return this.http.get<UsuarioResumo[]>(`${this.base}/follow/${userId}/following`, {
      params: { page: pagina, limit: limite },
    });
  }

  estaSeguindo(userId: string): Observable<boolean> {
    return this.http
      .get<{ seguindo: boolean }>(`${this.base}/follow/${userId}/status`)
      .pipe(map((res) => res.seguindo));
  }

  seguir(userId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/follow/${userId}`, {});
  }

  deixarDeSeguir(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/follow/${userId}`);
  }

  definirSeguindo(userId: string, seguir: boolean): Observable<void> {
    return seguir ? this.seguir(userId) : this.deixarDeSeguir(userId);
  }
}
