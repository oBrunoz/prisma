import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SeoService } from './services/seo.service';

// a estratégia padrão deixaria o SEO da página anterior; o da TMDB vem depois pelo SeoService
@Injectable({ providedIn: 'root' })
export class TituloStrategy extends TitleStrategy {
  private readonly seo = inject(SeoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let rota: ActivatedRouteSnapshot | null = snapshot.root;
    let descricao: string | undefined;
    let indexar = true;
    while (rota) {
      descricao = rota.data['descricao'] ?? descricao;
      if (rota.data['indexar'] === false) indexar = false;
      rota = rota.firstChild;
    }
    this.seo.definir({ titulo: this.buildTitle(snapshot), descricao, indexar });
  }
}
