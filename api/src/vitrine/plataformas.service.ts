import { Injectable } from '@nestjs/common';
import { TmdbService } from '../tmdb/tmdb.service.js';

export type TipoTitulo = 'movie' | 'tv';

export interface Provedor {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface OndeAssistir {
  tmdbId: number;
  type: TipoTitulo;
  releaseDate: string | null;
  providers: Provedor[];
}

interface Detalhes {
  release_date?: string;
  'watch/providers'?: {
    results?: Record<string, { flatrate?: Provedor[]; free?: Provedor[]; ads?: Provedor[] }>;
  };
}

const UM_DIA = 24 * 60 * 60 * 1000;
// a TMDB aguenta umas 40 por segundo; uma fileira inteira de uma vez passaria disso
const LOTE = 10;
const MAX_GUARDADOS = 5000;
const PAIS = 'BR';

// onde assistir de cada card: a home inteira daria ~200 consultas a TMDB por visita,
// entao cada titulo e consultado uma vez por dia e servido daqui
@Injectable()
export class PlataformasService {
  private readonly guardados = new Map<string, { ate: number; dados: Promise<OndeAssistir> }>();

  constructor(private readonly tmdb: TmdbService) {}

  async de(titulos: { type: TipoTitulo; tmdbId: number }[]): Promise<OndeAssistir[]> {
    const faltam = titulos.filter((t) => !this.valido(chave(t)));
    for (let i = 0; i < faltam.length; i += LOTE) {
      await Promise.all(faltam.slice(i, i + LOTE).map((t) => this.buscar(t).catch(() => null)));
    }

    // o que falhou fica de fora: o front pede de novo na proxima vez
    const prontos = await Promise.all(
      titulos.map((t) => this.guardados.get(chave(t))?.dados.catch(() => null) ?? null),
    );
    return prontos.filter((p): p is OndeAssistir => p !== null);
  }

  private valido(k: string): boolean {
    const guardado = this.guardados.get(k);
    return !!guardado && guardado.ate > Date.now();
  }

  private buscar(t: { type: TipoTitulo; tmdbId: number }): Promise<OndeAssistir> {
    const k = chave(t);
    const dados = this.tmdb
      .get<Detalhes>(`/${t.type}/${t.tmdbId}`, { append_to_response: 'watch/providers' })
      .then((d): OndeAssistir => {
        const pais = d['watch/providers']?.results?.[PAIS];
        return {
          tmdbId: t.tmdbId,
          type: t.type,
          releaseDate: d.release_date || null,
          providers: [...(pais?.flatrate ?? []), ...(pais?.free ?? []), ...(pais?.ads ?? [])].map((p) => ({
            provider_id: p.provider_id,
            provider_name: p.provider_name,
            logo_path: p.logo_path,
            display_priority: p.display_priority,
          })),
        };
      });

    // reinserir manda para o fim: o primeiro do Map e sempre o mais antigo
    this.guardados.delete(k);
    this.guardados.set(k, { ate: Date.now() + UM_DIA, dados });
    if (this.guardados.size > MAX_GUARDADOS) this.guardados.delete(this.guardados.keys().next().value!);
    dados.catch(() => {
      if (this.guardados.get(k)?.dados === dados) this.guardados.delete(k);
    });
    return dados;
  }
}

const chave = (t: { type: TipoTitulo; tmdbId: number }) => `${t.type}-${t.tmdbId}`;
