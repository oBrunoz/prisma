import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TipoMidia } from '../models/catalogo.models';

export interface TituloNaFolha {
  tmdbId: number;
  tipo: TipoMidia;
  titulo: string;
  ano: string;
  nota: number;
  posterUrl: string;
}

// no toque não há hover: o ⋯ ou segurar o card abre as ações nesta folha, montada uma vez no app
@Injectable({ providedIn: 'root' })
export class FolhaAcoesService {
  readonly aberta = signal<TituloNaFolha | null>(null);

  constructor() {
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => this.fechar());
  }

  abrir(titulo: TituloNaFolha): void {
    this.aberta.set(titulo);
  }

  fechar(): void {
    this.aberta.set(null);
  }
}
