import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AvaliacaoUsuario,
  EnvioAvaliacao,
  EstatisticasMidia,
  TipoMidia,
} from '../models/catalogo.models';

@Injectable({ providedIn: 'root' })
export class AvaliacaoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reviews`;

  minhaNoTitulo(tmdbId: number, tipo: TipoMidia): Observable<AvaliacaoUsuario | null> {
    return this.http.get<AvaliacaoUsuario | null>(`${this.base}/me/${tipo}/${tmdbId}`);
  }

  porTitulo(tmdbId: number, tipo: TipoMidia, limite = 20): Observable<AvaliacaoUsuario[]> {
    return this.http.get<AvaliacaoUsuario[]>(`${this.base}/media/${tipo}/${tmdbId}?limit=${limite}`);
  }

  // diario: o que foi assistido, pela data; escritas: só as com nota ou texto
  porUsuario(
    userId: string,
    limite = 50,
    filtro?: 'diario' | 'escritas',
    pagina = 1,
  ): Observable<AvaliacaoUsuario[]> {
    return this.http.get<AvaliacaoUsuario[]>(`${this.base}/user/${userId}`, {
      params: { limit: limite, page: pagina, ...(filtro && { filtro }) },
    });
  }

  estatisticas(tmdbId: number, tipo: TipoMidia): Observable<EstatisticasMidia> {
    return this.http.get<EstatisticasMidia>(`${this.base}/media/${tipo}/${tmdbId}/stats`);
  }

  // devolve null quando a ficha fica vazia e o backend apaga a avaliação
  salvar(envio: EnvioAvaliacao): Observable<AvaliacaoUsuario | null> {
    return this.http.post<AvaliacaoUsuario | null>(this.base, envio);
  }

  remover(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
