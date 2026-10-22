import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TipoMidia } from '../models/catalogo.models';
import { OndeAssistir, ondeAssistir } from '../models/onde-assistir';
import { WatchProvider } from '../models/tmdb.models';

interface OndeAssistirApi {
  tmdbId: number;
  type: TipoMidia;
  releaseDate: string | null;
  providers: WatchProvider[];
}

// o mesmo teto da API
const POR_PEDIDO = 60;

const chave = (tmdbId: number, tipo: TipoMidia) => `${tipo}-${tmdbId}`;

// onde assistir de cada card: os cards pedem ao nascer, o service junta num pedido por
// fileira e o hover só mostra o que já chegou
@Injectable({ providedIn: 'root' })
export class PlataformasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vitrine/plataformas`;

  private readonly ondes = signal<ReadonlyMap<string, OndeAssistir>>(new Map());

  // a API guarda por um dia: na mesma visita não há por que pedir de novo
  private pedidas = new Set<string>();
  private fila = new Set<string>();
  private agendado = false;

  de(tmdbId: number, tipo: TipoMidia): OndeAssistir | undefined {
    return this.ondes().get(chave(tmdbId, tipo));
  }

  pedir(tmdbId: number, tipo: TipoMidia): void {
    const k = chave(tmdbId, tipo);
    if (this.pedidas.has(k)) return;
    this.pedidas.add(k);
    this.fila.add(k);
    this.agendar();
  }

  // os cards de uma fileira nascem juntos; um instante de espera junta todos num pedido
  private agendar(): void {
    if (this.agendado) return;
    this.agendado = true;
    setTimeout(() => {
      this.agendado = false;
      this.despachar();
    }, 50);
  }

  private despachar(): void {
    const chaves = [...this.fila];
    this.fila.clear();

    for (let i = 0; i < chaves.length; i += POR_PEDIDO) {
      const lote = chaves.slice(i, i + POR_PEDIDO);
      this.http.get<OndeAssistirApi[]>(this.base, { params: { titles: lote.join(',') } }).subscribe({
        next: (lista) => {
          const novos = new Map(this.ondes());
          for (const item of lista) {
            novos.set(chave(item.tmdbId, item.type), ondeAssistir({ link: '', flatrate: item.providers }, item.releaseDate));
          }
          this.ondes.set(novos);
          // o que não veio (falha na TMDB) pode ser pedido de novo
          lote.filter((k) => !novos.has(k)).forEach((k) => this.pedidas.delete(k));
        },
        error: () => lote.forEach((k) => this.pedidas.delete(k)),
      });
    }
  }
}
