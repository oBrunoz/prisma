import { Injectable } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';
import { TipoMidia } from '../models/catalogo.models';

export interface MudancaNaFicha {
  tmdbId: number;
  mediaType: TipoMidia;
  origem: object;
}

// banner e formulário do mesmo título: quem grava avisa aqui e os outros recarregam do servidor
@Injectable({ providedIn: 'root' })
export class FichaSyncService {
  private readonly mudancas$ = new Subject<MudancaNaFicha>();

  avisar(tmdbId: number, mediaType: TipoMidia, origem: object): void {
    this.mudancas$.next({ tmdbId, mediaType, origem });
  }

  deOutros(origem: object, tmdbId: () => number, mediaType: () => TipoMidia): Observable<MudancaNaFicha> {
    return this.mudancas$.pipe(
      filter((m) => m.origem !== origem && m.tmdbId === tmdbId() && m.mediaType === mediaType()),
    );
  }

  todas(): Observable<MudancaNaFicha> {
    return this.mudancas$.asObservable();
  }
}
