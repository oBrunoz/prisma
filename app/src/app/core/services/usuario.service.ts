import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BuscaUsuarios,
  Capa,
  EnvioCapa,
  NovosSeguidores,
  PerfilPublico,
  PublicUser,
  UsuarioResumo,
} from '../models/auth.models';
import { Midia, TipoMidia } from '../models/catalogo.models';

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

  // a lista inteira, na ordem; vazia limpa
  definirFavoritos(itens: { tmdbId: number; mediaType: TipoMidia }[]): Observable<Midia[]> {
    return this.http.put<Midia[]>(`${this.base}/user/me/favorites`, { itens });
  }

  enviarFoto(arquivo: File): Observable<PublicUser> {
    const corpo = new FormData();
    corpo.append('foto', arquivo);
    return this.http.post<PublicUser>(`${this.base}/user/me/avatar`, corpo);
  }

  tirarFoto(): Observable<PublicUser> {
    return this.http.delete<PublicUser>(`${this.base}/user/me/avatar`);
  }

  definirCapa(capa: EnvioCapa): Observable<Capa> {
    return this.http.put<Capa>(`${this.base}/user/me/cover`, capa);
  }

  novosSeguidores(): Observable<NovosSeguidores> {
    return this.http.get<NovosSeguidores>(`${this.base}/follow/me/new`);
  }

  marcarSeguidoresVistos(ate: string): Observable<void> {
    return this.http.post<void>(`${this.base}/follow/me/new/seen`, { ate });
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
